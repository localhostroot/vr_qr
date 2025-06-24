from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import UserProfile
import logging

logger = logging.getLogger(__name__)

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    logger.info(f"Signal create_user_profile triggered for user: {instance.username}, created: {created}")
    if created:
        UserProfile.objects.create(user=instance)
        logger.info(f"UserProfile created for user: {instance.username}")
