from django.db import migrations


CANONICAL_ID = 'volga'
LEGACY_IDS = ('volga_2',)
CANONICAL_TITLE = 'Течет река Волга'


def merge_volga_video_alias(apps, schema_editor):
    Video = apps.get_model('statisticsDatabase', 'Video')
    PlaybackSession = apps.get_model('statisticsDatabase', 'PlaybackSession')

    videos = list(
        Video.objects.filter(video_id__in=(CANONICAL_ID, *LEGACY_IDS)).order_by('id')
    )
    if not videos:
        return

    # Keep the oldest row so existing dashboard ordering remains stable. All
    # sessions are moved before duplicate rows are removed, so no history is lost.
    primary = videos[0]
    duplicates = videos[1:]
    historical_views = sum(video.views for video in videos)

    if duplicates:
        duplicate_ids = [video.pk for video in duplicates]
        PlaybackSession.objects.filter(video_id__in=duplicate_ids).update(
            video_id=primary.pk,
        )
        Video.objects.filter(pk__in=duplicate_ids).delete()

    sessions = PlaybackSession.objects.filter(video_id=primary.pk)
    Video.objects.filter(pk=primary.pk).update(
        video_id=CANONICAL_ID,
        title=CANONICAL_TITLE,
        views=historical_views,
        launches=sessions.count(),
        abandoned=sessions.filter(status='abandoned').count(),
        viewed=sessions.filter(status='viewed').count(),
    )


class Migration(migrations.Migration):

    dependencies = [
        ('statisticsDatabase', '0004_merge_headset_id_aliases'),
    ]

    operations = [
        migrations.RunPython(
            merge_volga_video_alias,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
