from django.db import migrations, models
from django.utils import timezone


def restore_unexpired_entitlements(apps, schema_editor):
    PaymentToken = apps.get_model('database', 'PaymentToken')

    # Before this migration the presence timeout used is_active as a session
    # flag. Keep those old leases closed so another visitor cannot inherit
    # them, but restore still-live confirmed purchases for the browser that
    # owns the random token/order id.
    previously_deactivated = PaymentToken.objects.filter(is_active=False)
    previously_deactivated.update(headset_session_active=False)
    previously_deactivated.filter(
        expires_at__gt=timezone.now(),
        order__status__in=('paid', 'checked'),
    ).update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0013_bundle_prices'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymenttoken',
            name='headset_session_active',
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(
            restore_unexpired_entitlements,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
