import traceback
from datetime import datetime

from django.conf import settings
from django.db import DatabaseError, DataError, IntegrityError, transaction
from django.db.models import Count, F, Sum
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.decorators import api_view, permission_classes
from .serializers import LoginRequestSerializer, LoginResponseSerializer, User, MovieStatsSerializer
import logging
from rest_framework import generics, permissions
from .serializers import (UserCreateSerializer, UserSerializer, UserUpdateSerializer, VideoSerializer,
                          CreateVideoSerializer)
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import NotFound
from .models import Video, Location, Movie, MovieViewCounter
from django.contrib.auth import authenticate, login
from rest_framework.authtoken.models import Token

logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    logger.info(f"Получен запрос на логин: {request.data}")
    serializer = LoginRequestSerializer(data=request.data)
    if serializer.is_valid():
        username = serializer.validated_data.get('username')
        password = serializer.validated_data.get('password')

        user = authenticate(request, username=username, password=password)

        if user is not None:
            logger.info(f"Логин прошел для пользователя: {user.username}")

            token, created = Token.objects.get_or_create(user=user) 
            response_data = {
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'token': token.key, 
                'location': user.profile.location if hasattr(user, 'profile') and hasattr(user.profile, 'location') else None,
            }
            response_serializer = LoginResponseSerializer(response_data)
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        else:
            logger.warning(f"Неверные учетные данные для пользователя: {username}")
            return Response({'error': 'Неверные учетные данные'}, status=status.HTTP_400_BAD_REQUEST)
    else:
        logger.warning(f"Сериализатор не валиден: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserCreateView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer

    def update(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)

            if getattr(instance, '_prefetched_objects_cache', None):
                instance._prefetched_objects_cache = {}

            return Response(serializer.data)
        except NotFound:
            return Response(status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except NotFound:
            return Response(status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class VideoList(generics.ListAPIView):
    queryset = Video.objects.all()
    serializer_class = VideoSerializer
    permission_classes = (permissions.IsAuthenticated,)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_video(request):
    serializer = CreateVideoSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def record_movie_view(request):
    location_name = request.data.get('location_id')
    movie_id = request.data.get('movie_id')

    if not location_name or not movie_id:
        return Response({"error": "Необходимо указать location_id и movie_id"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        location = Location.objects.get(name=location_name)
    except Location.DoesNotExist:
        try:
            location = Location.objects.create(name=location_name)
            print(f"Создана новая локация: name={location.name}, id={location.id}")
        except IntegrityError as e:
            logger.error(f"Ошибка IntegrityError при создании локации: {str(e)}\n{traceback.format_exc()}")
            return Response({"error": f"Ошибка при создании локации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except DataError as e:
            logger.error(f"Ошибка DataError при создании локации: {str(e)}\n{traceback.format_exc()}")
            return Response({"error": f"Ошибка при создании локации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except DatabaseError as e:
            logger.error(f"Ошибка DatabaseError при создании локации: {str(e)}\n{traceback.format_exc()}")
            return Response({"error": f"Ошибка при создании локации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            logger.error(f"Неизвестная ошибка при создании локации: {str(e)}\n{traceback.format_exc()}")
            return Response({"error": f"Ошибка при создании локации: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    try:
        movie = Movie.objects.get(film_id=movie_id)
    except Movie.DoesNotExist:
        return Response({"error": f"Фильм с ID {movie_id} не найден"}, status=status.HTTP_404_NOT_FOUND)

    try:
        with transaction.atomic():
            counter, created = MovieViewCounter.objects.get_or_create(
                location=location,
                movie=movie,
                date=timezone.now().date(),
                defaults={'views_count': 0}
            )
            counter.views_count = F('views_count') + 1
            counter.save()
            counter.refresh_from_db()

            return Response({"message": "Счетчик просмотров увеличен", "views_count": counter.views_count}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Ошибка при обновлении счетчика просмотров: {str(e)}\n{traceback.format_exc()}")
        return Response({"error": f"Ошибка при обновлении счетчика просмотров: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_movie_view_stats(request):
    location_name = request.query_params.get('location_id')
    start_date_str = request.query_params.get('start_date')
    end_date_str = request.query_params.get('end_date')

    try:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date() if start_date_str else None
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else None
    except ValueError:
        return Response({"error": "Неверный формат даты. Надо YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    queryset = MovieViewCounter.objects.all()

    if location_name:
        queryset = queryset.filter(location__name=location_name)

    if start_date:
        queryset = queryset.filter(date__gte=start_date)

    if end_date:
        queryset = queryset.filter(date__lte=end_date)
    movie_stats = (queryset.values('movie__id', 'movie__title', 'movie__image').annotate(total_views=Sum('views_count'))
                   .order_by('-total_views'))

    serializer = MovieStatsSerializer(movie_stats, many=True, context={'request': request})
    return Response(serializer.data)
