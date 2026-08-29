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


class VideoIdentityMigrationTests(TransactionTestCase):
    migrate_from = ('statisticsDatabase', '0004_merge_headset_id_aliases')
    migrate_to = ('statisticsDatabase', '0005_merge_volga_video_alias')

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
        device = Device.objects.create(location=location, client_id='11')
        legacy = Video.objects.create(
            video_id='volga_2',
            title='Течет река Волга',
            views=2,
        )
        canonical = Video.objects.create(
            video_id='volga',
            title='volga',
            views=3,
            launches=99,
            abandoned=99,
            viewed=99,
        )
        PlaybackSession.objects.create(
            session_id='legacy-volga-session',
            location=location,
            device=device,
            video=legacy,
            status='viewed',
        )
        PlaybackSession.objects.create(
            session_id='canonical-volga-session',
            location=location,
            device=device,
            video=canonical,
            status='abandoned',
        )

        self.oldest_video_pk = legacy.pk
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def test_aliases_merge_into_one_canonical_video_without_losing_sessions(self):
        Video = self.apps.get_model('statisticsDatabase', 'Video')
        PlaybackSession = self.apps.get_model('statisticsDatabase', 'PlaybackSession')

        self.assertFalse(Video.objects.filter(video_id='volga_2').exists())
        video = Video.objects.get(video_id='volga')
        self.assertEqual(video.pk, self.oldest_video_pk)
        self.assertEqual(video.title, 'Течет река Волга')
        self.assertEqual(video.views, 5)
        self.assertEqual(video.launches, 2)
        self.assertEqual(video.abandoned, 1)
        self.assertEqual(video.viewed, 1)
        self.assertEqual(PlaybackSession.objects.filter(video_id=video.pk).count(), 2)


class GeographyAndLocationMigrationTests(TransactionTestCase):
    migrate_from = ('statisticsDatabase', '0005_merge_volga_video_alias')
    migrate_to = (
        'statisticsDatabase',
        '0006_merge_geography_and_remove_obsolete_locations',
    )

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        Location = old_apps.get_model('statisticsDatabase', 'Location')
        Device = old_apps.get_model('statisticsDatabase', 'Device')
        Video = old_apps.get_model('statisticsDatabase', 'Video')
        PlaybackSession = old_apps.get_model('statisticsDatabase', 'PlaybackSession')

        vdnh = Location.objects.create(
            name='VDNH',
            launches=999,
            abandoned=999,
            viewed=999,
        )
        obsolete = Location.objects.create(name='CDH')
        vdnh_device = Device.objects.create(
            location=vdnh,
            client_id='11',
            launches=999,
            abandoned=999,
            viewed=999,
        )
        obsolete_device = Device.objects.create(location=obsolete, client_id='1')

        geography = (
            ('geo_01_01', 'geo_02_01', 'Александр Колчак'),
            ('geo_01_02', 'geo_02_02', 'Пётр Козлов'),
            ('geo_01_03', 'geo_02_03', 'Николай Миклухо-Маклай'),
            ('geo_01_04', 'geo_02_04', 'Константин Романов'),
            ('geo_01_06', 'geo_02_05', 'Пётр Семёнов Тян-Шанский'),
            ('geo_01_05', 'geo_02_06', 'Юлий Шокальский'),
        )

        self.oldest_video_pks = {}
        for index, (legacy_id, current_id, title) in enumerate(geography):
            legacy = Video.objects.create(
                video_id=legacy_id,
                title=title,
                views=1,
            )
            current = Video.objects.create(
                video_id=current_id,
                title=title,
                views=2,
                launches=999,
                abandoned=999,
                viewed=999,
            )
            PlaybackSession.objects.create(
                session_id=f'geography-{index}',
                location=vdnh,
                device=vdnh_device,
                video=current,
                status='viewed',
            )
            self.oldest_video_pks[current_id] = legacy.pk

        obsolete_video = Video.objects.create(
            video_id='obsolete-location-film',
            title='Obsolete location film',
            launches=99,
            abandoned=99,
            viewed=99,
        )
        PlaybackSession.objects.create(
            session_id='obsolete-location-session',
            location=obsolete,
            device=obsolete_device,
            video=obsolete_video,
            status='abandoned',
        )

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def test_geography_is_merged_locations_are_pruned_and_counters_are_synced(self):
        Location = self.apps.get_model('statisticsDatabase', 'Location')
        Device = self.apps.get_model('statisticsDatabase', 'Device')
        Video = self.apps.get_model('statisticsDatabase', 'Video')
        PlaybackSession = self.apps.get_model('statisticsDatabase', 'PlaybackSession')

        self.assertEqual(list(Location.objects.values_list('name', flat=True)), ['VDNH'])
        self.assertFalse(Device.objects.filter(location__name='CDH').exists())
        self.assertFalse(
            PlaybackSession.objects.filter(session_id='obsolete-location-session').exists(),
        )

        for index in range(1, 7):
            current_id = f'geo_02_0{index}'
            self.assertFalse(Video.objects.filter(video_id=f'geo_01_0{index}').exists())
            video = Video.objects.get(video_id=current_id)
            self.assertEqual(video.pk, self.oldest_video_pks[current_id])
            self.assertEqual(video.views, 3)
            self.assertEqual(video.launches, 1)
            self.assertEqual(video.abandoned, 0)
            self.assertEqual(video.viewed, 1)

        vdnh = Location.objects.get(name='VDNH')
        device = Device.objects.get(location=vdnh, client_id='11')
        self.assertEqual(vdnh.launches, 6)
        self.assertEqual(vdnh.abandoned, 0)
        self.assertEqual(vdnh.viewed, 6)
        self.assertEqual(device.launches, 6)
        self.assertEqual(device.abandoned, 0)
        self.assertEqual(device.viewed, 6)

        obsolete_video = Video.objects.get(video_id='obsolete-location-film')
        self.assertEqual(obsolete_video.launches, 0)
        self.assertEqual(obsolete_video.abandoned, 0)
        self.assertEqual(obsolete_video.viewed, 0)
