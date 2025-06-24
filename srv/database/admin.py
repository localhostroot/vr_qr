from django.contrib import admin
from .models import Category, Movie, Order, OrderItem, PaidFilm, PaymentToken

admin.site.register(Category)
admin.site.register(Movie)
admin.site.register(Order)
admin.site.register(PaymentToken)
admin.site.register(PaidFilm)
admin.site.register(OrderItem)



