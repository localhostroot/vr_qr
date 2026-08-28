from django.db import migrations


def normalize_numeric_viewer_ids(apps, schema_editor):
    Order = apps.get_model('database', 'Order')

    for order in Order.objects.all().only('id', 'user_id').iterator():
        viewer_id = str(order.user_id or '').strip()
        if '/' not in viewer_id:
            continue

        location, headset_id = viewer_id.rsplit('/', 1)
        location = location.strip()
        headset_id = headset_id.strip()
        if not headset_id.isdecimal():
            continue

        normalized = f'{location}/{int(headset_id)}'
        if normalized != order.user_id:
            Order.objects.filter(pk=order.pk).update(user_id=normalized)


class Migration(migrations.Migration):
    dependencies = [
        ('database', '0015_order_viewer_session_id'),
    ]

    operations = [
        migrations.RunPython(normalize_numeric_viewer_ids, migrations.RunPython.noop),
    ]
