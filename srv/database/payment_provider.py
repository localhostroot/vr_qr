"""
Payment provider client for verifying payment statuses from PayKeeper API
"""
import requests
import base64
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from django.conf import settings
from typing import Optional, List, Dict, Any
from urllib.parse import urlencode

logger = logging.getLogger(__name__)


class PaymentProviderError(Exception):
    """A safe-to-handle PayKeeper communication or response error."""


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

    def _get_json(self, path: str) -> Any:
        try:
            response = requests.get(
                f"{self.base_url}{path}",
                headers=self.headers,
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning("PayKeeper GET request failed for %s", path)
            raise PaymentProviderError("PayKeeper API is unavailable") from exc

    def _get_token(self) -> str:
        payload = self._get_json('/info/settings/token/')
        token = payload.get('token') if isinstance(payload, dict) else None
        if not token:
            logger.warning("PayKeeper token response did not contain a token")
            raise PaymentProviderError("PayKeeper did not issue an API token")
        return str(token)

    def _get_default_client_email(self) -> str:
        payload = self._get_json('/info/organization/fields/')
        if isinstance(payload, dict):
            fields = payload.get('fields') or payload.get('data') or []
        elif isinstance(payload, list):
            fields = payload
        else:
            fields = []

        for field in fields:
            if not isinstance(field, dict):
                continue
            field_name = field.get('pk_name') or field.get('name')
            if field_name != 'client_email':
                continue
            email = (
                field.get('default')
                or field.get('default_value')
                or field.get('value')
                or field.get('placeholder')
            )
            if isinstance(email, str) and '@' in email:
                return email.strip()

        logger.warning("PayKeeper client_email field has no usable default value")
        raise PaymentProviderError("PayKeeper has no default customer email")

    def create_invoice(
        self,
        *,
        order_id: str,
        amount: Decimal,
        client_id: str,
        service_name: str,
        result_callback: str,
    ) -> str:
        """Create an invoice and return its hosted PayKeeper payment URL."""
        token = self._get_token()
        client_email = self._get_default_client_email()
        service_data = json.dumps(
            {
                'service_name': service_name,
                'user_result_callback': result_callback,
            },
            ensure_ascii=False,
            separators=(',', ':'),
        )
        payload = {
            'pay_amount': format(amount, '.2f'),
            'clientid': client_id,
            'orderid': order_id,
            'service_name': service_data,
            'client_email': client_email,
            'token': token,
        }

        try:
            response = requests.post(
                f"{self.base_url}/change/invoice/preview/",
                headers=self.headers,
                data=payload,
                timeout=15,
            )
            response.raise_for_status()
            result = response.json()
        except (requests.RequestException, ValueError) as exc:
            logger.warning("PayKeeper invoice creation request failed")
            raise PaymentProviderError("PayKeeper invoice creation failed") from exc

        invoice_id = result.get('invoice_id') if isinstance(result, dict) else None
        if not invoice_id:
            logger.warning("PayKeeper invoice response did not contain invoice_id")
            raise PaymentProviderError("PayKeeper did not create an invoice")

        invoice_url = result.get('invoice_url')
        if (
            isinstance(invoice_url, str)
            and invoice_url.startswith(f"{self.base_url}/bill/")
        ):
            return invoice_url

        return f"{self.base_url}/bill/{invoice_id}"

    def get_invoice_url_by_order_id(
        self,
        order_id: str,
        search_days: int = 1,
    ) -> Optional[str]:
        """Find an existing PayKeeper invoice and return its hosted URL."""
        current_date = datetime.now()
        start_date = current_date - timedelta(days=max(search_days - 1, 0))
        end_date = current_date + timedelta(days=1)
        query = urlencode({
            'query': order_id,
            'start_date': start_date.strftime('%Y-%m-%d'),
            'end_date': end_date.strftime('%Y-%m-%d'),
        })

        try:
            invoices = self._get_json(f'/info/invoice/search/?{query}')
        except PaymentProviderError:
            return None

        if not isinstance(invoices, list):
            return None

        for invoice in invoices:
            if not isinstance(invoice, dict) or invoice.get('orderid') != order_id:
                continue
            invoice_id = str(invoice.get('id') or '')
            if invoice_id.isdigit():
                return f"{self.base_url}/bill/{invoice_id}"

        return None
    
    def get_payments_by_date(self, date: str) -> Optional[List[Dict[str, Any]]]:
        """
        Get payments from provider by date (YYYY-MM-DD format)
        
        Args:
            date: Date in YYYY-MM-DD format (will be converted to YYYY_MM_DD for API)
            
        Returns:
            List of payment objects or None if error
        """
        try:
            # Build URL with all possible payment statuses
            url = f"{self.base_url}/info/payments/bydate/?start={date}&end={date}&payment_system_id[]=30&payment_system_id[]=99&payment_system_id[]=305&status[]=success&status[]=canceled&status[]=refunded&status[]=failed&status[]=obtained&status[]=refunding&status[]=partially_refunded&status[]=stuck&status[]=pending&limit=1000&from=0"
            
            logger.info(f"Requesting payments from provider for date {date}")
            
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            result = response.json()
            if not isinstance(result, list):
                error_code = result.get('error_code') if isinstance(result, dict) else None
                logger.warning(
                    "PayKeeper payments response is not a list (error_code=%s)",
                    error_code,
                )
                return None
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

    def is_payment_failed(self, payment: Dict[str, Any]) -> bool:
        """Return whether the gateway reported a terminal failed state."""
        return payment.get('status') in {
            'failed',
            'canceled',
            'refunded',
            'partially_refunded',
        }
    
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
