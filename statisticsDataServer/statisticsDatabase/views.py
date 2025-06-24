from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db.models import Sum
from .models import Category, Video, Location, Device
from .serializers import CategorySerializer, VideoSerializer, LocationSerializer, DeviceSerializer, StatisticsSerializer, LoginSerializer, CreateVideoWithCategorySerializer
from rest_framework.authtoken.models import Token
from django.utils import timezone
from rest_framework.exceptions import ValidationError

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_total_stats(request):

    total_views = Video.objects.aggregate(total_views=Sum('views'))['total_views'] or 0
    today = timezone.now().date()
    todays_views = Device.objects.filter(views_today__date=today).aggregate(todays_views=Sum('views'))['todays_views'] or 0

    return Response({
        'total_views': total_views,
        'todays_views': todays_views,
    })


class CategoryList(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class VideoList(generics.ListAPIView):
    serializer_class = VideoSerializer

    def get_queryset(self):
        category = self.request.query_params.get('category')
        title = self.request.query_params.get('title')

        queryset = Video.objects.all()
        if category:
            queryset = queryset.filter(category__name=category)

        if title:
            queryset = queryset.filter(title__icontains=title)

        return queryset


class LocationList(generics.ListAPIView):
    queryset = Location.objects.all()
    serializer_class = LocationSerializer


class DeviceList(generics.ListAPIView):
    serializer_class = DeviceSerializer

    def get_queryset(self):
        location_id = self.request.query_params.get('location') 

        if not location_id:
            raise ValidationError({"location": "Это поле обязательно."})  

        try:
            location_id = int(location_id)
        except ValueError:
             raise ValidationError({"location": "Неправильное id локации."})

        return Device.objects.filter(location_id=location_id)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_video_with_category(request):
    serializer = CreateVideoWithCategorySerializer(data=request.data)
    if serializer.is_valid():
        category_name = serializer.validated_data['category_name']
        video_data = {**serializer.validated_data}
        del video_data['category_name']
        category, created = Category.objects.get_or_create(name=category_name)
        video = Video.objects.create(category=category, **video_data)
        return Response({"message": "Видео икатегория были успешно созданы."}, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def update_statistics(request):
    serializer = StatisticsSerializer(data=request.data)
    if serializer.is_valid():
        client_id = serializer.validated_data['client_id']
        location_name = serializer.validated_data['location_name']
        video_id = serializer.validated_data['video_id']

        location, created = Location.objects.get_or_create(name=location_name)
        if created:
            print(f"Создана локация: {location_name}")

        device, created = Device.objects.get_or_create(client_id=client_id, location=location)
        if created:
            print(f"Создан девайс: {client_id}")

        video, created = Video.objects.get_or_create(video_id=video_id, defaults={'title': video_id})
        if created:
            print(f"Создано видео: {video_id}")

        location.views += 1
        location.save()

        device.views += 1
        device.views_today = timezone.now()
        device.save()

        video.views += 1
        video.save()

        return Response({"message": "Статистика успешно обновлена."}, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'username': user.username,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'token': token.key,
        }, status=status.HTTP_200_OK)
    else:
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
