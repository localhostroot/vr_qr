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
            date: Date in YYYY-MM-DD format (will be converted to YYYY_MM_DD for API)
            
        Returns:
            List of payment objects or None if error
        """
        try:
            # Convert date format from YYYY-MM-DD to YYYY_MM_DD for PayKeeper API
            api_date = date.replace('-', '_')
            
            # Build URL with all possible payment statuses
            url = f"{self.base_url}/info/payments/bydate/?start={api_date}&end={api_date}&payment_system_id[]=30&payment_system_id[]=99&status[]=success&status[]=canceled&status[]=refunded&status[]=failed&status[]=obtained&status[]=refunding&status[]=partially_refunded&status[]=stuck&status[]=pending&limit=1000&from=0"
            
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
    
    def get_payments_for_date_range(self, start_date: str, end_date: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get payments from provider for a date range (for analytics)
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            List of all payment objects in the date range or None if error
        """
        try:
            all_payments = []
            current_date = datetime.strptime(start_date, '%Y-%m-%d')
            end_date_obj = datetime.strptime(end_date, '%Y-%m-%d')
            
            logger.info(f"Requesting payments for date range {start_date} to {end_date}")
            
            while current_date <= end_date_obj:
                date_str = current_date.strftime('%Y-%m-%d')
                daily_payments = self.get_payments_by_date(date_str)
                
                if daily_payments is not None:
                    all_payments.extend(daily_payments)
                    logger.debug(f"Retrieved {len(daily_payments)} payments for {date_str}")
                else:
                    logger.warning(f"Failed to get payments for {date_str}")
                
                current_date += timedelta(days=1)
            
            logger.info(f"Total payments retrieved for range: {len(all_payments)}")
            return all_payments
            
        except Exception as e:
            logger.error(f"Error getting payments for date range {start_date} to {end_date}: {str(e)}")
            return None
    
    def get_analytics_for_period(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Get comprehensive payment analytics for a period
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            
        Returns:
            Dictionary with analytics data
        """
        payments = self.get_payments_for_date_range(start_date, end_date)
        
        if payments is None:
            return {
                'total_payments': 0,
                'successful_payments': 0,
                'failed_payments': 0,
                'pending_payments': 0,
                'canceled_payments': 0,
                'refunded_payments': 0,
                'total_revenue': 0,
                'success_rate': 0,
                'payment_methods': {},
                'daily_totals': {},
                'hourly_distribution': [0] * 24,
                'error': 'Failed to fetch payment data for period'
            }
        
        return self._process_payment_analytics(payments, start_date, end_date)
    
    def _process_payment_analytics(self, payments: List[Dict[str, Any]], start_date: str, end_date: str) -> Dict[str, Any]:
        """
        Process payments data into analytics
        
        Args:
            payments: List of payment objects
            start_date: Start date for reference
            end_date: End date for reference
            
        Returns:
            Analytics dictionary
        """
        analytics = {
            'total_payments': len(payments),
            'successful_payments': 0,
            'failed_payments': 0,
            'pending_payments': 0,
            'canceled_payments': 0,
            'refunded_payments': 0,
            'total_revenue': 0,
            'success_rate': 0,
            'payment_methods': {},
            'hourly_distribution': [0] * 24,
            'daily_totals': {},
            'period': f"{start_date} to {end_date}"
        }
        
        for payment in payments:
            # Count by status
            status = payment.get('status', 'unknown')
            if status == 'success':
                analytics['successful_payments'] += 1
                # Add to revenue (convert kopecks to rubles if needed)
                pay_amount = float(payment.get('pay_amount', 0))
                analytics['total_revenue'] += pay_amount
            elif status == 'failed':
                analytics['failed_payments'] += 1
            elif status == 'pending':
                analytics['pending_payments'] += 1
            elif status == 'canceled':
                analytics['canceled_payments'] += 1
            elif status in ['refunded', 'partially_refunded']:
                analytics['refunded_payments'] += 1
            
            # Count by payment method
            payment_system = payment.get('payment_system_id', 'unknown')
            analytics['payment_methods'][payment_system] = analytics['payment_methods'].get(payment_system, 0) + 1
            
            # Hourly distribution (if datetime available)
            success_datetime = payment.get('success_datetime') or payment.get('obtain_datetime')
            if success_datetime:
                try:
                    # Parse datetime (format might vary)
                    if ' ' in success_datetime:
                        dt_part = success_datetime.split(' ')[1]  # Get time part
                        hour = int(dt_part.split(':')[0])
                        analytics['hourly_distribution'][hour] += 1
                except (ValueError, IndexError):
                    pass
            
            # Daily totals
            date_part = None
            if success_datetime:
                date_part = success_datetime.split(' ')[0] if ' ' in success_datetime else success_datetime.split('T')[0]
            
            if date_part:
                if date_part not in analytics['daily_totals']:
                    analytics['daily_totals'][date_part] = {'count': 0, 'revenue': 0}
                analytics['daily_totals'][date_part]['count'] += 1
                if status == 'success':
                    analytics['daily_totals'][date_part]['revenue'] += pay_amount
        
        # Calculate success rate
        if analytics['total_payments'] > 0:
            analytics['success_rate'] = round((analytics['successful_payments'] / analytics['total_payments']) * 100, 2)
        
        return analytics
