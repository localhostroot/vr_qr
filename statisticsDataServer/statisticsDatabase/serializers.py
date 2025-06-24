from rest_framework import serializers
from .models import Category, Video, Location, Device
from django.contrib.auth import authenticate


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

    class Meta:
        model = Location
        fields = '__all__'

    def get_todays_views(self, obj):
        return obj.get_todays_views() 


class DeviceSerializer(serializers.ModelSerializer):
    location = LocationSerializer(read_only=True)

    class Meta:
        model = Device
        fields = '__all__'


class StatisticsSerializer(serializers.Serializer):
    client_id = serializers.CharField(max_length=255)
    location_name = serializers.CharField(max_length=255)
    video_id = serializers.CharField(max_length=255)


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
