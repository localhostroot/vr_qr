# Generated by Django 5.1.3 on 2025-02-25 14:51

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0003_alter_category_description'),
    ]

    operations = [
        migrations.AddField(
            model_name='movie',
            name='route_id',
            field=models.CharField(default='123', max_length=50),
        ),
    ]
