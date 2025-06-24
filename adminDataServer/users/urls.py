from django.urls import path
from . import views

urlpatterns = [
    path('auth/login/', views.login_view, name='login'),
    path('users/create/', views.UserCreateView.as_view(), name='user-create'),
    path('users/list/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserDetailView.as_view(), name='user-detail'),
    path('videos/', views.VideoList.as_view(), name='video-list'),
    path('create_video/', views.create_video, name='create-video'),
    path('record_view/', views.record_movie_view, name='record_movie_view'),
    path('movie_stats/', views.get_movie_view_stats, name='movie_view_stats'),
]
