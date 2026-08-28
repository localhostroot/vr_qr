import hashlib
import hmac

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from rest_framework.permissions import BasePermission


COOKIE_NAME = 'site_admin_session'
COOKIE_PATH = '/api/admin/'
SIGNING_SALT = 'database.site-admin'
PUBLIC_ACTIONS = frozenset({'login', 'logout', 'session'})
MAX_LOGIN_FAILURES = 5
LOGIN_LOCK_SECONDS = 15 * 60


def _remote_address(request):
    return (
        request.META.get('HTTP_X_REAL_IP')
        or request.META.get('REMOTE_ADDR')
        or 'unknown'
    )


def _failure_key(request):
    digest = hashlib.sha256(_remote_address(request).encode('utf-8')).hexdigest()
    return f'site-admin-login-failures:{digest}'


def login_is_locked(request):
    return int(cache.get(_failure_key(request), 0)) >= MAX_LOGIN_FAILURES


def register_login_failure(request):
    key = _failure_key(request)
    failures = int(cache.get(key, 0)) + 1
    cache.set(key, failures, timeout=LOGIN_LOCK_SECONDS)
    return failures


def clear_login_failures(request):
    cache.delete(_failure_key(request))


def password_matches(candidate):
    configured = settings.SITE_ADMIN_PASSWORD
    if not configured:
        return False
    return hmac.compare_digest(
        str(candidate).encode('utf-8'),
        configured.encode('utf-8'),
    )


def create_session_cookie_value():
    return signing.dumps({'scope': 'site-admin'}, salt=SIGNING_SALT)


def has_valid_session(request):
    cookie = request.COOKIES.get(COOKIE_NAME)
    if not cookie or not settings.SITE_ADMIN_PASSWORD:
        return False
    try:
        payload = signing.loads(
            cookie,
            salt=SIGNING_SALT,
            max_age=settings.SITE_ADMIN_SESSION_SECONDS,
        )
    except signing.BadSignature:
        return False
    return payload == {'scope': 'site-admin'}


class SiteAdminPermission(BasePermission):
    message = 'Требуется вход в административный раздел.'

    def has_permission(self, request, view):
        if getattr(view, 'action', None) in PUBLIC_ACTIONS:
            return True
        return has_valid_session(request)
