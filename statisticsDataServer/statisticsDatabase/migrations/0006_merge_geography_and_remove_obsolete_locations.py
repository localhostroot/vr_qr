from django.db import migrations


ACTIVE_LOCATION_NAME = 'VDNH'

GEOGRAPHY_VIDEOS = (
    ('geo_02_01', 'Александр Колчак', ('geo_01_01',)),
    ('geo_02_02', 'Пётр Козлов', ('geo_01_02',)),
    ('geo_02_03', 'Николай Миклухо-Маклай', ('geo_01_03',)),
    ('geo_02_04', 'Константин Романов', ('geo_01_04',)),
    ('geo_02_05', 'Пётр Семёнов Тян-Шанский', ('geo_01_06',)),
    ('geo_02_06', 'Юлий Шокальский', ('geo_01_05',)),
)


def _merge_video_group(Video, PlaybackSession, canonical_id, title, legacy_ids):
    videos = list(
        Video.objects.filter(
            video_id__in=(canonical_id, *legacy_ids),
        ).order_by('id')
    )
    if not videos:
        return

    primary = videos[0]
    duplicates = videos[1:]
    historical_views = sum(video.views for video in videos)

    if duplicates:
        duplicate_ids = [video.pk for video in duplicates]
        PlaybackSession.objects.filter(video_id__in=duplicate_ids).update(
            video_id=primary.pk,
        )
        Video.objects.filter(pk__in=duplicate_ids).delete()

    Video.objects.filter(pk=primary.pk).update(
        video_id=canonical_id,
        title=title,
        views=historical_views,
    )


def _sync_counters(objects, PlaybackSession, relation_field):
    for obj in objects.iterator():
        sessions = PlaybackSession.objects.filter(**{relation_field: obj.pk})
        type(obj).objects.filter(pk=obj.pk).update(
            launches=sessions.count(),
            abandoned=sessions.filter(status='abandoned').count(),
            viewed=sessions.filter(status='viewed').count(),
        )


def merge_geography_and_remove_obsolete_locations(apps, schema_editor):
    Video = apps.get_model('statisticsDatabase', 'Video')
    Location = apps.get_model('statisticsDatabase', 'Location')
    Device = apps.get_model('statisticsDatabase', 'Device')
    PlaybackSession = apps.get_model('statisticsDatabase', 'PlaybackSession')

    for canonical_id, title, legacy_ids in GEOGRAPHY_VIDEOS:
        _merge_video_group(
            Video,
            PlaybackSession,
            canonical_id,
            title,
            legacy_ids,
        )

    Location.objects.exclude(name__iexact=ACTIVE_LOCATION_NAME).delete()
    Location.objects.filter(name__iexact=ACTIVE_LOCATION_NAME).update(
        name=ACTIVE_LOCATION_NAME,
    )

    _sync_counters(Video.objects.all(), PlaybackSession, 'video_id')
    _sync_counters(Device.objects.all(), PlaybackSession, 'device_id')
    _sync_counters(Location.objects.all(), PlaybackSession, 'location_id')


class Migration(migrations.Migration):

    dependencies = [
        ('statisticsDatabase', '0005_merge_volga_video_alias'),
    ]

    operations = [
        migrations.RunPython(
            merge_geography_and_remove_obsolete_locations,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
