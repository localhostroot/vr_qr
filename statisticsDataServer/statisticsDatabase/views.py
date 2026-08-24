from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F
from .models import Category, Video, Location, Device, PlaybackSession
from .serializers import CategorySerializer, VideoSerializer, LocationSerializer, DeviceSerializer, StatisticsSerializer, LoginSerializer, CreateVideoWithCategorySerializer
from rest_framework.authtoken.models import Token
from django.utils import timezone
from rest_framework.exceptions import ValidationError

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_total_stats(request):
    sessions = PlaybackSession.objects.all()
    today_sessions = sessions.filter(started_at__date=timezone.localdate())

    total_launches = sessions.count()
    total_abandoned = sessions.filter(status=PlaybackSession.Status.ABANDONED).count()
    total_viewed = sessions.filter(status=PlaybackSession.Status.VIEWED).count()
    todays_launches = today_sessions.count()
    todays_abandoned = today_sessions.filter(status=PlaybackSession.Status.ABANDONED).count()
    todays_viewed = today_sessions.filter(status=PlaybackSession.Status.VIEWED).count()

    return Response({
        'total_launches': total_launches,
        'total_abandoned': total_abandoned,
        'total_viewed': total_viewed,
        'todays_launches': todays_launches,
        'todays_abandoned': todays_abandoned,
        'todays_viewed': todays_viewed,
        # Compatibility for clients which have not switched to the new names yet.
        'total_views': total_viewed,
        'todays_views': todays_viewed,
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
        event = serializer.validated_data['event']
        session_id = serializer.validated_data['session_id']
        client_id = serializer.validated_data['client_id']
        location_name = serializer.validated_data['location_name']
        video_id = serializer.validated_data['video_id']
        playback_position = serializer.validated_data.get('playback_position', 0)
        duration = serializer.validated_data.get('duration')
        played_seconds = serializer.validated_data.get('played_seconds', 0)
        end_reason = serializer.validated_data.get('end_reason', '')

        with transaction.atomic():
            location, _ = Location.objects.get_or_create(name=location_name)
            device, _ = Device.objects.get_or_create(client_id=client_id, location=location)
            video, _ = Video.objects.get_or_create(video_id=video_id, defaults={'title': video_id})

            playback_session, created = PlaybackSession.objects.select_for_update().get_or_create(
                session_id=session_id,
                defaults={
                    'location': location,
                    'device': device,
                    'video': video,
                    'max_playback_position': playback_position,
                    'duration': duration if duration and duration > 0 else None,
                    'played_seconds': played_seconds,
                },
            )

            if (
                playback_session.location_id != location.id
                or playback_session.device_id != device.id
                or playback_session.video_id != video.id
            ):
                return Response(
                    {'error': 'session_id уже используется другим сеансом'},
                    status=status.HTTP_409_CONFLICT,
                )

            if created:
                _increment_counter((location, device, video), 'launches')

            if event == 'start':
                return Response({
                    'message': 'Оплаченный запуск записан.',
                    'created': created,
                    'status': playback_session.status,
                }, status=status.HTTP_200_OK)

            if playback_session.status != PlaybackSession.Status.STARTED:
                return Response({
                    'message': 'Итог сеанса уже записан.',
                    'created': False,
                    'status': playback_session.status,
                }, status=status.HTTP_200_OK)

            playback_session.max_playback_position = max(
                playback_session.max_playback_position,
                playback_position,
            )
            playback_session.played_seconds = max(
                playback_session.played_seconds,
                played_seconds,
            )
            if duration and duration > 0:
                playback_session.duration = duration
            playback_session.end_reason = end_reason
            playback_session.finished_at = timezone.now()
            playback_session.status = _classify_playback(playback_session)
            playback_session.save(update_fields=(
                'max_playback_position',
                'duration',
                'played_seconds',
                'end_reason',
                'finished_at',
                'status',
            ))

            if playback_session.status == PlaybackSession.Status.ABANDONED:
                _increment_counter((location, device, video), 'abandoned')
            elif playback_session.status == PlaybackSession.Status.VIEWED:
                _increment_counter((location, device, video), 'viewed')

        return Response({
            'message': 'Итог оплаченного сеанса записан.',
            'created': created,
            'status': playback_session.status,
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _increment_counter(objects, field_name):
    for instance in objects:
        type(instance).objects.filter(pk=instance.pk).update(
            **{field_name: F(field_name) + 1},
        )


def _classify_playback(playback_session):
    duration = playback_session.duration
    if duration and duration > 0:
        watched_fraction = playback_session.max_playback_position / duration
        if watched_fraction >= 0.5:
            return PlaybackSession.Status.VIEWED
        if playback_session.played_seconds > 20:
            return PlaybackSession.Status.ABANDONED

    if playback_session.played_seconds <= 20:
        return PlaybackSession.Status.SHORT

    return PlaybackSession.Status.UNCLASSIFIED


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
