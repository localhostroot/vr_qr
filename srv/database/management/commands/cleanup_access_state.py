from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from database.models import PaymentToken


class Command(BaseCommand):
    help = (
        'Deactivate expired payment tokens and obsolete free-access tokens. '
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
        legacy_free = PaymentToken.objects.filter(
            is_active=True,
            order__payment_id__startswith='free:',
        )
        expired_paid = PaymentToken.objects.filter(
            is_active=True,
            expires_at__lte=now,
        ).exclude(
            order__payment_id__startswith='free:',
        )

        legacy_free_count = legacy_free.count()
        expired_paid_count = expired_paid.count()

        if not options['dry_run']:
            with transaction.atomic():
                legacy_free.update(
                    is_active=False,
                    headset_session_active=False,
                )
                expired_paid.update(
                    is_active=False,
                    headset_session_active=False,
                )

        mode = 'DRY RUN' if options['dry_run'] else 'UPDATED'
        self.stdout.write(
            f'{mode}: legacy_free={legacy_free_count}, '
            f'expired_paid={expired_paid_count}'
        )
