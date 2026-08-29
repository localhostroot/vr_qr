from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from database.models import PaymentToken
from database.viewer_identity import normalize_viewer_id


class Command(BaseCommand):
    help = (
        'Deactivate expired payment tokens and free-access tokens that are '
        'expired or belong to viewers that are no longer configured as free. '
        'Orders and film entitlements are retained for audit.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report what would be changed without updating the database.',
        )

    def handle(self, *args, **options):
        now = timezone.now()
        configured_free_viewers = {
            normalize_viewer_id(viewer_id).casefold()
            for viewer_id in settings.FREE_VIEWER_IDS
        }
        active_free_tokens = list(PaymentToken.objects.filter(
            is_active=True,
            order__payment_id__startswith='free:',
        ).select_related('order'))
        obsolete_free_ids = [
            token.pk
            for token in active_free_tokens
            if (
                token.expires_at <= now
                or normalize_viewer_id(token.order.user_id).casefold()
                not in configured_free_viewers
            )
        ]
        obsolete_free = PaymentToken.objects.filter(pk__in=obsolete_free_ids)
        expired_paid = PaymentToken.objects.filter(
            is_active=True,
            expires_at__lte=now,
        ).exclude(
            order__payment_id__startswith='free:',
        )

        free_kept_count = len(active_free_tokens) - len(obsolete_free_ids)
        obsolete_free_count = len(obsolete_free_ids)
        expired_paid_count = expired_paid.count()

        if not options['dry_run']:
            with transaction.atomic():
                obsolete_free.update(
                    is_active=False,
                    headset_session_active=False,
                )
                expired_paid.update(
                    is_active=False,
                    headset_session_active=False,
                )

        mode = 'DRY RUN' if options['dry_run'] else 'UPDATED'
        self.stdout.write(
            f'{mode}: free_kept={free_kept_count}, '
            f'obsolete_free={obsolete_free_count}, '
            f'expired_paid={expired_paid_count}'
        )
