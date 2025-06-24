import logging

from django.conf import settings
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile, Video


logger = logging.getLogger(__name__)


class LoginRequestSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(max_length=128, write_only=True)


class LoginResponseSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=255)
    is_staff = serializers.BooleanField()
    is_superuser = serializers.BooleanField()
    location = serializers.CharField(max_length=255, allow_null=True, required=False)

    def to_representation(self, instance):
        return instance


User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('location', 'location_name')


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = ('username', 'password', 'email', 'first_name', 'last_name', 'profile')
        extra_kwargs = {
            'password': {'write_only': True},
            'email': {'required': False},
            'first_name': {'required': False},
            'last_name': {'required': False},
        }

    def create(self, validated_data):
        profile_data = validated_data.pop('profile')
        password = validated_data.pop('password')
        user = User.objects.create(**validated_data)
        user.set_password(password)
        user.save()

        profile, created = UserProfile.objects.get_or_create(user=user, defaults=profile_data)

        return user


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()

    class Meta:
        model = User
        fields = (
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'is_staff',
            'is_superuser',
            'is_active',
            'profile',
        )


class UserUpdateSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer()
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ('username', 'password', 'is_active', 'profile')

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        password = validated_data.pop('password', None)

        instance.username = validated_data.get('username', instance.username)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        if password:
            instance.set_password(password)

        instance.save()

        if profile_data:
            profile = instance.profile
            profile.location_name = profile_data.get('location_name', profile.location_name)
            profile.location = profile_data.get('location', profile.location)
            profile.save()

        return instance


class VideoSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(max_length=None, use_url=True)

    class Meta:
        model = Video
        fields = ('id', 'title', 'video_id', 'image', 'timer')


class CreateVideoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Video
        fields = ('title', 'video_id', 'image', 'timer')


class MovieStatsSerializer(serializers.Serializer):
    movie_id = serializers.IntegerField(source='movie__id')
    movie_title = serializers.CharField(source='movie__title')
    movie_image = serializers.SerializerMethodField()
    total_views = serializers.IntegerField()

    def get_movie_image(self, obj):
        relative_path = obj['movie__image']
        return self.context['request'].build_absolute_uri(settings.MEDIA_URL + relative_path)


