from django.utils import timezone
import secrets
import uuid
from django.conf import settings
import requests
from .models import Category, Movie, Order, OrderItem, PaidFilm, PaymentToken
from rest_framework import viewsets, permissions, status
from .serializers import CategorySerializer, MovieSerializer, OrderSerializer
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
import hashlib
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from decimal import Decimal
import logging
from django.http import Http404
from django.http import HttpResponse, Http404

logger = logging.getLogger('database')

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    permission_classes = {
        permissions.AllowAny
    }
    serializer_class = CategorySerializer

class MovieViewSet(viewsets.ModelViewSet):
    queryset = Movie.objects.all()
    permission_classes = {
        permissions.AllowAny
    }
    serializer_class = MovieSerializer

class PaymentViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['post'])
    def create_order(self, request):
        try:
            user_id = request.data.get('user_id')
            description = request.data.get('description', 'Оплата за просмотр фильмов')
            films_data = request.data.get('films', [])
            
            if not user_id or not films_data:
                return Response(
                    {"error": "Необходимо указать user_id и список фильмов"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            total_amount = Decimal('0.00')
            validated_films = []
            
            for film_item in films_data:
                film_id = film_item.get('film_id')
                is_series = film_item.get('series', False)
                
                if not film_id:
                    continue
                    
                if not is_series:
                    try:
                        film = Category.objects.get(film_id=film_id)
                        price = Decimal(str(film.price))
                        validated_films.append({
                            'film_id': film_id,
                            'is_series': False,
                            'price': price
                        })
                        total_amount += price
                    except Category.DoesNotExist:
                        continue
                else:
                    try:
                        film = Movie.objects.get(film_id=film_id)
                        price = Decimal(str(film.price))
                        validated_films.append({
                            'film_id': film_id,
                            'is_series': True,
                            'price': price
                        })
                        total_amount += price
                    except Movie.DoesNotExist:
                        continue
            
            if not validated_films:
                return Response(
                    {"error": "Не найдено ни одного действительного фильма"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
            order = Order.objects.create(
                user_id=user_id,
                amount=total_amount,
                description=description,
                order_id=str(uuid.uuid4()),
                status='created'
            )
        
            for film in validated_films:
                OrderItem.objects.create(
                    order=order,
                    film_id=film['film_id'],
                    is_series=film['is_series'],
                    price=film['price']
                )
            
            return Response({
                'order_id': order.order_id,
                'amount': float(total_amount),
                'films': validated_films
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.exception(f"Ошибка при создании заказа: {str(e)}")
            return Response(
                {"error": f"Внутренняя ошибка сервера: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['post'])
    @csrf_exempt
    def payment_callback(self, request):
        try:
            data = request.data
            logger.info("PayKeeper Callback получен: %s", data)

            secret_seed = '_lB0Y3tZg13UsC}e3U'
            payment_id = data.get('id')
            amount_str = data.get('sum')
            client_id = data.get('clientid')
            order_id = data.get('orderid')
            key = data.get('key')

            if not all([payment_id, amount_str, order_id, key, secret_seed]):
                logger.error("PayKeeper Callback: отсутствуют необходимые параметры в запросе")
                return Response({"error": "Какие-то параметры утеряны"}, status=status.HTTP_400_BAD_REQUEST)

            try:
                amount = Decimal(amount_str)
                logger.debug(f"PayKeeper Callback: сумма платежа {amount} для заказа {order_id}")
            except (ValueError, TypeError):
                logger.error(f"PayKeeper Callback: неправильный формат суммы: {amount_str}")
                return HttpResponse("Неверный формат суммы", status=400)

            string_to_hash = f"{payment_id}{amount}{client_id or ''}{order_id or ''}{secret_seed}"
            expected_key = hashlib.md5(string_to_hash.encode('utf-8')).hexdigest()

            if key != expected_key:
                logger.error(
                    "PayKeeper Callback: хэш не совпадает. Ожидали: %s, Получили: %s, параметры: %s",
                    expected_key, key, data
                )
                return HttpResponse("Неверный ключ безопасности", status=400)

            try:
                order = get_object_or_404(Order, order_id=order_id)
                logger.info(f"PayKeeper Callback: успешно получили заказ: {order}")
            except Http404:
                logger.error(f"PayKeeper Callback: заказ не найден для order_id: {order_id}")
                return HttpResponse("Заказ не найден", status=404)

            if order.amount != amount:
                logger.error(
                    f"PayKeeper Callback: суммы не совпадают для заказа {order_id}. Ожидалось: {order.amount}, Получено: {amount}"
                )
                return HttpResponse("Суммы не совпадают", status=400)

            if order.status == 'paid':
                logger.warning(f"PayKeeper Callback: платеж уже был обработан для заказа {order_id}")
                response_hash = hashlib.md5((payment_id + secret_seed).encode('utf-8')).hexdigest()
                return HttpResponse(f"OK {response_hash}", content_type="text/plain")

            logger.info(f"PayKeeper Callback: статус заказа {order_id} до обновления: {order.status}")

            try:
                order.status = 'paid'
                order.payment_id = payment_id
                order.save()
                logger.info(f"PayKeeper Callback: статус заказа {order_id} обновлен на 'paid', payment_id: {payment_id}")
                
                response_hash = hashlib.md5((payment_id + secret_seed).encode('utf-8')).hexdigest()
                response = HttpResponse(f"OK {response_hash}", content_type="text/plain")
                
            except Exception as save_error:
                logger.exception(f"PayKeeper Callback: критическая ошибка при сохранении статуса заказа: {save_error}")
                return HttpResponse(f"Ошибка сохранения статуса заказа: {str(save_error)}", status=500)

            try:
                expires_at = timezone.now() + timezone.timedelta(hours=2)
                token_string = secrets.token_hex(32)
                
                logger.info(f"PayKeeper Callback: создаем токен доступа для заказа {order_id}")
                payment_token = PaymentToken.objects.create(
                    token=token_string,
                    order=order,
                    expires_at=expires_at
                )
                logger.info(f"PayKeeper Callback: токен {token_string} создан для заказа {order_id}")
                
                order_items = OrderItem.objects.filter(order=order)
                logger.info(f"PayKeeper Callback: найдено {order_items.count()} элементов в заказе {order_id}")
                
                for item in order_items:
                    paid_film = PaidFilm.objects.create(
                        token=payment_token,
                        film_id=item.film_id,
                        is_series=item.is_series,
                        price=item.price
                    )
                    logger.info(f"PayKeeper Callback: создана запись об оплаченном фильме {item.film_id} для заказа {order_id}")
                    
                    try:
                        if '/' in order.user_id:
                            location_id, device_id = order.user_id.split('/')
                            logger.info(f"PayKeeper Callback: отправка статистики для фильма {item.film_id}, локация {location_id}")
                            
                            response = requests.post(
                                f"{settings.STAT_API_URL}record_view/", 
                                json={
                                    'location_id': location_id,
                                    'movie_id': item.film_id
                                },
                                timeout=5  
                            )
                            
                            if response.status_code == 200:
                                logger.info(f"PayKeeper Callback: статистика успешно отправлена для фильма {item.film_id}")
                            else:
                                logger.warning(f"PayKeeper Callback: ошибка при отправке статистики, код: {response.status_code}")
                        else:
                            logger.warning(f"PayKeeper Callback: неверный формат user_id: {order.user_id}")
                    except requests.RequestException as req_error:
                        logger.error(f"PayKeeper Callback: ошибка запроса при отправке статистики: {req_error}")
                    except Exception as stat_error:
                        logger.error(f"PayKeeper Callback: ошибка при записи статистики: {stat_error}")
                
                logger.info(f"PayKeeper Callback: заказ {order_id} полностью обработан, токен {token_string}")
                
            except Exception as additional_error:
                logger.exception(f"PayKeeper Callback: некритическая ошибка при дополнительной обработке: {additional_error}")
            return response

        except Exception as e:
            logger.exception(f"PayKeeper Callback: непредвиденная ошибка: {str(e)}")
            return HttpResponse(f"Internal Server Error: {str(e)}", status=500)



class PaymentStatusViewSet(viewsets.ViewSet):
    @action(detail=False, methods=['get'])
    def status(self, request):
        order_id = request.query_params.get('order_id')

        if not order_id:
            return Response({'error': 'order_id обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = get_object_or_404(Order, order_id=order_id)
            logger.info(f"Payment status {order_id}: {order.status}")
            if order.status == 'paid':
                return Response({'status': 'success'}, status=status.HTTP_200_OK)
            elif order.status == 'checked':
                return Response({'status': 'checked'}, status=status.HTTP_200_OK)
            else:
                return Response({'status': 'fail'}, status=status.HTTP_200_OK)
        except Order.DoesNotExist:
            logger.error(f"Order {order_id} not found")
            return Response({'status': 'fail', 'error': 'Заказ не найден'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'])  
    def checked(self, request):
        order_id = request.query_params.get('order_id')

        if not order_id:
            return Response({'error': 'order_id обязателен'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order = get_object_or_404(Order, order_id=order_id)
            if order.status == 'paid': 
                order.status = 'checked'
                order.save()
                logger.info(f"Order {order_id} статус обнволен 'checked'")
                return Response({'status': 'success'}, status=status.HTTP_200_OK)
            else:
                 logger.warning(f"{order_id} не может быть обновлен на 'checked' его статус {order.status}")
                 return Response({'status': 'fail', 'error': f"Не удается обновить {order_id} НА checked"}, status=status.HTTP_400_BAD_REQUEST)
        except Order.DoesNotExist:
            logger.error(f"Order {order_id} не найден")
            return Response({'status': 'fail', 'error': 'Заказ не найден'}, status=status.HTTP_404_NOT_FOUND)





class TokenViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    


    @action(detail=False, methods=['get'])
    def get_token_by_order(self, request):
        order_id = request.query_params.get('order_id')
        current_token = request.query_params.get('current_token')
        
        if not order_id:
            return Response({"error": "ID заказа не указан"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = Order.objects.get(order_id=order_id)
            try:
                new_payment_token = PaymentToken.objects.get(order=order)
                
                if current_token:
                    try:
                        old_token = PaymentToken.objects.get(token=current_token)
                        

                        if old_token.is_valid():
                            old_paid_films = PaidFilm.objects.filter(token=old_token)
                            
                            for old_film in old_paid_films:
                                existing_film = PaidFilm.objects.filter(
                                    token=new_payment_token,
                                    film_id=old_film.film_id,
                                    is_series=old_film.is_series
                                ).first()
                                
                                if not existing_film:
                                    PaidFilm.objects.create(
                                        token=new_payment_token,
                                        film_id=old_film.film_id,
                                        is_series=old_film.is_series,
                                        price=old_film.price
                                    )
                                    logger.info(f"Перенесен фильм {old_film.film_id} из токена {current_token} в токен {new_payment_token.token}")
                            
                            old_token.delete()
                            logger.info(f"Старый токен {current_token} удален после переноса фильмов")
                            
                    except PaymentToken.DoesNotExist:
                        logger.warning(f"Старый токен {current_token} не найден или уже удален")
                    except Exception as e:
                        logger.error(f"Ошибка при объединении токенов: {str(e)}")
                
                return Response({
                    "valid": new_payment_token.is_valid(),
                    "token": new_payment_token.token,
                    "expires_at": new_payment_token.expires_at.isoformat()
                }, status=status.HTTP_200_OK)
                    
            except PaymentToken.DoesNotExist:
                return Response({
                    "valid": False,
                    "error": "Токен не найден для этого заказа"
                }, status=status.HTTP_200_OK)
                
        except Order.DoesNotExist:
            return Response({
                "valid": False,
                "error": "Заказ не найден"
            }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['get'])
    def validate(self, request):
        token_string = request.query_params.get('token')
        film_id = request.query_params.get('film_id')
        
        if not token_string:
            return Response({"error": "Токен не указан"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            token = PaymentToken.objects.get(token=token_string)
            
            if not token.is_valid():
                return Response({
                    "valid": False,
                    "error": "Срок действия токена истек или токен недействителен"
                }, status=status.HTTP_200_OK)
                
            if film_id:
                film_exists = PaidFilm.objects.filter(token=token, film_id=film_id).exists()
                
                return Response({
                    "valid": film_exists,
                    "token_valid": True,
                    "film_valid": film_exists,
                    "expires_at": token.expires_at.isoformat()
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "valid": True,
                    "expires_at": token.expires_at.isoformat()
                }, status=status.HTTP_200_OK)
                
        except PaymentToken.DoesNotExist:
            return Response({
                "valid": False,
                "error": "Токен не найден"
            }, status=status.HTTP_200_OK)
            
    @action(detail=False, methods=['get'])
    def get_films(self, request):
        token_string = request.query_params.get('token')
        
        if not token_string:
            return Response({"error": "Токен не указан"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            token = PaymentToken.objects.get(token=token_string)
            
            if not token.is_valid():
                return Response({
                    "valid": False,
                    "error": "Срок действия токена истек или токен недействителен"
                }, status=status.HTTP_200_OK)
                
            paid_films = PaidFilm.objects.filter(token=token)
            films_data = []
            
            for paid_film in paid_films:
                try:
                    if paid_film.is_series:
                        film = Movie.objects.get(film_id=paid_film.film_id)
                    else:
                        film = Category.objects.get(film_id=paid_film.film_id)
                    
                    film_data = {
                        "film_id": paid_film.film_id,
                        "is_series": paid_film.is_series,
                        "name": film.name,
                        "name_short": film.name_short,
                        "description": film.description,
                        "year": film.year,
                        "country": film.country,
                        "time": film.time,
                        "format": film.format,
                        "price": float(paid_film.price),
                        "image": film.image.url if film.image else None,
                        "queueImg": film.queueImg.url if hasattr(film, 'queueImg') and film.queueImg else None
                    }
                    films_data.append(film_data)
                except (Category.DoesNotExist, Movie.DoesNotExist):
                    continue
            
            return Response({
                "valid": True,
                "token": token_string,
                "expires_at": token.expires_at.isoformat(),
                "films": films_data
            }, status=status.HTTP_200_OK)
                
        except PaymentToken.DoesNotExist:
            return Response({
                "valid": False,
                "error": "Токен не найден"
            }, status=status.HTTP_200_OK)


    @action(detail=False, methods=['post'])
    def enter_token(self, request):
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"ENTER TOKEN REQUEST")
        logger.info(f"Request data: {request.data}")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Content type: {request.content_type}")
        
        token_string = request.data.get('token')
        logger.info(f"Извлеченный токен: '{token_string}'")
        
        if not token_string:
            logger.error("Токен не указан в запросе")
            return Response({
                "valid": False,
                "error": "Токен не указан"
            }, status=status.HTTP_200_OK)  
            
        try:
            logger.info(f"Поиск токена в базе данных: {token_string}")
            token = PaymentToken.objects.get(token=token_string)
            logger.info(f"Токен найден: {token}, expires_at: {token.expires_at}, is_active: {token.is_active}")
            
            if not token.is_valid():
                logger.warning(f"Токен недействителен: is_active={token.is_active}, expires_at={token.expires_at}")
                return Response({
                    "valid": False,
                    "error": "Срок действия токена истек или токен недействителен"
                }, status=status.HTTP_200_OK)  
            
            logger.info(f"Токен действителен, получаем связанные фильмы")
            paid_films = PaidFilm.objects.filter(token=token)
            logger.info(f"Найдено {paid_films.count()} оплаченных фильмов")
            
            films_data = []
            
            for paid_film in paid_films:
                try:
                    logger.info(f"Обрабатываем фильм: {paid_film.film_id}, is_series: {paid_film.is_series}")
                    film = None
                    if not paid_film.is_series:
                        film = Category.objects.get(film_id=paid_film.film_id)
                        logger.info(f"Фильм из Category найден: {film.name}")
                    else:
                        film = Movie.objects.get(film_id=paid_film.film_id)
                        logger.info(f"Фильм из Movie найден: {film.name}")
                    
                    film_data = {
                        "film_id": paid_film.film_id,
                        "is_series": paid_film.is_series,
                        "name": film.name,
                        "name_short": film.name_short,
                        "description": film.description,
                        "year": film.year,
                        "country": film.country,
                        "time": film.time,
                        "format": film.format,
                        "price": float(paid_film.price),
                        "image": film.image.url if film.image else None,
                        "queueImg": film.queueImg.url if hasattr(film, 'queueImg') and film.queueImg else None
                    }
                    films_data.append(film_data)
                    logger.info(f"Фильм {paid_film.film_id} успешно добавлен в список")
                except (Category.DoesNotExist, Movie.DoesNotExist) as e:
                    logger.warning(f"Фильм {paid_film.film_id} не найден в базе: {str(e)}")
                    continue
                except Exception as e:
                    logger.error(f"Ошибка при обработке фильма {paid_film.film_id}: {str(e)}")
                    continue
            
            logger.info(f"Возвращаем {len(films_data)} фильмов")
            return Response({
                "valid": True,
                "expires_at": token.expires_at.isoformat(),
                "films": films_data
            }, status=status.HTTP_200_OK)
                
        except PaymentToken.DoesNotExist:
            logger.error(f"Токен {token_string} не найден в базе данных")
            return Response({
                "valid": False,
                "error": "Токен не найден"
            }, status=status.HTTP_200_OK) 
        except Exception as e:
            logger.exception(f"Неожиданная ошибка при обработке токена: {str(e)}")
            return Response({
                "valid": False,
                "error": f"Внутренняя ошибка сервера: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]  # TODO: Add proper admin permissions
    
    @action(detail=False, methods=['get'])
    def search_orders(self, request):
        """Search orders by order_id (supports partial match)"""
        search_query = request.query_params.get('q', '').strip()
        
        if not search_query:
            # Return recent orders if no search query
            orders = Order.objects.all().order_by('-created_at')[:20]
        else:
            # Search by order_id (partial match)
            orders = Order.objects.filter(order_id__icontains=search_query).order_by('-created_at')[:50]
        
        orders_data = []
        for order in orders:
            # Check if token exists for this order
            token_info = None
            try:
                payment_token = PaymentToken.objects.get(order=order)
                token_info = {
                    'exists': True,
                    'token': payment_token.token,
                    'expires_at': payment_token.expires_at.isoformat(),
                    'is_valid': payment_token.is_valid()
                }
            except PaymentToken.DoesNotExist:
                token_info = {'exists': False}
            
            # Get order items
            order_items = OrderItem.objects.filter(order=order)
            items_data = []
            for item in order_items:
                try:
                    if item.is_series:
                        film = Movie.objects.get(film_id=item.film_id)
                    else:
                        film = Category.objects.get(film_id=item.film_id)
                    
                    items_data.append({
                        'film_id': item.film_id,
                        'is_series': item.is_series,
                        'name': film.name,
                        'price': float(item.price)
                    })
                except (Category.DoesNotExist, Movie.DoesNotExist):
                    items_data.append({
                        'film_id': item.film_id,
                        'is_series': item.is_series,
                        'name': f'Film {item.film_id} (не найден)',
                        'price': float(item.price)
                    })
            
            orders_data.append({
                'order_id': order.order_id,
                'order_id_short': order.order_id[:8],  # First 8 characters for display
                'user_id': order.user_id,
                'amount': float(order.amount),
                'status': order.status,
                'description': order.description,
                'created_at': order.created_at.isoformat(),
                'payment_id': order.payment_id,
                'token_info': token_info,
                'items': items_data
            })
        
        return Response({
            'orders': orders_data,
            'total_found': len(orders_data)
        }, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['post'])
    def confirm_payment_and_issue_token(self, request):
        """Manually confirm payment and issue token for order (for cases when payment callback failed)"""
        order_id = request.data.get('order_id')
        
        if not order_id:
            return Response({
                'success': False,
                'error': 'order_id обязателен'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            order = Order.objects.get(order_id=order_id)
            
            # Check if token already exists
            existing_token = None
            try:
                existing_token = PaymentToken.objects.get(order=order)
                return Response({
                    'success': False,
                    'error': 'Токен уже существует для этого заказа',
                    'existing_token': {
                        'token': existing_token.token,
                        'expires_at': existing_token.expires_at.isoformat(),
                        'is_valid': existing_token.is_valid()
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
            except PaymentToken.DoesNotExist:
                pass  # Good, no existing token
            
            # If order is not paid yet, mark it as paid first
            if order.status != 'paid':
                order.status = 'paid'
                order.payment_id = f'admin_confirmed_{timezone.now().strftime("%Y%m%d_%H%M%S")}'
                order.save()
                logger.info(f"Admin: заказ {order_id} вручную помечен как оплаченный")
            
            # Create new token
            expires_at = timezone.now() + timezone.timedelta(hours=2)
            token_string = secrets.token_hex(32)
            
            logger.info(f"Admin: создаем токен доступа для заказа {order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at
            )
            
            # Create PaidFilm entries for all order items
            order_items = OrderItem.objects.filter(order=order)
            created_films = []
            
            for item in order_items:
                paid_film = PaidFilm.objects.create(
                    token=payment_token,
                    film_id=item.film_id,
                    is_series=item.is_series,
                    price=item.price
                )
                created_films.append({
                    'film_id': item.film_id,
                    'is_series': item.is_series,
                    'price': float(item.price)
                })
                logger.info(f"Admin: создана запись об оплаченном фильме {item.film_id} для заказа {order_id}")
            
            logger.info(f"Admin: токен {token_string} создан для заказа {order_id}")
            
            return Response({
                'success': True,
                'message': 'Платеж подтвержден и токен создан',
                'order_status_updated': order.status == 'paid',
                'token_info': {
                    'token': token_string,
                    'expires_at': expires_at.isoformat(),
                    'films_count': len(created_films)
                },
                'films': created_films
            }, status=status.HTTP_201_CREATED)
            
        except Order.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Заказ не найден'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Admin: ошибка при создании токена для заказа {order_id}: {str(e)}")
            return Response({
                'success': False,
                'error': f'Внутренняя ошибка сервера: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'])
    def issue_token(self, request):
        """Issue token for already paid order"""
        order_id = request.data.get('order_id')
        
        if not order_id:
            return Response({
                'success': False,
                'error': 'order_id обязателен'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            order = Order.objects.get(order_id=order_id)
            
            # Check if order is paid
            if order.status != 'paid':
                return Response({
                    'success': False,
                    'error': f'Заказ должен быть в статусе "paid", текущий статус: {order.status}. Используйте "Подтвердить и выдать токен" для неоплаченных заказов.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if token already exists
            existing_token = None
            try:
                existing_token = PaymentToken.objects.get(order=order)
                return Response({
                    'success': False,
                    'error': 'Токен уже существует для этого заказа',
                    'existing_token': {
                        'token': existing_token.token,
                        'expires_at': existing_token.expires_at.isoformat(),
                        'is_valid': existing_token.is_valid()
                    }
                }, status=status.HTTP_400_BAD_REQUEST)
            except PaymentToken.DoesNotExist:
                pass  # Good, no existing token
            
            # Create new token
            expires_at = timezone.now() + timezone.timedelta(hours=2)
            token_string = secrets.token_hex(32)
            
            logger.info(f"Admin: создаем токен доступа для заказа {order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at
            )
            
            # Create PaidFilm entries for all order items
            order_items = OrderItem.objects.filter(order=order)
            created_films = []
            
            for item in order_items:
                paid_film = PaidFilm.objects.create(
                    token=payment_token,
                    film_id=item.film_id,
                    is_series=item.is_series,
                    price=item.price
                )
                created_films.append({
                    'film_id': item.film_id,
                    'is_series': item.is_series,
                    'price': float(item.price)
                })
                logger.info(f"Admin: создана запись об оплаченном фильме {item.film_id} для заказа {order_id}")
            
            logger.info(f"Admin: токен {token_string} создан для заказа {order_id}")
            
            return Response({
                'success': True,
                'message': 'Токен успешно создан',
                'token_info': {
                    'token': token_string,
                    'expires_at': expires_at.isoformat(),
                    'films_count': len(created_films)
                },
                'films': created_films
            }, status=status.HTTP_201_CREATED)
            
        except Order.DoesNotExist:
            return Response({
                'success': False,
                'error': 'Заказ не найден'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.exception(f"Admin: ошибка при создании токена для заказа {order_id}: {str(e)}")
            return Response({
                'success': False,
                'error': f'Внутренняя ошибка сервера: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
