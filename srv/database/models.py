from django.utils import timezone
from django.db import models
import uuid

class Category(models.Model):
    film_id = models.CharField(max_length=100, default='russia')
    cat_id = models.CharField(max_length=100, default='tuva')
    name = models.CharField(max_length=100, unique=True)
    year = models.CharField(max_length=100)
    format = models.CharField(max_length=100)
    price = models.IntegerField()
    route_id = models.CharField(max_length=50)
    time = models.CharField(max_length=100)
    serial = models.BooleanField()
    isAdded = models.BooleanField()
    series = models.CharField(max_length=100, blank=True, null=True)  
    number = models.CharField(max_length=50, blank=True, null=True)
    country = models.CharField(max_length=100)
    image = models.ImageField(upload_to='category_images/')
    name_short = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=500, default='Описание')
    backImg = models.ImageField(upload_to='back_images/', blank=True, null=True)
    queueImg = models.ImageField(upload_to='queue_category_mages/', blank=True, null=True)

    def __str__(self):
        return self.name



class Movie(models.Model):
    film_id = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    name_short = models.CharField(max_length=200)
    description = models.CharField(max_length=500)
    route_id = models.CharField(max_length=50, default="123")
    year = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    number = models.CharField(max_length=200)
    serial = models.BooleanField()
    isAdded = models.BooleanField()
    cat_id = models.ForeignKey(Category, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='movie_images/')
    time = models.CharField(max_length=20, help_text='Введите длительность фильма', default='10')
    format = models.CharField(max_length=100)
    price = models.IntegerField(help_text='Укажите цену', default=100)
    series = models.BooleanField(default=True)
    backImg = models.ImageField(upload_to='back_movie_images/', blank=True, null=True)
    queueImg = models.ImageField(upload_to='queue_movie_images/', blank=True, null=True)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.queueImg: 
            self.queueImg = self.image  
        super().save(*args, **kwargs) 



class Order(models.Model):
    user_id = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField()
    order_id = models.CharField(max_length=255, unique=True, blank=True, null=True)
    status = models.CharField(max_length=50, default='created')
    payment_id = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Order for {self.user_id} - {self.amount} - {self.status}"
    

class PaymentToken(models.Model):
    token = models.CharField(max_length=64, unique=True)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name='payment_token')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"Token {self.token} for order {self.order.order_id}"
    
    def is_valid(self):
        return self.is_active and self.expires_at > timezone.now()

class PaidFilm(models.Model):
    token = models.ForeignKey(PaymentToken, on_delete=models.CASCADE, related_name='paid_films')
    film_id = models.CharField(max_length=100)
    is_series = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"Film {self.film_id} in token {self.token.token}"

class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    film_id = models.CharField(max_length=100)
    is_series = models.BooleanField(default=False)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"Film {self.film_id} in order {self.order.order_id}"