# Generated by Django 5.1.3 on 2025-03-10 13:22

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0008_alter_category_queueimg_alter_movie_queueimg'),
    ]

    operations = [
        migrations.AlterField(
            model_name='category',
            name='description',
            field=models.CharField(default='Описание', max_length=500),
        ),
        migrations.AlterField(
            model_name='movie',
            name='description',
            field=models.CharField(max_length=500),
        ),
    ]
