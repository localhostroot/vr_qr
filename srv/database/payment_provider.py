"""
Payment provider client for verifying payment statuses from PayKeeper API
"""
import requests
import base64
import logging
from datetime import datetime, timedelta
from django.conf import settings
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


class PaymentProviderClient:
    """Client for interacting with PayKeeper payment provider API"""
    
    def __init__(self):
        self.user = settings.PAYMENT_PROVIDER_USER
        self.password = settings.PAYMENT_PROVIDER_PASSWORD
        self.server = settings.PAYMENT_PROVIDER_SERVER
        self.base_url = f"https://{self.server}"
        
        # Create base64 encoded auth string
        auth_string = f"{self.user}:{self.password}"
        self.auth_header = base64.b64encode(auth_string.encode()).decode()
        
        self.headers = {
            'Authorization': f'Basic {self.auth_header}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    
    def get_payments_by_date(self, date: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get payments from provider by date (YYYY-MM-DD format)
        
        Args:
            date: Date in YYYY-MM-DD format
            
        Returns:
            List of payment objects or None if error
        """
        try:
            # Build URL with all possible payment statuses
            url = (
                f"{self.base_url}/info/payments/bydate/"
                f"?start={date}&end={date}"
                f"&payment_system_id[]=30&payment_system_id[]=99"
                f"&status[]=success&status[]=canceled&status[]=refunded"
                f"&status[]=failed&status[]=obtained&status[]=refunding"
                f"&status[]=partially_refunded&status[]=stuck&status[]=pending"
                f"&limit=1000&from=0"
            )
            
            logger.info(f"Requesting payments from provider for date {date}")
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            logger.info(f"Retrieved {len(result)} payments from provider for date {date}")
            
            return result
            
        except requests.RequestException as e:
            logger.error(f"Payment provider API request failed: {str(e)}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error in payment provider client: {str(e)}")
            return None
    
    def verify_payment_by_order_id(self, order_id: str, search_days: int = 1) -> Optional[Dict[str, Any]]:
        """
        Verify payment status by order_id in payment provider
        
        Args:
            order_id: Order ID to search for
            search_days: Number of days back to search (default 1)
            
        Returns:
            Payment object if found, None otherwise
        """
        try:
            # Search for the last few days
            current_date = datetime.now()
            
            for days_back in range(search_days):
                search_date = current_date - timedelta(days=days_back)
                date_str = search_date.strftime('%Y-%m-%d')
                
                logger.info(f"Searching for order {order_id} on date {date_str}")
                
                payments = self.get_payments_by_date(date_str)
                if payments is None:
                    continue
                
                # Look for payment with matching order_id
                for payment in payments:
                    if payment.get('orderid') == order_id:
                        logger.info(f"Found payment for order {order_id} with status {payment.get('status')}")
                        return payment
            
            logger.info(f"No payment found for order {order_id} in last {search_days} days")
            return None
            
        except Exception as e:
            logger.error(f"Error verifying payment for order {order_id}: {str(e)}")
            return None
    
    def is_payment_successful(self, payment: Dict[str, Any]) -> bool:
        """
        Check if payment is successful based on provider status
        
        Args:
            payment: Payment object from provider
            
        Returns:
            True if payment is successful
        """
        return payment.get('status') == 'success'
