from datetime import datetime, timezone as datetime_timezone

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Device, Location, PlaybackSession, Video


class PlaybackStatisticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse('update-statistics')
        self.base_payload = {
            'session_id': 'session-1',
            'client_id': '30',
            'location_name': 'VDNH',
            'video_id': 'film-1',
        }

    def post_event(self, event, **overrides):
        return self.client.post(
            self.url,
            {**self.base_payload, 'event': event, **overrides},
            format='json',
        )

    def assert_counters(self, launches, abandoned, viewed):
        for instance in (
            Location.objects.get(name='VDNH'),
            Device.objects.get(client_id='30'),
            Video.objects.get(video_id='film-1'),
        ):
            self.assertEqual(instance.launches, launches)
            self.assertEqual(instance.abandoned, abandoned)
            self.assertEqual(instance.viewed, viewed)

    def test_start_is_idempotent_and_counts_one_launch(self):
        first = self.post_event('start')
        second = self.post_event('start')

        self.assertEqual(first.status_code, 200)
        self.assertTrue(first.data['created'])
        self.assertFalse(second.data['created'])
        self.assertEqual(PlaybackSession.objects.count(), 1)
        self.assert_counters(launches=1, abandoned=0, viewed=0)

    def test_more_than_twenty_seconds_below_half_is_abandoned_once(self):
        self.post_event('start')
        first = self.post_event(
            'finish',
            playback_position=49,
            duration=100,
            played_seconds=21,
            end_reason='stopped',
        )
        second = self.post_event(
            'finish',
            playback_position=49,
            duration=100,
            played_seconds=21,
            end_reason='stopped',
        )

        self.assertEqual(first.data['status'], PlaybackSession.Status.ABANDONED)
        self.assertEqual(second.data['status'], PlaybackSession.Status.ABANDONED)
        self.assert_counters(launches=1, abandoned=1, viewed=0)

    def test_exactly_half_is_viewed(self):
        self.post_event('start')
        response = self.post_event(
            'finish',
            playback_position=50,
            duration=100,
            played_seconds=50,
        )

        self.assertEqual(response.data['status'], PlaybackSession.Status.VIEWED)
        self.assert_counters(launches=1, abandoned=0, viewed=1)

    def test_twenty_seconds_or_less_is_only_a_launch(self):
        self.post_event('start')
        response = self.post_event(
            'finish',
            playback_position=19,
            duration=100,
            played_seconds=20,
        )

        self.assertEqual(response.data['status'], PlaybackSession.Status.SHORT)
        self.assert_counters(launches=1, abandoned=0, viewed=0)

    def test_finish_can_recover_a_missing_start_event(self):
        response = self.post_event(
            'finish',
            playback_position=75,
            duration=100,
            played_seconds=75,
        )

        self.assertTrue(response.data['created'])
        self.assert_counters(launches=1, abandoned=0, viewed=1)

    def test_zero_padded_aliases_share_one_device(self):
        first = self.post_event('start', client_id='08', session_id='session-08')
        second = self.post_event('start', client_id='8', session_id='session-8')

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        devices = Device.objects.filter(location__name='VDNH', client_id='8')
        self.assertEqual(devices.count(), 1)
        self.assertEqual(devices.get().playback_sessions.count(), 2)
        self.assertEqual(devices.get().launches, 2)

    def test_legacy_volga_id_is_recorded_under_canonical_video(self):
        legacy = self.post_event(
            'start',
            session_id='legacy-volga',
            video_id='volga_2',
        )
        canonical = self.post_event(
            'start',
            session_id='canonical-volga',
            video_id='volga',
        )

        self.assertEqual(legacy.status_code, 200)
        self.assertEqual(canonical.status_code, 200)
        self.assertFalse(Video.objects.filter(video_id='volga_2').exists())
        video = Video.objects.get(video_id='volga')
        self.assertEqual(video.title, 'Течет река Волга')
        self.assertEqual(video.playback_sessions.count(), 2)
        self.assertEqual(video.launches, 2)

    def test_legacy_geography_ids_are_recorded_under_current_ids(self):
        aliases = {
            'geo_01_01': ('geo_02_01', 'Александр Колчак'),
            'geo_01_02': ('geo_02_02', 'Пётр Козлов'),
            'geo_01_03': ('geo_02_03', 'Николай Миклухо-Маклай'),
            'geo_01_04': ('geo_02_04', 'Константин Романов'),
            'geo_01_05': ('geo_02_06', 'Юлий Шокальский'),
            'geo_01_06': ('geo_02_05', 'Пётр Семёнов Тян-Шанский'),
        }

        for index, (legacy_id, (current_id, title)) in enumerate(aliases.items()):
            with self.subTest(legacy_id=legacy_id):
                response = self.post_event(
                    'start',
                    session_id=f'legacy-geography-{index}',
                    video_id=legacy_id,
                )
                self.assertEqual(response.status_code, 200)
                self.assertFalse(Video.objects.filter(video_id=legacy_id).exists())
                video = Video.objects.get(video_id=current_id)
                self.assertEqual(video.title, title)
                self.assertEqual(video.launches, 1)

    def test_obsolete_location_is_rejected_and_not_recreated(self):
        response = self.post_event(
            'start',
            session_id='obsolete-location',
            location_name='CDH',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Location.objects.filter(name='CDH').exists())


class DailyVideoStatisticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        user = get_user_model().objects.create_user('stats-reader', password='test-only')
        self.client.force_authenticate(user=user)
        self.location = Location.objects.create(name='VDNH')
        self.device = Device.objects.create(client_id='11', location=self.location)
        self.russia = Video.objects.create(video_id='russia', title='Россия')
        self.volga = Video.objects.create(video_id='volga', title='Течет река Волга')
        self.url = reverse('daily-video-stats')

    def create_session(self, session_id, video, status, started_at):
        session = PlaybackSession.objects.create(
            session_id=session_id,
            location=self.location,
            device=self.device,
            video=video,
            status=status,
        )
        PlaybackSession.objects.filter(pk=session.pk).update(started_at=started_at)

    def test_groups_three_event_days_in_moscow_time(self):
        self.create_session(
            'day-1-viewed',
            self.russia,
            PlaybackSession.Status.VIEWED,
            datetime(2026, 8, 27, 22, 30, tzinfo=datetime_timezone.utc),
        )
        self.create_session(
            'day-2-abandoned',
            self.russia,
            PlaybackSession.Status.ABANDONED,
            datetime(2026, 8, 28, 21, 30, tzinfo=datetime_timezone.utc),
        )
        self.create_session(
            'day-3-short',
            self.volga,
            PlaybackSession.Status.SHORT,
            datetime(2026, 8, 30, 20, 59, tzinfo=datetime_timezone.utc),
        )
        self.create_session(
            'outside-period',
            self.volga,
            PlaybackSession.Status.VIEWED,
            datetime(2026, 8, 30, 21, 0, tzinfo=datetime_timezone.utc),
        )

        response = self.client.get(self.url, {
            'location': 'VDNH',
            'start_date': '2026-08-28',
            'end_date': '2026-08-30',
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['timezone'], 'Europe/Moscow')
        self.assertEqual(
            response.data['days'],
            [
                {'date': '2026-08-28', 'launches': 1, 'abandoned': 0, 'viewed': 1},
                {'date': '2026-08-29', 'launches': 1, 'abandoned': 1, 'viewed': 0},
                {'date': '2026-08-30', 'launches': 1, 'abandoned': 0, 'viewed': 0},
            ],
        )
        self.assertEqual(
            response.data['total'],
            {'launches': 3, 'abandoned': 1, 'viewed': 1},
        )
        videos = {video['video_id']: video for video in response.data['videos']}
        self.assertEqual(videos['russia']['total'], {
            'launches': 2,
            'abandoned': 1,
            'viewed': 1,
        })
        self.assertEqual(videos['volga']['days']['2026-08-30'], {
            'launches': 1,
            'abandoned': 0,
            'viewed': 0,
        })

    def test_rejects_invalid_or_excessive_period(self):
        missing = self.client.get(self.url)
        reversed_period = self.client.get(self.url, {
            'start_date': '2026-08-30',
            'end_date': '2026-08-28',
        })
        excessive = self.client.get(self.url, {
            'start_date': '2026-08-01',
            'end_date': '2026-09-01',
        })

        self.assertEqual(missing.status_code, 400)
        self.assertEqual(reversed_period.status_code, 400)
        self.assertEqual(excessive.status_code, 400)
