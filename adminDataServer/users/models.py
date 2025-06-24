from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    pass


class UserProfile(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='profile')
    location = models.CharField(max_length=255, blank=True, null=True, verbose_name="Локация для конфига")
    location_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Название локации")

    def __str__(self):
        return self.user.username


class Video(models.Model):
    title = models.CharField(max_length=255)
    video_id = models.CharField(max_length=255, unique=True)
    image = models.ImageField(upload_to='videos/images/')
    timer = models.CharField(max_length=255, default='10:00')

    def __str__(self):
        return self.title


class Location(models.Model):
    name = models.CharField(max_length=255, verbose_name="Название локации", unique=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Локация"
        verbose_name_plural = "Локации"


class Movie(models.Model):
    title = models.CharField(max_length=255, verbose_name="Название фильма")
    image = models.ImageField(upload_to='movies/images')
    film_id = models.CharField(max_length=255, verbose_name="id фильма")

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = "Фильм"
        verbose_name_plural = "Фильмы"


class MovieViewCounter(models.Model):
    location = models.ForeignKey(Location, on_delete=models.CASCADE, verbose_name="Локация")
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE, verbose_name="Фильм")
    date = models.DateField(default=timezone.now, verbose_name="Дата")
    views_count = models.IntegerField(default=0, verbose_name="Количество просмотров")

    class Meta:
        verbose_name = "Счетчик просмотров фильма"
        verbose_name_plural = "Счетчики просмотров фильмов"
        unique_together = ('location', 'movie', 'date')

    def __str__(self):
        return f"{self.movie.title} - {self.location.name} - {self.date} - Просмотров: {self.views_count}"
