import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('statisticsDatabase', '0002_alter_device_client_id_alter_device_unique_together'),
    ]

    operations = [
        migrations.AddField(
            model_name='device',
            name='abandoned',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='device',
            name='launches',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='device',
            name='viewed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='location',
            name='abandoned',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='location',
            name='launches',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='location',
            name='viewed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='video',
            name='abandoned',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='video',
            name='launches',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='video',
            name='viewed',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.CreateModel(
            name='PlaybackSession',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('session_id', models.CharField(max_length=64, unique=True)),
                ('status', models.CharField(choices=[('started', 'Запущен'), ('short', '20 секунд или меньше'), ('abandoned', 'Брошен'), ('viewed', 'Просмотрен'), ('unclassified', 'Недостаточно данных')], default='started', max_length=20)),
                ('max_playback_position', models.FloatField(default=0)),
                ('duration', models.FloatField(blank=True, null=True)),
                ('played_seconds', models.FloatField(default=0)),
                ('end_reason', models.CharField(blank=True, default='', max_length=64)),
                ('started_at', models.DateTimeField(auto_now_add=True)),
                ('finished_at', models.DateTimeField(blank=True, null=True)),
                ('device', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playback_sessions', to='statisticsDatabase.device')),
                ('location', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playback_sessions', to='statisticsDatabase.location')),
                ('video', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='playback_sessions', to='statisticsDatabase.video')),
            ],
            options={'ordering': ('-started_at',)},
        ),
    ]
