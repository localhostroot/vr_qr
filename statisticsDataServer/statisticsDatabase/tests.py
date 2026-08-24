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
            'location_name': 'CDH',
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
            Location.objects.get(name='CDH'),
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
