# Generated by Django 5.1.3 on 2025-04-10 10:21

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0010_order'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='film_id',
            field=models.CharField(default='russia', max_length=100),
        ),
    ]
