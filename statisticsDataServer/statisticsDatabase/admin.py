from django.contrib import admin
from .models import Category, Video, Location, Device, PlaybackSession


admin.site.register(Category)
admin.site.register(Video)
admin.site.register(Location)
admin.site.register(Device)
admin.site.register(PlaybackSession)
