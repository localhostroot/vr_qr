"""
Shared payment processing utilities for handling successful payments
"""
import logging
import secrets
import uuid
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from .models import Order, OrderItem, PaymentToken, PaidFilm

logger = logging.getLogger(__name__)


class PaymentProcessor:
    """Handles the business logic for processing successful payments"""

    @staticmethod
    def default_access_duration():
        """Return the configured access window for paid purchases."""
        return timezone.timedelta(hours=settings.PAID_ACCESS_DURATION_HOURS)

    @staticmethod
    def merge_active_session_films(target_token: PaymentToken) -> int:
        """Copy active access from this browser session into the target token.

        ``user_id`` identifies a headset, not a person.  It must never be used
        by itself to combine purchases because several visitors can use the
        same headset during one access window.
        """
        session_id = target_token.order.viewer_session_id
        if session_id is None:
            return 0

        source_films = PaidFilm.objects.filter(
            token__order__user_id=target_token.order.user_id,
            token__order__viewer_session_id=session_id,
            token__is_active=True,
            token__expires_at__gt=timezone.now(),
        ).exclude(token=target_token)

        copied_count = 0
        for source_film in source_films.iterator():
            _, created = PaidFilm.objects.get_or_create(
                token=target_token,
                film_id=source_film.film_id,
                is_series=source_film.is_series,
                defaults={'price': source_film.price},
            )
            if created:
                copied_count += 1

        if copied_count:
            logger.info(
                "Payment processor: merged %s active films for viewer session %s/%s",
                copied_count,
                target_token.order.user_id,
                session_id,
            )

        return copied_count

    @staticmethod
    def link_tokens_to_browser_session(
        target_token: PaymentToken,
        current_token_string: str,
    ) -> bool:
        """Link a new purchase to a token proven by the same browser.

        The token is a capability secret.  A public headset URL alone is not
        sufficient to join purchases.  This also provides a safe transition
        for orders created before ``viewer_session_id`` existed.
        """
        current_token_string = str(current_token_string or '').strip()
        if not current_token_string or len(current_token_string) > 64:
            return False

        try:
            current_token = PaymentToken.objects.select_related('order').get(
                token=current_token_string,
                order__user_id=target_token.order.user_id,
            )
        except PaymentToken.DoesNotExist:
            return False

        session_id = (
            current_token.order.viewer_session_id
            or target_token.order.viewer_session_id
            or uuid.uuid4()
        )

        if current_token.order.viewer_session_id != session_id:
            current_token.order.viewer_session_id = session_id
            current_token.order.save(update_fields=('viewer_session_id',))

        if target_token.order.viewer_session_id != session_id:
            target_token.order.viewer_session_id = session_id
            target_token.order.save(update_fields=('viewer_session_id',))

        PaymentProcessor.merge_active_session_films(target_token)
        return True
    
    @staticmethod
    def process_successful_payment(
        order: Order,
        payment_id: str,
        access_duration=None,
        activate_headset_session=False,
    ) -> bool:
        """
        Process a successful payment by updating order status and creating tokens/films
        
        Args:
            order: Order object to process
            payment_id: Payment ID from provider
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Update order status and payment_id
            order.status = 'paid'
            order.payment_id = payment_id
            order.save()
            logger.info(f"Payment processor: Order {order.order_id} status updated to 'paid', payment_id: {payment_id}")

            # A visitor may buy more films while the headset lease created by
            # an earlier purchase is still active.  The follow-up payment is
            # part of that same browser session, so it must inherit the lease;
            # otherwise selecting the newly bought film directly in the
            # headset is incorrectly treated as an unpaid launch.
            inherit_headset_session = activate_headset_session
            if order.viewer_session_id is not None and not str(payment_id).startswith('free:'):
                inherit_headset_session = inherit_headset_session or PaymentToken.objects.filter(
                    order__user_id=order.user_id,
                    order__viewer_session_id=order.viewer_session_id,
                    order__status__in=('paid', 'checked'),
                    is_active=True,
                    headset_session_active=True,
                    expires_at__gt=timezone.now(),
                ).exclude(order__payment_id__startswith='free:').exists()
            
            # Create payment token
            expires_at = timezone.now() + (
                access_duration
                if access_duration is not None
                else PaymentProcessor.default_access_duration()
            )
            token_string = secrets.token_hex(32)
            
            logger.info(f"Payment processor: Creating payment token for order {order.order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at,
                headset_session_active=inherit_headset_session,
            )
            logger.info(f"Payment processor: Token {token_string} created for order {order.order_id}")
            
            # Process order items and create paid films
            order_items = OrderItem.objects.filter(order=order)
            logger.info(f"Payment processor: Found {order_items.count()} items in order {order.order_id}")
            
            for item in order_items:
                paid_film = PaidFilm.objects.create(
                    token=payment_token,
                    film_id=item.film_id,
                    is_series=item.is_series,
                    price=item.price
                )
                logger.info(f"Payment processor: Created paid film record {item.film_id} for order {order.order_id}")
                
            PaymentProcessor.merge_active_session_films(payment_token)

            if inherit_headset_session and not str(payment_id).startswith('free:'):
                # Keep one active lease token.  The new token already contains
                # the cumulative film set for this browser session.
                PaymentToken.objects.filter(
                    order__user_id=order.user_id,
                    order__viewer_session_id=order.viewer_session_id,
                    is_active=True,
                    headset_session_active=True,
                    expires_at__gt=timezone.now(),
                ).exclude(pk=payment_token.pk).exclude(
                    order__payment_id__startswith='free:',
                ).update(headset_session_active=False)

            logger.info(f"Payment processor: Order {order.order_id} fully processed with token {token_string}")
            return True
            
        except Exception as e:
            logger.error(f"Payment processor: Error processing payment for order {order.order_id}: {str(e)}")
            return False
    
    @staticmethod
    def is_already_processed(order: Order) -> bool:
        """
        Check if order has already been processed successfully
        
        Args:
            order: Order object to check
            
        Returns:
            True if already processed
        """
        return order.status in ['paid', 'checked']
    
    @staticmethod
    def validate_payment_amount(order: Order, provider_amount: str) -> bool:
        """
        Validate that payment amount matches order amount
        
        Args:
            order: Order object
            provider_amount: Amount from payment provider (string)
            
        Returns:
            True if amounts match
        """
        try:
            provider_amount_decimal = Decimal(provider_amount)
            return order.amount == provider_amount_decimal
        except (ValueError, TypeError):
            logger.error(f"Payment processor: Invalid amount format from provider: {provider_amount}")
            return False
