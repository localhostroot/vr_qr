import os
import sqlite3
from datetime import datetime, timezone as datetime_timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


BACKUP_PREFIX = 'qr-db-'
BACKUP_SUFFIX = '.sqlite3'


def create_sqlite_backup(source_path, destination, keep, now=None):
    source = Path(source_path).resolve()
    target_dir = Path(destination).resolve()
    keep = int(keep)

    if keep < 1:
        raise ValueError('keep must be at least 1')
    if not source.is_file():
        raise FileNotFoundError(f'SQLite database not found: {source}')

    target_dir.mkdir(parents=True, exist_ok=True)
    timestamp = (now or datetime.now(datetime_timezone.utc)).strftime(
        '%Y%m%d-%H%M%S-%f'
    )
    final_path = target_dir / f'{BACKUP_PREFIX}{timestamp}{BACKUP_SUFFIX}'
    temporary_path = target_dir / f'.{final_path.name}.tmp'

    try:
        with sqlite3.connect(str(source)) as source_db:
            with sqlite3.connect(str(temporary_path)) as backup_db:
                source_db.backup(backup_db)
                quick_check = backup_db.execute('PRAGMA quick_check').fetchone()
                if not quick_check or quick_check[0] != 'ok':
                    raise RuntimeError(f'backup integrity check failed: {quick_check}')
        os.replace(temporary_path, final_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()

    backups = sorted(
        target_dir.glob(f'{BACKUP_PREFIX}*{BACKUP_SUFFIX}'),
        key=lambda path: path.name,
        reverse=True,
    )
    removed = []
    for stale_path in backups[keep:]:
        stale_path.unlink()
        removed.append(stale_path)

    return final_path, removed


class Command(BaseCommand):
    help = 'Create an integrity-checked SQLite backup and retain a fixed count.'

    def add_arguments(self, parser):
        parser.add_argument('--destination', required=True)
        parser.add_argument('--keep', type=int, default=14)

    def handle(self, *args, **options):
        database = settings.DATABASES['default']
        if database.get('ENGINE') != 'django.db.backends.sqlite3':
            raise CommandError('backup_database supports only SQLite')

        try:
            backup_path, removed = create_sqlite_backup(
                database['NAME'],
                options['destination'],
                options['keep'],
            )
        except (OSError, sqlite3.Error, RuntimeError, ValueError) as error:
            raise CommandError(str(error)) from error

        self.stdout.write(
            f'BACKUP_OK path={backup_path} retained={options["keep"]} '
            f'removed={len(removed)}'
        )
