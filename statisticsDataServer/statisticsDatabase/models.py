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
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, related_name='videos', null=True, blank=True)

    def __str__(self):
        return self.title


class Location(models.Model):
    name = models.CharField(max_length=255, unique=True)
    views = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def get_todays_views(self):
        today = timezone.now().date()
        total_views = self.devices.filter(views_today__date=today).aggregate(total=models.Sum('views'))['total']
        return total_views or 0


class Device(models.Model):
    client_id = models.CharField(max_length=255)
    location = models.ForeignKey('Location', on_delete=models.CASCADE, related_name='devices')
    views = models.PositiveIntegerField(default=0)
    views_today = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('client_id', 'location') 

    def __str__(self):
        return f"{self.client_id} - {self.location.name}"
