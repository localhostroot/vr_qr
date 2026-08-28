from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('database', '0014_paymenttoken_headset_session_active'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='viewer_session_id',
            field=models.UUIDField(blank=True, db_index=True, null=True),
        ),
    ]
