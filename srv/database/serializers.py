from rest_framework import serializers
from .models import Category, Movie, Order
import uuid

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class MovieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Movie
        fields = '__all__'
        depth = 1

class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = ('user_id', 'amount', 'description', 'order_id')
        read_only_fields = ('status', 'payment_id') 

    def create(self, validated_data):
        if not validated_data.get('order_id'):
            validated_data['order_id'] = str(uuid.uuid4()) 
        return Order.objects.create(**validated_data)
    
