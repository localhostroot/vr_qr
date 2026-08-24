from django.db import models
from django.utils import timezone


class Category(models.Model):
    name = models.CharField(max_length=255, unique=True)
    views = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name


class Video(models.Model):
    video_id = models.CharField(max_length=255, unique=True)
    img = models.ImageField(upload_to='videos/images/', blank=True, null=True)
    title = models.CharField(max_length=255)
    views = models.PositiveIntegerField(default=0)
    launches = models.PositiveIntegerField(default=0)
    abandoned = models.PositiveIntegerField(default=0)
    viewed = models.PositiveIntegerField(default=0)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, related_name='videos', null=True, blank=True)

    def __str__(self):
        return self.title


class Location(models.Model):
    name = models.CharField(max_length=255, unique=True)
    views = models.PositiveIntegerField(default=0)
    launches = models.PositiveIntegerField(default=0)
    abandoned = models.PositiveIntegerField(default=0)
    viewed = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def get_todays_views(self):
        return self.get_todays_viewed()

    def get_todays_launches(self):
        return self.playback_sessions.filter(started_at__date=timezone.localdate()).count()

    def get_todays_abandoned(self):
        return self.playback_sessions.filter(
            started_at__date=timezone.localdate(),
            status=PlaybackSession.Status.ABANDONED,
        ).count()

    def get_todays_viewed(self):
        return self.playback_sessions.filter(
            started_at__date=timezone.localdate(),
            status=PlaybackSession.Status.VIEWED,
        ).count()


class Device(models.Model):
    client_id = models.CharField(max_length=255)
    location = models.ForeignKey('Location', on_delete=models.CASCADE, related_name='devices')
    views = models.PositiveIntegerField(default=0)
    launches = models.PositiveIntegerField(default=0)
    abandoned = models.PositiveIntegerField(default=0)
    viewed = models.PositiveIntegerField(default=0)
    views_today = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client_id', 'location') 

    def __str__(self):
        return f"{self.client_id} - {self.location.name}"


class PlaybackSession(models.Model):
    class Status(models.TextChoices):
        STARTED = 'started', 'Запущен'
        SHORT = 'short', '20 секунд или меньше'
        ABANDONED = 'abandoned', 'Брошен'
        VIEWED = 'viewed', 'Просмотрен'
        UNCLASSIFIED = 'unclassified', 'Недостаточно данных'

    session_id = models.CharField(max_length=64, unique=True)
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name='playback_sessions',
    )
    device = models.ForeignKey(
        Device,
        on_delete=models.CASCADE,
        related_name='playback_sessions',
    )
    video = models.ForeignKey(
        Video,
        on_delete=models.CASCADE,
        related_name='playback_sessions',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STARTED,
    )
    max_playback_position = models.FloatField(default=0)
    duration = models.FloatField(null=True, blank=True)
    played_seconds = models.FloatField(default=0)
    end_reason = models.CharField(max_length=64, blank=True, default='')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-started_at',)

    def __str__(self):
        return f"{self.location.name}:{self.device.client_id} / {self.video.video_id} / {self.status}"
