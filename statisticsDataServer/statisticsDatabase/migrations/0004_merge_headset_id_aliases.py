from collections import defaultdict
import re

from django.db import migrations


COUNTER_FIELDS = ('views', 'launches', 'abandoned', 'viewed')


def normalize_headset_id(value):
    headset_id = str(value or '').strip()
    if not re.fullmatch(r'[0-9]+', headset_id):
        return headset_id
    return re.sub(r'^0+(?=\d)', '', headset_id)


def merge_headset_id_aliases(apps, schema_editor):
    Device = apps.get_model('statisticsDatabase', 'Device')
    PlaybackSession = apps.get_model('statisticsDatabase', 'PlaybackSession')
    groups = defaultdict(list)

    for device in Device.objects.all().order_by('location_id', 'id'):
        raw_id = str(device.client_id or '').strip()
        if re.fullmatch(r'[0-9]+', raw_id):
            canonical_id = normalize_headset_id(raw_id)
            groups[(device.location_id, canonical_id)].append(device)

    for (_location_id, canonical_id), devices in groups.items():
        primary = next(
            (device for device in devices if device.client_id == canonical_id),
            devices[0],
        )
        duplicates = [device for device in devices if device.pk != primary.pk]
        totals = {
            field: sum(getattr(device, field, 0) for device in devices)
            for field in COUNTER_FIELDS
        }

        if duplicates:
            duplicate_ids = [device.pk for device in duplicates]
            PlaybackSession.objects.filter(device_id__in=duplicate_ids).update(
                device_id=primary.pk,
            )
            Device.objects.filter(pk__in=duplicate_ids).delete()

        Device.objects.filter(pk=primary.pk).update(
            client_id=canonical_id,
            **totals,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('statisticsDatabase', '0003_playback_sessions'),
    ]

    operations = [
        migrations.RunPython(
            merge_headset_id_aliases,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
