from django.urls import path, include
from rest_framework import routers
from .api import CategoryViewSet, MovieViewSet, PaymentViewSet, PaymentStatusViewSet, TokenViewSet, AdminViewSet


router = routers.DefaultRouter()

router.register('api/category', CategoryViewSet, 'category')
router.register('api/movie', MovieViewSet, 'movie')
router.register('api/payments', PaymentViewSet, 'payments')
router.register('api/status', PaymentStatusViewSet, 'status')
router.register('api/tokens', TokenViewSet, basename='tokens')
router.register('api/admin', AdminViewSet, basename='admin')
urlpatterns = [
    path('', include(router.urls)),  
]