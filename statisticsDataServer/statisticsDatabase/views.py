from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, F, Q
from django.db.models.functions import TruncDate
from .models import Category, Video, Location, Device, PlaybackSession
from .serializers import CategorySerializer, VideoSerializer, LocationSerializer, DeviceSerializer, StatisticsSerializer, LoginSerializer, CreateVideoWithCategorySerializer
from rest_framework.authtoken.models import Token
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.exceptions import ValidationError
from .video_identity import canonical_video_title
from datetime import datetime, time, timedelta, timezone as datetime_timezone
from zoneinfo import ZoneInfo


REPORT_TIME_ZONE = ZoneInfo('Europe/Moscow')
MAX_DAILY_REPORT_DAYS = 31

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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_daily_video_stats(request):
    start_date = parse_date(request.query_params.get('start_date', ''))
    end_date = parse_date(request.query_params.get('end_date', ''))
    location_name = str(request.query_params.get('location', 'VDNH')).strip().upper()

    if start_date is None or end_date is None:
        return Response(
            {'error': 'Укажите start_date и end_date в формате YYYY-MM-DD.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if end_date < start_date:
        return Response(
            {'error': 'end_date не может быть раньше start_date.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if (end_date - start_date).days + 1 > MAX_DAILY_REPORT_DAYS:
        return Response(
            {'error': f'Период не может превышать {MAX_DAILY_REPORT_DAYS} день.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if location_name != 'VDNH':
        return Response(
            {'error': 'Доступна статистика только для действующей площадки VDNH.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    start_at = datetime.combine(start_date, time.min, tzinfo=REPORT_TIME_ZONE)
    end_at = datetime.combine(
        end_date + timedelta(days=1),
        time.min,
        tzinfo=REPORT_TIME_ZONE,
    )
    sessions = PlaybackSession.objects.filter(
        location__name=location_name,
        started_at__gte=start_at.astimezone(datetime_timezone.utc),
        started_at__lt=end_at.astimezone(datetime_timezone.utc),
    )
    grouped = sessions.annotate(
        report_day=TruncDate('started_at', tzinfo=REPORT_TIME_ZONE),
    ).values(
        'report_day',
        'video_id',
        'video__video_id',
        'video__title',
    ).annotate(
        launches=Count('id'),
        abandoned=Count('id', filter=Q(status=PlaybackSession.Status.ABANDONED)),
        viewed=Count('id', filter=Q(status=PlaybackSession.Status.VIEWED)),
    ).order_by('video_id', 'report_day')

    day_keys = []
    day_totals = {}
    cursor = start_date
    while cursor <= end_date:
        day_key = cursor.isoformat()
        day_keys.append(day_key)
        day_totals[day_key] = {'launches': 0, 'abandoned': 0, 'viewed': 0}
        cursor += timedelta(days=1)

    videos_by_id = {}
    grand_total = {'launches': 0, 'abandoned': 0, 'viewed': 0}
    for row in grouped:
        day_key = row['report_day'].isoformat()
        metrics = {
            'launches': row['launches'],
            'abandoned': row['abandoned'],
            'viewed': row['viewed'],
        }
        video = videos_by_id.setdefault(row['video_id'], {
            'video_id': row['video__video_id'],
            'title': row['video__title'],
            'days': {
                key: {'launches': 0, 'abandoned': 0, 'viewed': 0}
                for key in day_keys
            },
            'total': {'launches': 0, 'abandoned': 0, 'viewed': 0},
        })
        video['days'][day_key] = metrics
        for field in grand_total:
            video['total'][field] += metrics[field]
            day_totals[day_key][field] += metrics[field]
            grand_total[field] += metrics[field]

    return Response({
        'location': location_name,
        'timezone': str(REPORT_TIME_ZONE),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'days': [
            {'date': day_key, **day_totals[day_key]}
            for day_key in day_keys
        ],
        'videos': list(videos_by_id.values()),
        'total': grand_total,
    })


class CategoryList(generics.ListAPIView):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class VideoList(generics.ListAPIView):
    serializer_class = VideoSerializer

    def get_queryset(self):
        category = self.request.query_params.get('category')
        title = self.request.query_params.get('title')

        queryset = Video.objects.filter(
            playback_sessions__isnull=False,
        ).distinct().order_by('id')
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
            video, _ = Video.objects.get_or_create(
                video_id=video_id,
                defaults={'title': canonical_video_title(video_id)},
            )

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
