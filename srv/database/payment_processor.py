"""
Shared payment processing utilities for handling successful payments
"""
import logging
import secrets
from decimal import Decimal
from django.utils import timezone
from .models import Order, OrderItem, PaymentToken, PaidFilm

logger = logging.getLogger(__name__)


class PaymentProcessor:
    """Handles the business logic for processing successful payments"""

    @staticmethod
    def merge_active_user_films(target_token: PaymentToken) -> int:
        """Copy active access for the same viewer into the target token.

        Source tokens are deliberately kept until their natural expiry.  A
        viewer can therefore finish switching devices/tabs without an older
        page suddenly losing access, and historical orders do not reappear in
        the admin UI as paid orders without a token.
        """
        source_films = PaidFilm.objects.filter(
            token__order__user_id=target_token.order.user_id,
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
                "Payment processor: merged %s active films for viewer %s",
                copied_count,
                target_token.order.user_id,
            )

        return copied_count
    
    @staticmethod
    def process_successful_payment(order: Order, payment_id: str) -> bool:
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
            
            # Create payment token
            expires_at = timezone.now() + timezone.timedelta(hours=2)
            token_string = secrets.token_hex(32)
            
            logger.info(f"Payment processor: Creating payment token for order {order.order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at
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
                
            PaymentProcessor.merge_active_user_films(payment_token)

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
