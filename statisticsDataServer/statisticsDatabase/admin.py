from django.contrib import admin
from .models import Category, Video, Location, Device


admin.site.register(Category)
admin.site.register(Video)
admin.site.register(Location)
admin.site.register(Device)
