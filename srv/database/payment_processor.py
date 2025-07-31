"""
Shared payment processing utilities for handling successful payments
"""
import logging
import secrets
import requests
from decimal import Decimal
from django.utils import timezone
from django.conf import settings
from .models import Order, OrderItem, PaymentToken, PaidFilm

logger = logging.getLogger(__name__)


class PaymentProcessor:
    """Handles the business logic for processing successful payments"""
    
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
                
                # Send statistics if user_id is in the correct format
                PaymentProcessor._send_film_statistics(order, item)
            
            logger.info(f"Payment processor: Order {order.order_id} fully processed with token {token_string}")
            return True
            
        except Exception as e:
            logger.error(f"Payment processor: Error processing payment for order {order.order_id}: {str(e)}")
            return False
    
    @staticmethod
    def _send_film_statistics(order: Order, item: OrderItem):
        """
        Send film viewing statistics to the stats API
        
        Args:
            order: Order object
            item: OrderItem object
        """
        try:
            if '/' in order.user_id:
                location_id, device_id = order.user_id.split('/')
                logger.info(f"Payment processor: Sending statistics for film {item.film_id}, location {location_id}")
                
                response = requests.post(
                    f"{settings.STAT_API_URL}record_view/",
                    json={
                        'location_id': location_id,
                        'movie_id': item.film_id
                    },
                    timeout=5
                )
                
                if response.status_code == 200:
                    logger.info(f"Payment processor: Statistics successfully sent for film {item.film_id}")
                else:
                    logger.warning(f"Payment processor: Statistics error, status code: {response.status_code}")
            else:
                logger.warning(f"Payment processor: Invalid user_id format: {order.user_id}")
                
        except requests.RequestException as req_error:
            logger.error(f"Payment processor: Statistics request error: {req_error}")
        except Exception as stat_error:
            logger.error(f"Payment processor: Statistics error: {stat_error}")
    
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
