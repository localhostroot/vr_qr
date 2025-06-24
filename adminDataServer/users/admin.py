from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, UserProfile
from django.utils.translation import gettext, gettext_lazy as _
from .models import Video, Movie, Location, MovieViewCounter

admin.site.register(Video)
admin.site.register(Movie)
admin.site.register(Location)
admin.site.register(MovieViewCounter)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Профиль'
    extra = 1


class CustomUserAdmin(UserAdmin):
    inlines = (UserProfileInline,)
    list_display = ('username', 'email', 'first_name', 'last_name', 'is_staff', 'get_location')
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'), {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'), {'fields': ('is_active', 'is_staff', 'is_superuser',
                                       'groups', 'user_permissions')}),
        (_('Important dates'), {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password', 'email', 'first_name', 'last_name')}
         ),
    )
    ordering = ('username',)

    def get_location(self, obj):
        if hasattr(obj, 'profile'):
            return obj.profile.location
        return None
    get_location.short_description = 'Местоположение'


admin.site.register(CustomUser, CustomUserAdmin)
