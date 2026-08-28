import json
import sqlite3
import tempfile
import uuid
from datetime import datetime, timezone as datetime_timezone
from decimal import Decimal
from io import StringIO
from pathlib import Path
from unittest.mock import Mock, patch

from django.core.management import call_command
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from .models import Category, Movie, Order, OrderItem, PaidFilm, PaymentToken
from .management.commands.backup_database import create_sqlite_backup
from .payment_provider import PaymentProviderClient, PaymentProviderError
from .payment_processor import PaymentProcessor
from .viewer_identity import normalize_viewer_id


class ViewerIdentityTests(SimpleTestCase):
    def test_numeric_headset_ids_ignore_leading_zeroes(self):
        self.assertEqual(normalize_viewer_id('VDNH/02'), 'VDNH/2')
        self.assertEqual(normalize_viewer_id('VDNH/2'), 'VDNH/2')

    def test_non_numeric_headset_ids_are_preserved(self):
        self.assertEqual(normalize_viewer_id('CDH/demo'), 'CDH/demo')

    def test_sqlite_backup_is_valid_and_retention_is_count_based(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            directory = Path(temporary_directory)
            source = directory / 'source.sqlite3'
            destination = directory / 'backups'
            with sqlite3.connect(source) as database:
                database.execute('CREATE TABLE sample (value TEXT)')
                database.execute('INSERT INTO sample VALUES (?)', ('kept',))

            for second in range(3):
                create_sqlite_backup(
                    source,
                    destination,
                    keep=2,
                    now=datetime(
                        2026, 8, 29, 3, 0, second,
                        tzinfo=datetime_timezone.utc,
                    ),
                )

            backups = sorted(destination.glob('qr-db-*.sqlite3'))
            self.assertEqual(len(backups), 2)
            self.assertNotIn('030000', backups[0].name)
            with sqlite3.connect(backups[-1]) as database:
                self.assertEqual(
                    database.execute('SELECT value FROM sample').fetchone()[0],
                    'kept',
                )


@override_settings(
    SITE_ADMIN_PASSWORD='Vr7!Qa',
    SITE_ADMIN_SESSION_SECONDS=8 * 60 * 60,
)
class SiteAdminAuthTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def tearDown(self):
        cache.clear()

    def test_admin_data_requires_login(self):
        response = self.client.get('/api/admin/search_orders/')
        self.assertEqual(response.status_code, 403)

    def test_login_cookie_grants_access_and_logout_revokes_it(self):
        login = self.client.post(
            '/api/admin/login/',
            {'password': 'Vr7!Qa'},
            format='json',
        )
        self.assertEqual(login.status_code, 200)
        self.assertTrue(login.data['authenticated'])
        cookie = login.cookies['site_admin_session']
        self.assertTrue(cookie['httponly'])
        self.assertTrue(cookie['secure'])
        self.assertEqual(cookie['samesite'], 'Strict')

        session = self.client.get('/api/admin/session/')
        self.assertEqual(session.status_code, 200)
        self.assertTrue(session.data['authenticated'])
        self.assertEqual(
            self.client.get('/api/admin/search_orders/').status_code,
            200,
        )

        logout = self.client.post('/api/admin/logout/', format='json')
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(
            self.client.get('/api/admin/search_orders/').status_code,
            403,
        )

    def test_wrong_password_is_rejected(self):
        response = self.client.post(
            '/api/admin/login/',
            {'password': 'wrong'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertNotIn('site_admin_session', response.cookies)


class ViewerAccessRecoveryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.viewer_id = 'TEST/30'
        self.viewer_session_id = uuid.uuid4()

        for suffix in ('a', 'b'):
            Category.objects.create(
                film_id=f'film-{suffix}',
                cat_id=f'test-{suffix}',
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
            viewer_session_id=self.viewer_session_id,
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
            viewer_session_id=self.viewer_session_id,
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
        PaymentProcessor.merge_active_session_films(self.new_token)
        PaymentProcessor.merge_active_session_films(self.new_token)

        self.assertTrue(PaymentToken.objects.filter(pk=self.old_token.pk).exists())
        self.assertEqual(self.new_token.paid_films.count(), 2)

    def test_purchases_from_different_phone_sessions_are_not_merged(self):
        self.old_order.viewer_session_id = uuid.uuid4()
        self.old_order.save(update_fields=('viewer_session_id',))

        PaymentProcessor.merge_active_session_films(self.new_token)

        self.assertEqual(
            set(self.new_token.paid_films.values_list('film_id', flat=True)),
            {'film-b'},
        )

    def test_follow_up_purchase_inherits_active_headset_session(self):
        follow_up_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=self.viewer_session_id,
            amount=100,
            description='Follow-up purchase',
            order_id='follow-up-order',
            status='pending',
        )
        OrderItem.objects.create(
            order=follow_up_order,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        self.assertTrue(
            PaymentProcessor.process_successful_payment(
                follow_up_order,
                'follow-up-payment',
            )
        )

        follow_up_token = follow_up_order.payment_token
        self.assertTrue(follow_up_token.headset_session_active)
        self.assertEqual(
            set(follow_up_token.paid_films.values_list('film_id', flat=True)),
            {'film-a', 'film-b'},
        )

        self.old_token.refresh_from_db()
        self.new_token.refresh_from_db()
        self.assertFalse(self.old_token.headset_session_active)
        self.assertFalse(self.new_token.headset_session_active)

        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-b'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )
        self.assertTrue(response.data['valid'])

    def test_follow_up_purchase_from_another_browser_stays_suspended(self):
        follow_up_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=uuid.uuid4(),
            amount=100,
            description='Another visitor purchase',
            order_id='another-visitor-follow-up',
            status='pending',
        )
        OrderItem.objects.create(
            order=follow_up_order,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        self.assertTrue(
            PaymentProcessor.process_successful_payment(
                follow_up_order,
                'another-visitor-payment',
            )
        )

        self.assertFalse(follow_up_order.payment_token.headset_session_active)

    def test_first_paid_purchase_claims_idle_headset(self):
        PaymentToken.objects.filter(
            order__user_id=self.viewer_id,
        ).update(headset_session_active=False)
        first_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=uuid.uuid4(),
            amount=100,
            description='First visitor on idle headset',
            order_id='idle-headset-order',
            status='pending',
        )
        OrderItem.objects.create(
            order=first_order,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        self.assertTrue(
            PaymentProcessor.process_successful_payment(
                first_order,
                'idle-headset-payment',
            )
        )

        self.assertTrue(first_order.payment_token.headset_session_active)

    def test_expired_headset_lease_does_not_block_new_purchase(self):
        PaymentToken.objects.filter(
            order__user_id=self.viewer_id,
        ).update(expires_at=timezone.now() - timezone.timedelta(seconds=1))
        next_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=uuid.uuid4(),
            amount=100,
            description='Purchase after expired lease',
            order_id='expired-lease-order',
            status='pending',
        )
        OrderItem.objects.create(
            order=next_order,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        self.assertTrue(
            PaymentProcessor.process_successful_payment(
                next_order,
                'expired-lease-payment',
            )
        )

        self.assertTrue(next_order.payment_token.headset_session_active)

    def test_current_token_can_link_a_new_order_to_legacy_browser_session(self):
        self.old_order.viewer_session_id = None
        self.old_order.save(update_fields=('viewer_session_id',))
        self.new_order.viewer_session_id = None
        self.new_order.save(update_fields=('viewer_session_id',))

        response = self.client.get(
            reverse('tokens-get-token-by-order'),
            {
                'order_id': self.new_order.order_id,
                'current_token': self.old_token.token,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.old_order.refresh_from_db()
        self.new_order.refresh_from_db()
        self.assertIsNotNone(self.old_order.viewer_session_id)
        self.assertEqual(
            self.old_order.viewer_session_id,
            self.new_order.viewer_session_id,
        )
        self.assertEqual(self.new_token.paid_films.count(), 2)

    def test_latest_for_user_returns_cumulative_access(self):
        response = self.client.get(
            reverse('tokens-latest-for-user'),
            {
                'user_id': self.viewer_id,
                'known_token': self.new_token.token,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertEqual(
            {film['film_id'] for film in response.data['films']},
            {'film-a', 'film-b'},
        )
        self.assertTrue(PaymentToken.objects.filter(pk=self.old_token.pk).exists())

    def test_zero_padded_phone_route_finds_canonical_headset_access(self):
        response = self.client.get(
            reverse('tokens-latest-for-user'),
            {
                'user_id': 'TEST/030',
                'known_token': self.new_token.token,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])

    def test_latest_for_user_requires_browser_purchase_proof(self):
        response = self.client.get(
            reverse('tokens-latest-for-user'),
            {'user_id': self.viewer_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.assertTrue(response.data['proof_required'])

    def test_latest_for_user_rejects_proof_for_another_viewer(self):
        response = self.client.get(
            reverse('tokens-latest-for-user'),
            {
                'user_id': 'TEST/31',
                'known_token': self.new_token.token,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])

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

    def test_legacy_session_reset_does_not_hide_a_live_purchase(self):
        ended_at = timezone.now().isoformat()

        response = self.client.post(
            reverse('tokens-end-viewer-session'),
            {'user_id': self.viewer_id, 'ended_at': ended_at},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['deactivated'], 2)
        self.assertEqual(
            PaymentToken.objects.filter(
                order__user_id=self.viewer_id,
                is_active=True,
            ).count(),
            2,
        )
        self.assertFalse(
            PaymentToken.objects.filter(
                order__user_id=self.viewer_id,
                headset_session_active=True,
            ).exists()
        )

        latest_response = self.client.get(
            reverse('tokens-latest-for-user'),
            {
                'user_id': self.viewer_id,
                'known_token': self.new_token.token,
            },
        )
        self.assertTrue(latest_response.data['valid'])

        headset_response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-b'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )
        self.assertTrue(headset_response.data['valid'])
        self.assertTrue(headset_response.data['paid'])
        self.assertFalse(headset_response.data['free_access'])

    def test_phone_token_authorizes_exact_film_without_acquiring_a_lease(self):
        PaymentToken.objects.filter(pk=self.new_token.pk).update(
            headset_session_active=False,
        )

        response = self.client.post(
            reverse('tokens-resume-viewer-session'),
            {
                'user_id': self.viewer_id,
                'film_id': 'film-b',
                'token': self.new_token.token,
            },
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.new_token.refresh_from_db()
        self.assertTrue(self.new_token.is_active)
        self.assertFalse(self.new_token.headset_session_active)
        self.old_token.refresh_from_db()
        self.assertTrue(self.old_token.headset_session_active)

    def test_phone_token_cannot_launch_a_film_missing_from_that_token(self):
        response = self.client.post(
            reverse('tokens-resume-viewer-session'),
            {
                'user_id': self.viewer_id,
                'film_id': 'film-b',
                'token': self.old_token.token,
            },
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.assertFalse(response.data['film_valid'])

    def test_explicit_phone_start_is_not_rejected_by_an_old_headset_lease(self):
        other_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=uuid.uuid4(),
            amount=100,
            description='Different visitor',
            order_id='different-visitor-order',
            status='paid',
        )
        other_token = PaymentToken.objects.create(
            token='different-visitor-token',
            order=other_order,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
            headset_session_active=False,
        )
        PaidFilm.objects.create(
            token=other_token,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        response = self.client.post(
            reverse('tokens-resume-viewer-session'),
            {
                'user_id': self.viewer_id,
                'film_id': 'film-b',
                'token': other_token.token,
            },
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertNotIn('occupied', response.data)
        other_token.refresh_from_db()
        self.assertFalse(other_token.headset_session_active)

    def test_explicit_phone_start_does_not_create_a_new_headset_lease(self):
        PaymentToken.objects.filter(
            order__user_id=self.viewer_id,
        ).update(headset_session_active=False)
        other_order = Order.objects.create(
            user_id=self.viewer_id,
            viewer_session_id=uuid.uuid4(),
            amount=100,
            description='Next visitor',
            order_id='next-visitor-order',
            status='paid',
        )
        other_token = PaymentToken.objects.create(
            token='next-visitor-token',
            order=other_order,
            expires_at=timezone.now() + timezone.timedelta(hours=1),
            headset_session_active=False,
        )
        PaidFilm.objects.create(
            token=other_token,
            film_id='film-b',
            is_series=False,
            price=100,
        )

        response = self.client.post(
            reverse('tokens-resume-viewer-session'),
            {
                'user_id': self.viewer_id,
                'film_id': 'film-b',
                'token': other_token.token,
            },
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertTrue(response.data['valid'])
        other_token.refresh_from_db()
        self.assertFalse(other_token.headset_session_active)

    def test_browser_token_cannot_resume_another_headset(self):
        PaymentToken.objects.filter(pk=self.new_token.pk).update(
            headset_session_active=False,
        )

        response = self.client.post(
            reverse('tokens-resume-viewer-session'),
            {
                'user_id': 'TEST/31',
                'film_id': 'film-b',
                'token': self.new_token.token,
            },
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.new_token.refresh_from_db()
        self.assertFalse(self.new_token.headset_session_active)

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
            PaymentToken.objects.filter(
                pk=future_token.pk,
                is_active=True,
                headset_session_active=True,
            ).exists()
        )
        self.assertFalse(
            PaymentToken.objects.filter(
                pk__in=(self.old_token.pk, self.new_token.pk),
                headset_session_active=True,
            ).exists()
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
        self.assertTrue(paid_response.data['paid'])
        self.assertFalse(paid_response.data['free_access'])
        self.assertEqual(unpaid_response.status_code, 200)
        self.assertFalse(unpaid_response.data['valid'])
        self.assertFalse(unpaid_response.data['paid'])
        self.assertFalse(unpaid_response.data['free_access'])

    def test_active_browser_session_unlocks_film_from_inactive_follow_up_token(self):
        self.new_token.headset_session_active = False
        self.new_token.save(update_fields=('headset_session_active',))

        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-b'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])

    def test_direct_check_only_classifies_another_browser_purchase(self):
        self.new_order.viewer_session_id = uuid.uuid4()
        self.new_order.save(update_fields=('viewer_session_id',))
        self.new_token.headset_session_active = False
        self.new_token.save(update_fields=('headset_session_active',))

        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': self.viewer_id, 'film_id': 'film-b'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertTrue(response.data['paid'])
        self.assertFalse(response.data['free_access'])

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


@override_settings(SITE_ADMIN_PASSWORD='Vr7!Qa')
class PaymentInvoiceTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.viewer_session_id = uuid.uuid4()
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
        self.bundle = Category.objects.create(
            film_id='bundle',
            cat_id='bundle-test',
            name='Discounted bundle',
            year='2026',
            format='VR',
            price=150,
            route_id='bundle',
            time='30',
            serial=True,
            isAdded=True,
            country='RU',
            image='category_images/bundle.jpg',
            queueImg='queue_category_images/bundle.jpg',
            name_short='Discounted bundle',
            description='Three films sold together at a discount',
        )
        self.bundle_films = []
        for index in range(1, 4):
            self.bundle_films.append(Movie.objects.create(
                film_id=f'bundle-{index}',
                name=f'Bundle film {index}',
                name_short=f'Bundle film {index}',
                description='Bundle film',
                route_id=f'bundle-{index}',
                year='2026',
                country='RU',
                number=str(index),
                serial=True,
                isAdded=True,
                cat_id=self.bundle,
                image=f'movie_images/bundle-{index}.jpg',
                queueImg=f'queue_movie_images/bundle-{index}.jpg',
                time='10',
                format='VR',
                price=100,
                series=True,
            ))

    def order_payload(self):
        return {
            'user_id': 'VDNH/30',
            'viewer_session_id': str(self.viewer_session_id),
            'description': 'Оплата за просмотр фильмов',
            'films': [{'film_id': self.film.film_id, 'series': False}],
        }

    def authenticate_site_admin(self):
        response = self.client.post(
            reverse('admin-login'),
            {'password': 'Vr7!Qa'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)

    @override_settings(PAID_ACCESS_DURATION_HOURS=1)
    def test_paid_access_default_duration_is_one_hour(self):
        order = Order.objects.create(
            user_id='VDNH/30',
            amount=150,
            description='Paid access duration test',
            order_id='paid-duration-test',
            status='pending',
        )
        earliest_expiry = timezone.now() + timezone.timedelta(hours=1)

        self.assertTrue(
            PaymentProcessor.process_successful_payment(order, 'payment-test')
        )

        latest_expiry = timezone.now() + timezone.timedelta(hours=1)
        token = order.payment_token
        self.assertGreaterEqual(token.expires_at, earliest_expiry)
        self.assertLessEqual(token.expires_at, latest_expiry)
        self.assertTrue(token.headset_session_active)

    def bundle_payload(self, films=None):
        return {
            'user_id': 'VDNH/30',
            'description': 'Оплата за просмотр фильмов',
            'films': [
                {'film_id': film.film_id, 'series': True}
                for film in (films or self.bundle_films)
            ],
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
        self.assertEqual(order.viewer_session_id, self.viewer_session_id)
        create_invoice.assert_called_once_with(
            order_id=order.order_id,
            amount=Decimal('150.00'),
            client_id='VDNH/30',
            service_name='Оплата за просмотр фильмов',
            result_callback='https://cinema.local.vr360.pro/payment-result',
        )

    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_zero_padded_phone_route_is_stored_as_headset_id(self, create_invoice):
        create_invoice.return_value = 'https://4-neba.server.paykeeper.ru/bill/126/'
        payload = self.order_payload()
        payload['user_id'] = 'VDNH/02'

        response = self.client.post(
            reverse('payments-create-order'),
            payload,
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        order = Order.objects.get(order_id=response.data['order_id'])
        self.assertEqual(order.user_id, 'VDNH/2')
        self.assertEqual(create_invoice.call_args.kwargs['client_id'], 'VDNH/2')

    @override_settings(FREE_VIEWER_IDS=frozenset({'vdnh/30'}))
    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_free_viewer_receives_access_without_gateway_invoice(self, create_invoice):
        response = self.client.post(
            reverse('payments-create-order'),
            self.order_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['free_access'])
        self.assertEqual(response.data['amount'], 0.0)
        self.assertNotIn('payment_url', response.data)
        create_invoice.assert_not_called()

        order = Order.objects.get(order_id=response.data['order_id'])
        self.assertEqual(order.status, 'checked')
        self.assertTrue(order.payment_id.startswith('free:'))
        self.assertEqual(order.amount, Decimal('0.00'))
        self.assertEqual(order.items.get().price, Decimal('0.00'))
        self.assertEqual(order.payment_token.paid_films.get().price, Decimal('0.00'))
        self.assertGreater(
            order.payment_token.expires_at,
            timezone.now() + timezone.timedelta(days=6),
        )
        self.assertTrue(order.payment_token.headset_session_active)

        access_response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': 'VDNH/30', 'film_id': self.film.film_id},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )
        self.assertEqual(access_response.status_code, 200)
        self.assertTrue(access_response.data['valid'])
        self.assertTrue(access_response.data['free_access'])
        self.assertFalse(access_response.data['paid'])

        reset_response = self.client.post(
            reverse('tokens-end-viewer-session'),
            {'user_id': 'VDNH/30', 'ended_at': timezone.now().isoformat()},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )
        self.assertEqual(reset_response.status_code, 200)
        self.assertEqual(reset_response.data['deactivated'], 0)
        order.payment_token.refresh_from_db()
        self.assertTrue(order.payment_token.is_active)

    @override_settings(FREE_VIEWER_IDS=frozenset({'vdnh/30'}))
    def test_free_access_status_is_exact_and_case_insensitive(self):
        enabled_response = self.client.get(
            reverse('payments-free-access-status'),
            {'user_id': 'VDNH/30'},
        )
        other_response = self.client.get(
            reverse('payments-free-access-status'),
            {'user_id': 'VDNH/11'},
        )

        self.assertTrue(enabled_response.data['free_access'])
        self.assertFalse(other_response.data['free_access'])

    @override_settings(FREE_VIEWER_IDS=frozenset({'vdnh/30'}))
    def test_free_viewer_has_direct_catalog_access_without_token(self):
        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': 'VDNH/30', 'film_id': self.film.film_id},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['valid'])
        self.assertTrue(response.data['free_access'])
        self.assertFalse(response.data['paid'])
        self.assertFalse(PaymentToken.objects.exists())

    @override_settings(FREE_VIEWER_IDS=frozenset({'vdnh/30'}))
    def test_free_viewer_cannot_start_unknown_catalog_film(self):
        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': 'VDNH/30', 'film_id': 'unknown-film'},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.assertFalse(response.data['free_access'])

    @override_settings(FREE_VIEWER_IDS=frozenset())
    def test_legacy_free_token_does_not_keep_removed_viewer_free(self):
        order = Order.objects.create(
            user_id='VDNH/30',
            amount=0,
            description='Legacy free access',
            order_id='legacy-free-order',
            status='checked',
            payment_id='free:legacy-free-order',
        )
        token = PaymentToken.objects.create(
            token='legacy-free-token',
            order=order,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        PaidFilm.objects.create(
            token=token,
            film_id=self.film.film_id,
            is_series=False,
            price=0,
        )

        response = self.client.post(
            reverse('tokens-viewer-film-access'),
            {'user_id': 'VDNH/30', 'film_id': self.film.film_id},
            format='json',
            REMOTE_ADDR='127.0.0.1',
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['valid'])
        self.assertFalse(response.data['free_access'])
        self.assertFalse(response.data['paid'])

    def test_access_cleanup_deactivates_only_legacy_free_and_expired_tokens(self):
        def create_token(order_id, payment_id, expires_at):
            order = Order.objects.create(
                user_id='VDNH/40',
                amount=0 if payment_id.startswith('free:') else 100,
                description=order_id,
                order_id=order_id,
                status='checked',
                payment_id=payment_id,
            )
            return PaymentToken.objects.create(
                token=f'{order_id}-token',
                order=order,
                expires_at=expires_at,
                is_active=True,
                headset_session_active=True,
            )

        legacy_free = create_token(
            'cleanup-free',
            'free:cleanup-free',
            timezone.now() + timezone.timedelta(days=7),
        )
        expired_paid = create_token(
            'cleanup-expired-paid',
            'bank-payment-expired',
            timezone.now() - timezone.timedelta(seconds=1),
        )
        active_paid = create_token(
            'cleanup-active-paid',
            'bank-payment-active',
            timezone.now() + timezone.timedelta(hours=1),
        )

        output = StringIO()
        call_command('cleanup_access_state', stdout=output)

        legacy_free.refresh_from_db()
        expired_paid.refresh_from_db()
        active_paid.refresh_from_db()
        self.assertFalse(legacy_free.is_active)
        self.assertFalse(legacy_free.headset_session_active)
        self.assertFalse(expired_paid.is_active)
        self.assertFalse(expired_paid.headset_session_active)
        self.assertTrue(active_paid.is_active)
        self.assertTrue(active_paid.headset_session_active)
        self.assertIn('legacy_free=1, expired_paid=1', output.getvalue())

    def test_access_cleanup_dry_run_does_not_change_tokens(self):
        order = Order.objects.create(
            user_id='VDNH/40',
            amount=0,
            description='Dry run free token',
            order_id='cleanup-dry-run',
            status='checked',
            payment_id='free:cleanup-dry-run',
        )
        token = PaymentToken.objects.create(
            token='cleanup-dry-run-token',
            order=order,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

        call_command('cleanup_access_state', '--dry-run', stdout=StringIO())

        token.refresh_from_db()
        self.assertTrue(token.is_active)
        self.assertTrue(token.headset_session_active)

    @override_settings(FREE_VIEWER_IDS=frozenset({'vdnh/30'}))
    def test_free_orders_are_hidden_from_recent_manual_approvals(self):
        response = self.client.post(
            reverse('payments-create-order'),
            self.order_payload(),
            format='json',
        )
        self.assertEqual(response.status_code, 201)

        self.authenticate_site_admin()
        admin_response = self.client.get(reverse('admin-search-orders'))
        self.assertEqual(admin_response.status_code, 200)
        self.assertEqual(admin_response.data['orders'], [])

    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_complete_series_uses_discounted_bundle_price(self, create_invoice):
        create_invoice.return_value = 'https://4-neba.server.paykeeper.ru/bill/124/'

        response = self.client.post(
            reverse('payments-create-order'),
            self.bundle_payload(),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['amount'], 150.0)
        self.assertEqual(response.data['bundles'], [{
            'cat_id': 'bundle-test',
            'name': 'Discounted bundle',
            'regular_amount': Decimal('300.00'),
            'bundle_amount': Decimal('150.00'),
        }])
        order = Order.objects.get(order_id=response.data['order_id'])
        self.assertEqual(order.amount, Decimal('150.00'))
        self.assertEqual(order.items.count(), 3)
        self.assertEqual(
            list(order.items.order_by('film_id').values_list('price', flat=True)),
            [Decimal('100.00')] * 3,
        )
        self.assertEqual(
            create_invoice.call_args.kwargs['amount'],
            Decimal('150.00'),
        )

    @patch('database.api.PaymentProviderClient.create_invoice')
    def test_partial_series_uses_individual_film_prices(self, create_invoice):
        create_invoice.return_value = 'https://4-neba.server.paykeeper.ru/bill/125/'

        response = self.client.post(
            reverse('payments-create-order'),
            self.bundle_payload(self.bundle_films[:2]),
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['amount'], 200.0)
        self.assertEqual(response.data['bundles'], [])
        self.assertEqual(
            create_invoice.call_args.kwargs['amount'],
            Decimal('200.00'),
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

    @override_settings(PAYMENT_VERIFICATION_ENABLED=True)
    @patch('database.api.PaymentProviderClient.verify_payment_by_order_id')
    def test_failed_gateway_payment_unblocks_retry(self, verify_payment):
        order = Order.objects.create(
            user_id='VDNH/30',
            amount=150,
            description='Gateway payment failed',
            order_id='failed-at-gateway',
            status='pending',
        )
        verify_payment.return_value = {
            'id': 'payment-123',
            'orderid': order.order_id,
            'status': 'failed',
        }

        response = self.client.get(
            reverse('status-status'),
            {'order_id': order.order_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {'status': 'fail', 'verified': True})
        order.refresh_from_db()
        self.assertEqual(order.status, 'payment_error')

    @override_settings(PAYMENT_VERIFICATION_ENABLED=True)
    @patch(
        'database.api.PaymentProviderClient.get_invoice_url_by_order_id',
        return_value='https://4-neba.server.paykeeper.ru/bill/20260825163109904',
    )
    @patch(
        'database.api.PaymentProviderClient.verify_payment_by_order_id',
        return_value=None,
    )
    def test_pending_order_can_return_existing_invoice(
        self,
        verify_payment,
        get_invoice_url,
    ):
        order = Order.objects.create(
            user_id='VDNH/30',
            amount=50,
            description='Invoice awaiting payment',
            order_id='pending-with-invoice',
            status='pending',
        )

        response = self.client.get(
            reverse('status-status'),
            {
                'order_id': order.order_id,
                'include_payment_url': 'true',
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(
            response.data['payment_url'],
            'https://4-neba.server.paykeeper.ru/bill/20260825163109904',
        )
        verify_payment.assert_called_once_with(order.order_id, search_days=1)
        get_invoice_url.assert_called_once_with(order.order_id, search_days=1)

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

        self.authenticate_site_admin()
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
    @patch.object(PaymentProviderClient, '_get_json')
    def test_existing_invoice_url_can_be_recovered(self, get_json):
        get_json.return_value = [{
            'id': '20260825163109904',
            'orderid': 'order-123',
            'status': 'created',
        }]

        payment_url = PaymentProviderClient().get_invoice_url_by_order_id(
            'order-123',
        )

        self.assertEqual(
            payment_url,
            'https://paykeeper.example/bill/20260825163109904',
        )
        request_path = get_json.call_args.args[0]
        self.assertIn('/info/invoice/search/?', request_path)
        self.assertIn('query=order-123', request_path)

    @patch('database.payment_provider.requests.get')
    def test_payment_lookup_uses_iso_date_expected_by_gateway(self, get_request):
        response = Mock()
        response.json.return_value = []
        get_request.return_value = response

        payments = PaymentProviderClient().get_payments_by_date('2026-08-25')

        self.assertEqual(payments, [])
        requested_url = get_request.call_args.args[0]
        self.assertIn('start=2026-08-25&end=2026-08-25', requested_url)
        self.assertIn('payment_system_id[]=305', requested_url)
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
        invoice_response.json.return_value = {
            'invoice_id': 'invoice-123',
            'invoice_url': 'https://paykeeper.example/bill/invoice-123',
        }
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
            'https://paykeeper.example/bill/invoice-123',
        )
        request_data = post_request.call_args.kwargs['data']
        self.assertEqual(request_data['client_email'], 'receipts@example.test')
        service_data = json.loads(request_data['service_name'])
        self.assertEqual(
            service_data['service_name'],
            'Оплата за просмотр фильмов',
        )
        self.assertEqual(
            service_data['user_result_callback'],
            'https://cinema.example/payment-result',
        )
        self.assertNotIn('user_result_callback', request_data)
