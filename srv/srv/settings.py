"""
Django settings for srv project.
"""
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-d_5$t2s$p9r3i7#&)i+7wp8h4(+ir0hj-q@g#!onncuehvzjs4")
PAYKEEPER_API_KEY = '_lB0Y3tZg13UsC}e3U'
PAYKEEPER_MERCHANT_ID = os.environ.get('PAYKEEPER_MERCHANT_ID')
PAYKEEPER_TEST_MODE ='true'
PAYKEEPER_URL = 'https://api.paykeeper.ru/v1' if not PAYKEEPER_TEST_MODE else 'https://demo.paykeeper.ru/create/'
PAYKEEPER_CHECK_URL = 'https://api.paykeeper.ru/v1/invoices/check' if not PAYKEEPER_TEST_MODE else 'https://demo.paykeeper.ru/invoices/check'

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True # Ensure this is False in production

ALLOWED_HOSTS = [
    '4-neba.ru',
    'www.4-neba.ru',
    'localhost',
    'admin.4-neba.ru',
    'stats.4-neba.ru',
    'cinema.4-neba.ru',
    'cinema-free.4-neba.ru',
    '192.168.1.90',
]

CSRF_TRUSTED_ORIGINS = [
    'https://4-neba.ru',
    'https://www.4-neba.ru',
    'https://admin.4-neba.ru',
    'https://stats.4-neba.ru',
    'https://cinema.4-neba.ru',
    'https://cinema-free.4-neba.ru',
    'http://localhost:3000',
    'http://192.168.1.90:3000',
]

CORS_ALLOWED_ORIGINS = [
    "https://4-neba.ru",
    "https://www.4-neba.ru",
    "https://admin.4-neba.ru",
    "https://stats.4-neba.ru",
    "https://cinema.4-neba.ru",
    "https://cinema-free.4-neba.ru",
    'http://localhost:3000',
    'http://192.168.1.90:3000',
]

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'database',
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'srv.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'srv.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3'),
    }
}


AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'static')


STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_PARSER_CLASSES': (
            'rest_framework.parsers.JSONParser',
            'rest_framework.parsers.FormParser',
            'rest_framework.parsers.MultiPartParser',
    ),
}


