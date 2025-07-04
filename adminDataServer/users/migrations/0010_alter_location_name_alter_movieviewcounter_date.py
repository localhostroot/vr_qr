# Generated by Django 5.1.7 on 2025-04-22 14:21

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_movieviewcounter_delete_movieview'),
    ]

    operations = [
        migrations.AlterField(
            model_name='location',
            name='name',
            field=models.CharField(max_length=255, unique=True, verbose_name='Название локации'),
        ),
        migrations.AlterField(
            model_name='movieviewcounter',
            name='date',
            field=models.DateField(default=django.utils.timezone.now, verbose_name='Дата'),
        ),
    ]
