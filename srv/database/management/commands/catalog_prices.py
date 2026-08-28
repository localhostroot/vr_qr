import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from database.models import Category, Movie


PRODUCTION_CATEGORY_PRICES = {
    'geo_02': 300,
    'kb_00': 150,
    'russia': 300,
    'tyva': 300,
    'volga': 300,
}

PRODUCTION_MOVIE_PRICES = {
    'geo_02_01': 100,
    'geo_02_02': 100,
    'geo_02_03': 100,
    'geo_02_04': 100,
    'geo_02_05': 100,
    'geo_02_06': 100,
    'kb_01': 75,
    'kb_02': 75,
    'russia': 300,
    'tyva_01': 100,
    'tyva_02': 100,
    'tyva_03': 100,
    'tyva_04': 100,
    'volga': 300,
}


def catalog_snapshot():
    return {
        'version': 1,
        'categories': list(
            Category.objects.order_by('id').values(
                'id', 'cat_id', 'film_id', 'name_short', 'price',
            )
        ),
        'movies': list(
            Movie.objects.order_by('id').values(
                'id', 'film_id', 'name_short', 'price',
            )
        ),
    }


def write_snapshot(path, payload):
    snapshot_path = Path(path)
    snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with snapshot_path.open('x', encoding='utf-8') as snapshot_file:
            json.dump(payload, snapshot_file, ensure_ascii=False, indent=2)
            snapshot_file.write('\n')
    except FileExistsError as error:
        raise CommandError(
            f'Файл снимка уже существует: {snapshot_path}',
        ) from error


def load_snapshot(path):
    snapshot_path = Path(path)
    try:
        with snapshot_path.open(encoding='utf-8') as snapshot_file:
            payload = json.load(snapshot_file)
    except (OSError, json.JSONDecodeError) as error:
        raise CommandError(
            f'Не удалось прочитать снимок {snapshot_path}: {error}',
        ) from error

    if payload.get('version') != 1:
        raise CommandError('Неподдерживаемая версия снимка цен')
    if not isinstance(payload.get('categories'), list):
        raise CommandError('В снимке отсутствует список categories')
    if not isinstance(payload.get('movies'), list):
        raise CommandError('В снимке отсутствует список movies')
    return payload


def restore_snapshot(payload):
    category_rows = {row['id']: row for row in payload['categories']}
    movie_rows = {row['id']: row for row in payload['movies']}
    current_category_ids = set(Category.objects.values_list('id', flat=True))
    current_movie_ids = set(Movie.objects.values_list('id', flat=True))

    if current_category_ids != set(category_rows):
        raise CommandError('Состав комплектов отличается от сохранённого снимка')
    if current_movie_ids != set(movie_rows):
        raise CommandError('Состав фильмов отличается от сохранённого снимка')

    for category_id, row in category_rows.items():
        updated = Category.objects.filter(
            id=category_id,
            cat_id=row['cat_id'],
            film_id=row['film_id'],
        ).update(price=row['price'])
        if updated != 1:
            raise CommandError(
                f'Не удалось однозначно восстановить комплект {row["cat_id"]}',
            )

    for movie_id, row in movie_rows.items():
        updated = Movie.objects.filter(
            id=movie_id,
            film_id=row['film_id'],
        ).update(price=row['price'])
        if updated != 1:
            raise CommandError(
                f'Не удалось однозначно восстановить фильм {row["film_id"]}',
            )


def restore_production_profile():
    category_ids = list(Category.objects.values_list('cat_id', flat=True))
    movie_ids = list(Movie.objects.values_list('film_id', flat=True))

    if len(category_ids) != len(set(category_ids)):
        raise CommandError('В каталоге есть повторяющиеся cat_id')
    if len(movie_ids) != len(set(movie_ids)):
        raise CommandError('В каталоге есть повторяющиеся film_id')
    if set(category_ids) != set(PRODUCTION_CATEGORY_PRICES):
        raise CommandError('Состав комплектов не совпадает с боевым профилем')
    if set(movie_ids) != set(PRODUCTION_MOVIE_PRICES):
        raise CommandError('Состав фильмов не совпадает с боевым профилем')

    for catalog_id, price in PRODUCTION_CATEGORY_PRICES.items():
        Category.objects.filter(cat_id=catalog_id).update(price=price)
    for film_id, price in PRODUCTION_MOVIE_PRICES.items():
        Movie.objects.filter(film_id=film_id).update(price=price)


class Command(BaseCommand):
    help = 'Safely switch all catalogue prices and restore the production profile.'

    def add_arguments(self, parser):
        parser.add_argument(
            'action',
            choices=(
                'show',
                'set-one-ruble',
                'restore-production',
                'restore-snapshot',
            ),
        )
        parser.add_argument(
            '--snapshot',
            help='Path used to save or restore the exact catalogue snapshot.',
        )

    def handle(self, *args, **options):
        action = options['action']
        snapshot_path = options.get('snapshot')

        if action == 'show':
            self.stdout.write(
                json.dumps(catalog_snapshot(), ensure_ascii=False, indent=2),
            )
            return

        if action == 'set-one-ruble':
            if not snapshot_path:
                raise CommandError(
                    'Для set-one-ruble обязателен параметр --snapshot',
                )
            write_snapshot(snapshot_path, catalog_snapshot())
            with transaction.atomic():
                categories_updated = Category.objects.update(price=1)
                movies_updated = Movie.objects.update(price=1)
            self.stdout.write(self.style.SUCCESS(
                f'Цена 1 ₽ установлена: комплектов {categories_updated}, '
                f'фильмов {movies_updated}. Снимок: {snapshot_path}',
            ))
            return

        if action == 'restore-production':
            with transaction.atomic():
                restore_production_profile()
            self.stdout.write(self.style.SUCCESS(
                'Согласованные боевые цены восстановлены.',
            ))
            return

        if not snapshot_path:
            raise CommandError(
                'Для restore-snapshot обязателен параметр --snapshot',
            )
        payload = load_snapshot(snapshot_path)
        with transaction.atomic():
            restore_snapshot(payload)
        self.stdout.write(self.style.SUCCESS(
            f'Цены восстановлены из снимка: {snapshot_path}',
        ))
