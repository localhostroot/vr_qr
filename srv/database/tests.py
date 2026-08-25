from decimal import Decimal
from unittest.mock import Mock, patch

from django.test import SimpleTestCase, TestCase
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Category, Order, PaidFilm, PaymentToken
from .payment_provider import PaymentProviderClient, PaymentProviderError
from .payment_processor import PaymentProcessor


class ViewerAccessRecoveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.viewer_id = 'TEST/30'

        for suffix in ('a', 'b'):
            Category.objects.create(
                film_id=f'film-{suffix}',
                cat_id='test',
                name=f'Film {suffix.upper()}',
                year='2026',
                format='VR',
                price=100,
                route_id=suffix,
                time='10',
                serial=False,
                isAdded=True,
                country='RU',
                image=f'category_images/{suffix}.jpg',
                queueImg=f'queue_category_images/{suffix}.jpg',
                name_short=f'F{suffix.upper()}',
                description='Test film',
            )

        self.old_order = Order.objects.create(
            user_id=self.viewer_id,
            amount=100,
            description='Old purchase',
            order_id='old-order',
            status='checked',
        )
        self.old_token = PaymentToken.objects.create(
            token='old-token',
            order=self.old_order,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
        )
        PaidFilm.objects.create(
            token=self.old_token,
            film_id='film-a',
            is_series=False,
            price=100,
        )

        self.new_order = Order.objects.create(
            user_id=self.viewer_id,
            amount=100,
            description='New purchase',
            order_id='new-order',
            status='paid',
        )
        self.new_token = PaymentToken.objects.create(
            token='new-token',
            order=self.new_order,
            expires_at=timezone.now() + timezone.timedelta(hours=2),
        )
        PaidFilm.objects.create(
            token=self.new_token,
            film_id='film-b',
            is_series=False,
            price=100,
        )

    def test_merge_keeps_source_token_and_is_idempotent(self):
        PaymentProcessor.merge_active_user_films(self.new_token)
        PaymentProcessor.merge_active_user_films(self.new_token)

        self.assertTrue(PaymentToken.objects.filter(pk=self.old_token.pk).exists())
        self.assertEqual(self.new_token.paid_films.count(), 2)

    def test_latest_for_user_returns_cumulative_access(self):
        response = self.client.get(
            reverse('tokens-latest-for-user'),
            {'user_id': self.viewer_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertEqual(
            {film['film_id'] for film in response.data['films']},
            {'film-a', 'film-b'},
        )
        self.assertTrue(PaymentToken.objects.filter(pk=self.old_token.pk).exists())

    def test_token_validation_exposes_confirmed_payment(self):
        response = self.client.get(
            reverse('tokens-validate'),
            {'token': self.new_token.token, 'film_id': 'film-b'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertTrue(response.data['payment_confirmed'])
        self.assertEqual(response.data['viewer_id'], self.viewer_id)

    def test_token_validation_rejects_unconfirmed_order(self):
        self.new_order.status = 'created'
        self.new_order.save(update_fields=('status',))

        response = self.client.get(
            reverse('tokens-validate'),
            {'token': self.new_token.token, 'film_id': 'film-b'},
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.assertFalse(response.data['payment_confirmed'])

    def test_direct_control_server_request_ends_existing_viewer_access(self):
        ended_at = timezone.now().isoformat()

        response = self.client.post(
            reverse('tokens-end-viewer-session'),
            {'user_id': self.viewer_id, 'ended_at': ended_at},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['deactivated'], 2)
        self.assertFalse(
            PaymentToken.objects.filter(
                order__user_id=self.viewer_id,
                is_active=True,
            ).exists()
        )

        latest_response = self.client.get(
            reverse('tokens-latest-for-user'),
            {'user_id': self.viewer_id},
        )
        self.assertFalse(latest_response.data['valid'])

    def test_session_reset_preserves_access_created_after_cutoff(self):
        ended_at = timezone.now()
        future_order = Order.objects.create(
            user_id=self.viewer_id,
            amount=100,
            description='Payment after headset timeout',
            order_id='future-order',
            status='paid',
        )
        future_token = PaymentToken.objects.create(
            token='future-token',
            order=future_order,
            expires_at=timezone.now() + timezone.timedelta(hours=2),
        )
        PaymentToken.objects.filter(pk=future_token.pk).update(
            created_at=ended_at + timezone.timedelta(seconds=1),
        )

        response = self.client.post(
            reverse('tokens-end-viewer-session'),
            {'user_id': self.viewer_id, 'ended_at': ended_at.isoformat()},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['deactivated'], 2)
        self.assertTrue(
            PaymentToken.objects.filter(pk=future_token.pk, is_active=True).exists()
        )

    def test_direct_control_server_can_check_film_access_for_headset(self):
        paid_response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-b'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )
        unpaid_response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-not-bought'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(paid_response.status_code, 200)
        self.assertTrue(paid_response.data['valid'])
        self.assertEqual(unpaid_response.status_code, 200)
        self.assertFalse(unpaid_response.data['valid'])

    @override_settings(CONTROL_SERVER_SHARED_SECRET='test-control-secret')
    def test_forwarded_session_reset_requires_control_server_secret(self):
        reset_url = reverse('tokens-end-viewer-session')
        payload = {
            'user_id': self.viewer_id,
            'ended_at': timezone.now().isoformat(),
        }

        denied_response = self.client.post(
            reset_url,
            payload,
            format='json',
            REMOTE_ADDR='127.0.0.1',
            HTTP_X_REAL_IP='203.0.113.20',
        )
        self.assertEqual(denied_response.status_code, 403)

        allowed_response = self.client.post(
            reset_url,
            payload,
            format='json',
            REMOTE_ADDR='127.0.0.1',
            HTTP_X_REAL_IP='203.0.113.20',
            HTTP_X_CONTROL_SERVER_SECRET='test-control-secret',
        )
        self.assertEqual(allowed_response.status_code, 200)
        self.assertEqual(allowed_response.data['deactivated'], 2)


class PaymentInvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.film = Category.objects.create(
            film_id='payment-film',
            cat_id='payment-test',
            name='Payment test film',
            year='2026',
            format='VR',
            price=150,
            route_id='payment-film',
            time='10',
            serial=False,
            isAdded=True,
            country='RU',
            image='category_images/payment.jpg',
            queueImg='queue_category_images/payment.jpg',
            name_short='Payment test',
            description='Payment test film',
        )

    def order_payload(self):
        return {
            'user_id': 'VDNH/30',
            'description': 'Оплата за просмотр фильмов',
            'films': [{'film_id': self.film.film_id, 'series': False}],
        }

    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_create_order_returns_server_generated_payment_url(self, create_invoice):
        create_invoice.return_value = 'https://4-neba.server.paykeeper.ru/bill/123/'

        response = self.client.post(
            reverse('payments-create-order'),
            self.order_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            response.data['payment_url'],
            'https://4-neba.server.paykeeper.ru/bill/123/',
        )
        order = Order.objects.get(order_id=response.data['order_id'])
        self.assertEqual(order.status, 'pending')
        create_invoice.assert_called_once_with(
            order_id=order.order_id,
            amount=Decimal('150.00'),
            client_id='VDNH/30',
            service_name='Оплата за просмотр фильмов',
            result_callback='https://cinema.local.vr360.pro/payment-result',
        )

    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_gateway_error_does_not_leave_blocking_order(self, create_invoice):
        create_invoice.side_effect = PaymentProviderError('unavailable')

        response = self.client.post(
            reverse('payments-create-order'),
            self.order_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 502)
        order = Order.objects.get()
        self.assertEqual(order.status, 'payment_error')

    @patch('database.api.PaymentProviderClient.verify_payment_by_order_id')
    def test_order_without_invoice_does_not_block_retry(self, verify_payment):
        order = Order.objects.create(
            user_id='VDNH/30',
            amount=150,
            description='Failed payment form',
            order_id='failed-before-invoice',
            status='created',
        )

        response = self.client.get(
            reverse('status-status'),
            {'order_id': order.order_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'fail')
        verify_payment.assert_not_called()

    def test_failed_invoice_is_hidden_from_recent_manual_approvals(self):
        Order.objects.create(
            user_id='VDNH/30',
            amount=150,
            description='Failed payment form',
            order_id='failed-invoice',
            status='payment_error',
        )
        visible_order = Order.objects.create(
            user_id='VDNH/30',
            amount=150,
            description='Invoice awaiting payment',
            order_id='pending-invoice',
            status='pending',
        )

        response = self.client.get(reverse('admin-search-orders'))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [order['order_id'] for order in response.data['orders']],
            [visible_order.order_id],
        )


@override_settings(
    PAYMENT_PROVIDER_USER='api-user',
    PAYMENT_PROVIDER_PASSWORD='api-password',
    PAYMENT_PROVIDER_SERVER='paykeeper.example',
)
class PaymentProviderInvoiceTests(SimpleTestCase):
    @patch('database.payment_provider.requests.get')
    def test_payment_lookup_uses_iso_date_expected_by_gateway(self, get_request):
        response = Mock()
        response.json.return_value = []
        get_request.return_value = response

        payments = PaymentProviderClient().get_payments_by_date('2026-08-25')

        self.assertEqual(payments, [])
        requested_url = get_request.call_args.args[0]
        self.assertIn('start=2026-08-25&end=2026-08-25', requested_url)
        self.assertNotIn('2026_08_25', requested_url)

    @patch('database.payment_provider.requests.get')
    def test_payment_lookup_rejects_gateway_error_payload(self, get_request):
        response = Mock()
        response.json.return_value = {
            'result': 'fail',
            'error_code': 0,
            'msg': 'Invalid date',
        }
        get_request.return_value = response

        payments = PaymentProviderClient().get_payments_by_date('2026-08-25')

        self.assertIsNone(payments)

    @patch('database.payment_provider.requests.post')
    @patch('database.payment_provider.requests.get')
    def test_invoice_uses_gateway_default_email(self, get_request, post_request):
        token_response = Mock()
        token_response.json.return_value = {'token': 'one-time-token'}
        fields_response = Mock()
        fields_response.json.return_value = [{
            'pk_name': 'client_email',
            'placeholder': 'receipts@example.test',
            'enabled': 'true',
            'required': 'true',
        }]
        get_request.side_effect = [token_response, fields_response]

        invoice_response = Mock()
        invoice_response.json.return_value = {'invoice_id': 'invoice-123'}
        post_request.return_value = invoice_response

        payment_url = PaymentProviderClient().create_invoice(
            order_id='order-123',
            amount=Decimal('150.00'),
            client_id='VDNH/30',
            service_name='Оплата за просмотр фильмов',
            result_callback='https://cinema.example/payment-result',
        )

        self.assertEqual(
            payment_url,
            'https://paykeeper.example/bill/invoice-123/',
        )
        request_data = post_request.call_args.kwargs['data']
        self.assertEqual(request_data['client_email'], 'receipts@example.test')
        self.assertEqual(request_data['service_name'], 'Оплата за просмотр фильмов')
        self.assertEqual(
            request_data['user_result_callback'],
            'https://cinema.example/payment-result',
        )
