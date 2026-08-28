from django.utils import timezone
import secrets
import uuid
from django.conf import settings
from django.db import transaction
from django.db.models import Q
import requests
from .models import Category, Movie, Order, OrderItem, PaidFilm, PaymentToken
from rest_framework import viewsets, permissions, status
from .serializers import CategorySerializer, MovieSerializer, OrderSerializer
from .payment_provider import PaymentProviderClient, PaymentProviderError
from .payment_processor import PaymentProcessor
from .viewer_identity import normalize_viewer_id
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
from django.utils.dateparse import parse_datetime
import ipaddress

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

    @staticmethod
    def _is_free_viewer(user_id):
        normalized = normalize_viewer_id(user_id).casefold()
        return normalized in {
            normalize_viewer_id(configured_id).casefold()
            for configured_id in settings.FREE_VIEWER_IDS
        }

    @action(detail=False, methods=['get'])
    def free_access_status(self, request):
        user_id = normalize_viewer_id(request.query_params.get('user_id'))
        if not user_id or len(user_id) > 255:
            return Response(
                {"error": "user_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'user_id': user_id,
            'free_access': self._is_free_viewer(user_id),
        })

    @action(detail=False, methods=['post'])
    def create_order(self, request):
        try:
            user_id = normalize_viewer_id(request.data.get('user_id'))
            viewer_session_raw = str(request.data.get('viewer_session_id', '')).strip()
            current_token_string = str(request.data.get('current_token', '')).strip()
            description = request.data.get('description', 'Оплата за просмотр фильмов')
            films_data = request.data.get('films', [])
            
            if not user_id or not films_data:
                return Response(
                    {"error": "Необходимо указать user_id и список фильмов"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            total_amount = Decimal('0.00')
            validated_films = []
            series_groups = {}
            seen_films = set()
            
            for film_item in films_data:
                film_id = film_item.get('film_id')
                is_series = film_item.get('series', False)
                
                if not film_id:
                    continue

                film_key = (bool(is_series), str(film_id))
                if film_key in seen_films:
                    continue
                seen_films.add(film_key)
                    
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
                        film = Movie.objects.select_related('cat_id').get(film_id=film_id)
                        price = Decimal(str(film.price))
                        validated_film = {
                            'film_id': film_id,
                            'is_series': True,
                            'price': price
                        }
                        validated_films.append(validated_film)
                        group = series_groups.setdefault(
                            film.cat_id_id,
                            {'category': film.cat_id, 'films': []},
                        )
                        group['films'].append(validated_film)
                    except Movie.DoesNotExist:
                        continue

            free_access = self._is_free_viewer(user_id)
            applied_bundles = []
            for category_id, group in series_groups.items():
                selected_film_ids = {
                    str(film['film_id']) for film in group['films']
                }
                bundle_film_ids = {
                    str(film_id)
                    for film_id in Movie.objects.filter(
                        cat_id_id=category_id,
                    ).values_list('film_id', flat=True)
                }
                regular_total = sum(
                    (film['price'] for film in group['films']),
                    Decimal('0.00'),
                )

                if bundle_film_ids and selected_film_ids == bundle_film_ids:
                    bundle_price = Decimal(str(group['category'].price))
                    total_amount += bundle_price
                    applied_bundles.append({
                        'cat_id': group['category'].cat_id,
                        'name': group['category'].name_short,
                        'regular_amount': regular_total,
                        'bundle_amount': bundle_price,
                    })
                else:
                    total_amount += regular_total
            
            if not validated_films:
                return Response(
                    {"error": "Не найдено ни одного действительного фильма"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            viewer_session_id = None
            if viewer_session_raw:
                try:
                    viewer_session_id = uuid.UUID(viewer_session_raw)
                except (ValueError, AttributeError):
                    return Response(
                        {"error": "Некорректный идентификатор сессии зрителя"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if current_token_string and len(current_token_string) <= 64:
                current_token = PaymentToken.objects.select_related('order').filter(
                    token=current_token_string,
                    order__user_id=user_id,
                ).first()
                if current_token is not None:
                    if current_token.order.viewer_session_id is not None:
                        # Possession of the existing token is the stronger
                        # proof if browser storage was partially cleared.
                        viewer_session_id = current_token.order.viewer_session_id
                    elif viewer_session_id is not None:
                        current_token.order.viewer_session_id = viewer_session_id
                        current_token.order.save(update_fields=('viewer_session_id',))

            if free_access:
                total_amount = Decimal('0.00')
                applied_bundles = []
                description = 'Бесплатный просмотр'
                for film in validated_films:
                    film['price'] = Decimal('0.00')
        
            order = Order.objects.create(
                user_id=user_id,
                viewer_session_id=viewer_session_id,
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

            if free_access:
                payment_id = f'free:{order.order_id}'
                if not PaymentProcessor.process_successful_payment(
                    order,
                    payment_id,
                    access_duration=timezone.timedelta(
                        hours=settings.FREE_ACCESS_DURATION_HOURS,
                    ),
                    activate_headset_session=True,
                ):
                    order.status = 'payment_error'
                    order.save(update_fields=('status',))
                    return Response(
                        {"error": "Не удалось выдать бесплатный доступ"},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

                # "checked" is the normal terminal state used by all existing
                # access validation paths.  No PayKeeper invoice is created.
                order.status = 'checked'
                order.save(update_fields=('status',))
                payment_token = order.payment_token

                logger.info(
                    "Бесплатный доступ выдан зрителю %s, заказ %s",
                    user_id,
                    order.order_id,
                )
                return Response({
                    'order_id': order.order_id,
                    'amount': 0.0,
                    'films': validated_films,
                    'bundles': [],
                    'free_access': True,
                    'token': payment_token.token,
                    'expires_at': payment_token.expires_at.isoformat(),
                    'viewer_session_id': str(order.viewer_session_id) if order.viewer_session_id else None,
                }, status=status.HTTP_201_CREATED)

            try:
                payment_url = PaymentProviderClient().create_invoice(
                    order_id=order.order_id,
                    amount=total_amount,
                    client_id=user_id,
                    service_name=description,
                    result_callback=settings.PAYMENT_RESULT_URL,
                )
            except PaymentProviderError:
                order.status = 'payment_error'
                order.save(update_fields=('status',))
                logger.warning(
                    "PayKeeper invoice creation failed for order %s",
                    order.order_id,
                )
                return Response(
                    {"error": "Платёжный шлюз временно недоступен. Повторите попытку."},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            order.status = 'pending'
            order.save(update_fields=('status',))

            return Response({
                'order_id': order.order_id,
                'amount': float(total_amount),
                'films': validated_films,
                'bundles': applied_bundles,
                'payment_url': payment_url,
                'viewer_session_id': str(order.viewer_session_id) if order.viewer_session_id else None,
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

            if PaymentProcessor.is_already_processed(order):
                logger.warning(f"PayKeeper Callback: платеж уже был обработан для заказа {order_id}")
                response_hash = hashlib.md5((payment_id + secret_seed).encode('utf-8')).hexdigest()
                return HttpResponse(f"OK {response_hash}", content_type="text/plain")

            logger.info(f"PayKeeper Callback: статус заказа {order_id} до обновления: {order.status}")

            # Use PaymentProcessor to handle the payment
            if PaymentProcessor.process_successful_payment(order, payment_id):
                logger.info(f"PayKeeper Callback: заказ {order_id} успешно обработан")
                response_hash = hashlib.md5((payment_id + secret_seed).encode('utf-8')).hexdigest()
                response = HttpResponse(f"OK {response_hash}", content_type="text/plain")
            else:
                logger.error(f"PayKeeper Callback: ошибка при обработке платежа для заказа {order_id}")
                return HttpResponse("Ошибка обработки платежа", status=500)
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

            # Orders without a PayKeeper invoice must not block a fresh attempt.
            if order.status in ['created', 'payment_error']:
                return Response({'status': 'fail'}, status=status.HTTP_200_OK)

            # Check if the status needs verification
            if order.status not in ['paid', 'checked'] and settings.PAYMENT_VERIFICATION_ENABLED:
                payment_client = PaymentProviderClient()
                payment = payment_client.verify_payment_by_order_id(order_id, search_days=1)
                
                if payment and payment_client.is_payment_successful(payment):
                    logger.info(f"Verified successful payment for order {order_id} from provider")
                    PaymentProcessor.process_successful_payment(order, payment_id=payment.get('id'))
                    return Response({'status': 'success', 'verified': True}, status=status.HTTP_200_OK)
                elif payment and payment_client.is_payment_failed(payment):
                    logger.info(
                        "PayKeeper reported terminal status %s for order %s",
                        payment.get('status'),
                        order_id,
                    )
                    order.status = 'payment_error'
                    order.save(update_fields=('status',))
                    return Response(
                        {'status': 'fail', 'verified': True},
                        status=status.HTTP_200_OK,
                    )
                else:
                    logger.warning(f"No successful payment found for order {order_id} in provider")
                    response_data = {'status': 'pending', 'verified': False}
                    if request.query_params.get('include_payment_url') == 'true':
                        payment_url = payment_client.get_invoice_url_by_order_id(
                            order_id,
                            search_days=1,
                        )
                        if payment_url:
                            response_data['payment_url'] = payment_url
                    return Response(response_data, status=status.HTTP_200_OK)

            # Return current status
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





class PaymentsTestViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @action(detail=False, methods=['get'])
    def get_payments_by_date(self, request):
        date = request.query_params.get('date')
        
        if not date:
            return Response({'error': 'date parameter is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment_client = PaymentProviderClient()
            
            # Convert date format from YYYY-MM-DD to YYYY_MM_DD for PayKeeper API
            api_date = date.replace('-', '_')
            
            # Get the URL that will be called
            url = f"{payment_client.base_url}/info/payments/bydate/?start={api_date}&end={api_date}&payment_system_id[]=30&payment_system_id[]=99&payment_system_id[]=305&status[]=success&status[]=canceled&status[]=refunded&status[]=failed&status[]=obtained&status[]=refunding&status[]=partially_refunded&status[]=stuck&status[]=pending&limit=1000&from=0"
            
            # Make the request manually to get more debug info
            import requests
            
            response = requests.get(url, headers=payment_client.headers, timeout=10)
            
            # Return detailed debug information
            debug_info = {
                'url': url,
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'content_type': response.headers.get('content-type', 'unknown'),
                'raw_content': response.text[:1000],  # First 1000 chars
                'content_length': len(response.text)
            }
            
            try:
                json_data = response.json()
                return Response({
                    'success': True,
                    'payments': json_data,
                    'debug': debug_info
                }, status=status.HTTP_200_OK)
            except ValueError as json_error:
                return Response({
                    'success': False,
                    'error': f'JSON parsing failed: {str(json_error)}',
                    'debug': debug_info
                }, status=status.HTTP_200_OK)
                
        except Exception as e:
            return Response({
                'success': False,
                'error': f'Request failed: {str(e)}',
                'date_requested': date
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PaymentAnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    
    @action(detail=False, methods=['get'])
    def analytics(self, request):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            # Default to last 3 months
            from datetime import datetime, timedelta
            end_date = datetime.now().strftime('%Y-%m-%d')
            start_date = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        
        try:
            payment_client = PaymentProviderClient()
            analytics = payment_client.get_analytics_for_period(start_date, end_date)
            
            return Response({
                'success': True,
                **analytics
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f'Payment analytics error: {str(e)}')
            return Response({
                'success': False,
                'error': f'Failed to get payment analytics: {str(e)}',
                'total_payments': 0,
                'successful_payments': 0,
                'failed_payments': 0,
                'pending_payments': 0,
                'canceled_payments': 0,
                'refunded_payments': 0,
                'total_revenue': 0,
                'success_rate': 0,
                'payment_methods': {},
                'daily_totals': {},
                'hourly_distribution': [0] * 24,
                'period': f'{start_date} to {end_date}'
            }, status=status.HTTP_200_OK)


class TokenViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    @staticmethod
    def _control_server_request_is_authorized(request):
        configured_secret = getattr(settings, 'CONTROL_SERVER_SHARED_SECRET', '')
        provided_secret = request.headers.get('X-Control-Server-Secret', '')

        if (
            configured_secret
            and provided_secret
            and secrets.compare_digest(configured_secret, provided_secret)
        ):
            return True

        # The production control server and Django currently run on the same
        # host. A direct request has no proxy forwarding headers; requests that
        # arrived through nginx do, even though Django sees nginx as loopback.
        remote_address = request.META.get('REMOTE_ADDR', '')
        forwarded = (
            request.META.get('HTTP_X_FORWARDED_FOR')
            or request.META.get('HTTP_X_REAL_IP')
        )
        try:
            return ipaddress.ip_address(remote_address).is_loopback and not forwarded
        except ValueError:
            return False

    @staticmethod
    def _serialize_films(token):
        films_data = []

        for paid_film in PaidFilm.objects.filter(token=token):
            try:
                if paid_film.is_series:
                    film = Movie.objects.get(film_id=paid_film.film_id)
                else:
                    film = Category.objects.get(film_id=paid_film.film_id)

                films_data.append({
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
                    "queueImg": film.queueImg.url if hasattr(film, 'queueImg') and film.queueImg else None,
                })
            except (Category.DoesNotExist, Movie.DoesNotExist):
                continue

        return films_data
    
    @action(detail=False, methods=['get'])
    def get_token_by_order(self, request):
        order_id = request.query_params.get('order_id')
        current_token_string = request.query_params.get('current_token', '')

        if not order_id:
            return Response({"error": "ID заказа не указан"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = Order.objects.get(order_id=order_id)
            try:
                new_payment_token = PaymentToken.objects.get(order=order)
                
                if current_token_string:
                    PaymentProcessor.link_tokens_to_browser_session(
                        new_payment_token,
                        current_token_string,
                    )
                else:
                    PaymentProcessor.merge_active_session_films(new_payment_token)
                
                return Response({
                    "valid": new_payment_token.is_valid(),
                    "token": new_payment_token.token,
                    "expires_at": new_payment_token.expires_at.isoformat(),
                    "viewer_session_id": (
                        str(new_payment_token.order.viewer_session_id)
                        if new_payment_token.order.viewer_session_id else None
                    ),
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
                payment_confirmed = token.order.status in ('paid', 'checked')

                return Response({
                    "valid": film_exists and payment_confirmed,
                    "token_valid": True,
                    "film_valid": film_exists,
                    "payment_confirmed": payment_confirmed,
                    "viewer_id": token.order.user_id,
                    "expires_at": token.expires_at.isoformat()
                }, status=status.HTTP_200_OK)
            else:
                payment_confirmed = token.order.status in ('paid', 'checked')
                return Response({
                    "valid": payment_confirmed,
                    "payment_confirmed": payment_confirmed,
                    "viewer_id": token.order.user_id,
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
                
            films_data = self._serialize_films(token)
            
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

    @action(detail=False, methods=['post'])
    def viewer_film_access(self, request):
        """Check whether the current headset session has paid for a film."""
        if not self._control_server_request_is_authorized(request):
            return Response(
                {"success": False, "error": "Запрос разрешен только control server"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_id = normalize_viewer_id(request.data.get('user_id'))
        film_id = str(request.data.get('film_id', '')).strip()
        if not user_id or len(user_id) > 255 or not film_id or len(film_id) > 100:
            return Response(
                {"success": False, "error": "user_id и film_id обязательны"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        active_browser_sessions = PaymentToken.objects.filter(
            order__user_id=user_id,
            order__status__in=('paid', 'checked'),
            order__viewer_session_id__isnull=False,
            is_active=True,
            headset_session_active=True,
            expires_at__gt=timezone.now(),
        ).values('order__viewer_session_id')

        # The lease belongs to the visitor/browser session, not to one order.
        # A later purchase in the same session may still be represented by an
        # inactive token until the phone is used again.  Its films must remain
        # available while another token from that exact session owns the
        # active headset lease.
        access_exists = PaidFilm.objects.filter(
            token__order__user_id=user_id,
            token__order__status__in=('paid', 'checked'),
            token__is_active=True,
            token__expires_at__gt=timezone.now(),
            film_id=film_id,
        ).filter(
            Q(token__headset_session_active=True)
            | Q(token__order__viewer_session_id__in=active_browser_sessions)
        ).exists()

        return Response({
            "success": True,
            "valid": access_exists,
            "viewer_id": user_id,
            "film_id": film_id,
        })

    @action(detail=False, methods=['post'])
    def resume_viewer_session(self, request):
        """Resume a suspended headset lease using the browser payment token."""
        if not self._control_server_request_is_authorized(request):
            return Response(
                {"success": False, "error": "Запрос разрешен только control server"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_id = normalize_viewer_id(request.data.get('user_id'))
        film_id = str(request.data.get('film_id', '')).strip()
        token_string = str(request.data.get('token', '')).strip()
        if (
            not user_id or len(user_id) > 255
            or not film_id or len(film_id) > 100
            or not token_string or len(token_string) > 64
        ):
            return Response(
                {"success": False, "valid": False, "error": "user_id, film_id и token обязательны"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                token = PaymentToken.objects.select_for_update().select_related('order').get(
                    token=token_string,
                    order__user_id=user_id,
                )
            except PaymentToken.DoesNotExist:
                return Response({
                    "success": True,
                    "valid": False,
                    "viewer_id": user_id,
                    "film_id": film_id,
                })

            payment_confirmed = token.order.status in ('paid', 'checked')
            film_exists = PaidFilm.objects.filter(token=token, film_id=film_id).exists()
            valid = token.is_valid() and payment_confirmed and film_exists
            is_free_access = str(token.order.payment_id or '').startswith('free:')

            if valid and not is_free_access:
                active_other_tokens = PaymentToken.objects.select_for_update().filter(
                    order__user_id=user_id,
                    order__status__in=('paid', 'checked'),
                    is_active=True,
                    headset_session_active=True,
                    expires_at__gt=timezone.now(),
                ).exclude(pk=token.pk).exclude(order__payment_id__startswith='free:')

                if token.order.viewer_session_id is None:
                    conflicting_session_exists = active_other_tokens.exists()
                else:
                    conflicting_session_exists = active_other_tokens.exclude(
                        order__viewer_session_id=token.order.viewer_session_id,
                    ).exists()

                if conflicting_session_exists:
                    return Response({
                        "success": True,
                        "valid": False,
                        "occupied": True,
                        "film_valid": film_exists,
                        "payment_confirmed": payment_confirmed,
                        "viewer_id": user_id,
                        "film_id": film_id,
                        "error": "Очки сейчас используются другим зрителем",
                    })

                # Keep exactly one paid entitlement as the current headset
                # lease. Its token is cumulative within this browser session.
                active_other_tokens.update(headset_session_active=False)

            if valid and not token.headset_session_active:
                token.headset_session_active = True
                token.save(update_fields=('headset_session_active',))
                logger.info(
                    "Сеанс зрителя %s возобновлен токеном заказа %s",
                    user_id,
                    token.order.order_id,
                )

        return Response({
            "success": True,
            "valid": valid,
            "film_valid": film_exists,
            "payment_confirmed": payment_confirmed,
            "viewer_id": token.order.user_id,
            "film_id": film_id,
            "expires_at": token.expires_at.isoformat(),
        })

    @action(detail=False, methods=['post'])
    def end_viewer_session(self, request):
        """Suspend the headset lease without revoking paid entitlement."""
        if not self._control_server_request_is_authorized(request):
            return Response(
                {"success": False, "error": "Запрос разрешен только control server"},
                status=status.HTTP_403_FORBIDDEN,
            )

        user_id = normalize_viewer_id(request.data.get('user_id'))
        ended_at_raw = str(request.data.get('ended_at', '')).strip()

        if not user_id or len(user_id) > 255:
            return Response(
                {"success": False, "error": "user_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ended_at = parse_datetime(ended_at_raw) if ended_at_raw else timezone.now()
        if ended_at is None:
            return Response(
                {"success": False, "error": "ended_at имеет неверный формат"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if timezone.is_naive(ended_at):
            ended_at = timezone.make_aware(ended_at, timezone.get_current_timezone())

        active_tokens = PaymentToken.objects.filter(
            order__user_id=user_id,
            is_active=True,
            headset_session_active=True,
            created_at__lte=ended_at,
        ).exclude(
            # Free/headset-specific access is intentionally long-lived and
            # must survive the ordinary viewer-presence timeout.
            order__payment_id__startswith='free:',
        )
        suspended_count = active_tokens.update(headset_session_active=False)

        logger.info(
            "Сеанс зрителя %s завершен по тайм-ауту очков; сеансов приостановлено: %s",
            user_id,
            suspended_count,
        )
        return Response({
            "success": True,
            "user_id": user_id,
            # Keep the established response field for the control server and
            # older diagnostics; it now counts suspended headset leases.
            "deactivated": suspended_count,
            "suspended": suspended_count,
        })

    @action(detail=False, methods=['get'])
    def latest_for_user(self, request):
        """Restore access only when this browser proves an earlier purchase."""
        user_id = normalize_viewer_id(request.query_params.get('user_id'))
        known_token = request.query_params.get('known_token', '').strip()
        order_id = request.query_params.get('order_id', '').strip()

        if not user_id or len(user_id) > 255:
            return Response(
                {"error": "user_id обязателен"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not known_token and not order_id:
            return Response({
                "valid": False,
                "films": [],
                "proof_required": True,
            }, status=status.HTTP_200_OK)

        if len(known_token) > 64 or len(order_id) > 255:
            return Response(
                {"error": "Некорректное подтверждение покупки"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token_query = PaymentToken.objects.filter(order__user_id=user_id)
        if known_token:
            token_query = token_query.filter(token=known_token)
        else:
            token_query = token_query.filter(order__order_id=order_id)

        proof_token = token_query.select_related('order').first()
        if (
            proof_token is None
            or not proof_token.is_valid()
            or proof_token.order.status not in ('paid', 'checked')
        ):
            return Response({"valid": False, "films": []}, status=status.HTTP_200_OK)

        token = proof_token
        if proof_token.order.viewer_session_id is not None:
            token = PaymentToken.objects.filter(
                order__user_id=user_id,
                order__viewer_session_id=proof_token.order.viewer_session_id,
                order__status__in=('paid', 'checked'),
                is_active=True,
                expires_at__gt=timezone.now(),
            ).select_related('order').order_by('-expires_at', '-created_at').first()

        # Return the newest entitlement in the proven browser session.  A new
        # phone that only knows the public headset route cannot enter it.
        PaymentProcessor.merge_active_session_films(token)
        films_data = self._serialize_films(token)

        return Response({
            "valid": True,
            "token": token.token,
            "expires_at": token.expires_at.isoformat(),
            "viewer_session_id": (
                str(token.order.viewer_session_id)
                if token.order.viewer_session_id else None
            ),
            "films": films_data,
        }, status=status.HTTP_200_OK)


class AdminViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]  # TODO: Add proper admin permissions
    
    @action(detail=False, methods=['get'])
    def search_orders(self, request):
        """Search orders by order_id (supports partial match)"""
        search_query = request.query_params.get('q', '').strip()
        
        if not search_query:
            # Failed invoice initialization is not a purchase awaiting approval.
            orders = Order.objects.exclude(
                status__in=('created', 'payment_error'),
            ).exclude(
                payment_id__startswith='free:',
            ).order_by('-created_at')[:20]
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
            expires_at = (
                timezone.now() + PaymentProcessor.default_access_duration()
            )
            token_string = secrets.token_hex(32)
            
            logger.info(f"Admin: создаем токен доступа для заказа {order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at,
                headset_session_active=False,
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

            PaymentProcessor.merge_active_session_films(payment_token)
            
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
            expires_at = (
                timezone.now() + PaymentProcessor.default_access_duration()
            )
            token_string = secrets.token_hex(32)
            
            logger.info(f"Admin: создаем токен доступа для заказа {order_id}")
            payment_token = PaymentToken.objects.create(
                token=token_string,
                order=order,
                expires_at=expires_at,
                headset_session_active=False,
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

            PaymentProcessor.merge_active_session_films(payment_token)
            
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
