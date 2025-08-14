from django.urls import path, include
from rest_framework import routers
from .api import CategoryViewSet, MovieViewSet, PaymentViewSet, PaymentStatusViewSet, TokenViewSet, AdminViewSet, PaymentsTestViewSet, PaymentAnalyticsViewSet


router = routers.DefaultRouter()

router.register('api/category', CategoryViewSet, 'category')
router.register('api/movie', MovieViewSet, 'movie')
router.register('api/payments', PaymentViewSet, 'payments')
router.register('api/status', PaymentStatusViewSet, 'status')
router.register('api/tokens', TokenViewSet, basename='tokens')
router.register('api/admin', AdminViewSet, basename='admin')
router.register('api/payments-test', PaymentsTestViewSet, basename='payments-test')
router.register('api/payments-analytics', PaymentAnalyticsViewSet, basename='payments-analytics')
urlpatterns = [
    path('', include(router.urls)),  
]