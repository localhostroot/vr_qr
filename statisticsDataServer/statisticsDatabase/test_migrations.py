from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class HeadsetIdentityMigrationTests(TransactionTestCase):
    migrate_from = ('statisticsDatabase', '0003_playback_sessions')
    migrate_to = ('statisticsDatabase', '0004_merge_headset_id_aliases')

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        Location = old_apps.get_model('statisticsDatabase', 'Location')
        Device = old_apps.get_model('statisticsDatabase', 'Device')
        Video = old_apps.get_model('statisticsDatabase', 'Video')
        PlaybackSession = old_apps.get_model('statisticsDatabase', 'PlaybackSession')

        location = Location.objects.create(name='VDNH')
        video = Video.objects.create(video_id='film-1', title='Film 1')
        padded = Device.objects.create(
            location=location,
            client_id='08',
            views=2,
            launches=6,
            viewed=5,
            abandoned=0,
        )
        canonical = Device.objects.create(
            location=location,
            client_id='8',
            views=3,
            launches=7,
            viewed=5,
            abandoned=1,
        )
        PlaybackSession.objects.create(
            session_id='padded-session',
            location=location,
            device=padded,
            video=video,
        )
        PlaybackSession.objects.create(
            session_id='canonical-session',
            location=location,
            device=canonical,
            video=video,
        )

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def test_aliases_are_merged_without_losing_sessions_or_counters(self):
        Device = self.apps.get_model('statisticsDatabase', 'Device')
        PlaybackSession = self.apps.get_model('statisticsDatabase', 'PlaybackSession')

        devices = Device.objects.filter(location__name='VDNH')
        self.assertEqual(devices.count(), 1)
        device = devices.get()
        self.assertEqual(device.client_id, '8')
        self.assertEqual(device.views, 5)
        self.assertEqual(device.launches, 13)
        self.assertEqual(device.viewed, 10)
        self.assertEqual(device.abandoned, 1)
        self.assertEqual(PlaybackSession.objects.filter(device_id=device.pk).count(), 2)
