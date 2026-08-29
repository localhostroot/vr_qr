from rest_framework import serializers
from .models import Category, Video, Location, Device
from django.contrib.auth import authenticate
from .viewer_identity import normalize_headset_id


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class VideoSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)

    class Meta:
        model = Video
        fields = '__all__'
        read_only_fields = ['views']


class CreateVideoWithCategorySerializer(serializers.Serializer):
    video_id = serializers.CharField(max_length=255)
    img = serializers.ImageField(required=False)
    title = serializers.CharField(max_length=255)
    category_name = serializers.CharField(max_length=255)


class LocationSerializer(serializers.ModelSerializer):
    todays_views = serializers.SerializerMethodField()
    todays_launches = serializers.SerializerMethodField()
    todays_abandoned = serializers.SerializerMethodField()
    todays_viewed = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = '__all__'

    def get_todays_views(self, obj):
        return obj.get_todays_views()

    def get_todays_launches(self, obj):
        return obj.get_todays_launches()

    def get_todays_abandoned(self, obj):
        return obj.get_todays_abandoned()

    def get_todays_viewed(self, obj):
        return obj.get_todays_viewed()


class DeviceSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)

    class Meta:
        model = Device
        fields = '__all__'


class StatisticsSerializer(serializers.Serializer):
    event = serializers.ChoiceField(choices=('start', 'finish'))
    session_id = serializers.CharField(max_length=64)
    client_id = serializers.CharField(max_length=255)
    location_name = serializers.CharField(max_length=255)
    video_id = serializers.CharField(max_length=255)
    playback_position = serializers.FloatField(required=False, min_value=0, default=0)
    duration = serializers.FloatField(required=False, allow_null=True, min_value=0)
    played_seconds = serializers.FloatField(required=False, min_value=0, default=0)
    end_reason = serializers.CharField(required=False, allow_blank=True, max_length=64, default='')

    def validate_client_id(self, value):
        return normalize_headset_id(value)


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        if username and password:
            user = authenticate(username=username, password=password)
            if user:
                if user.is_active:
                    data['user'] = user
                else:
                    raise serializers.ValidationError("Аккаунт пользователя отключен.")
            else:
                raise serializers.ValidationError("Неверные учетные данные.")
        else:
            raise serializers.ValidationError("Необходимо указать имя пользователя и пароль.")

        return data
