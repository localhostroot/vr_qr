from django.urls import path
from . import views

urlpatterns = [
    path('categories/', views.CategoryList.as_view(), name='category-list'),
    path('videos/', views.VideoList.as_view(), name='video-list'),
    path('locations/', views.LocationList.as_view(), name='location-list'),
    path('devices/', views.DeviceList.as_view(), name='device-list'),
    path('update_statistics/', views.update_statistics, name='update-statistics'),
    path('login/', views.login_view, name='login'),
    path('total_stats/', views.get_total_stats, name='total-stats'),
    path('create_video_with_category/', views.create_video_with_category, name='create-video-with-category'),
]
