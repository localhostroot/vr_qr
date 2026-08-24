from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Category, Order, PaidFilm, PaymentToken
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
