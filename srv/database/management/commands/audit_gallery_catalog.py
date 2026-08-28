import json
from collections import defaultdict
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from database.models import Category, Movie


def _video_ids(videos, context, seen):
    result = set()
    if not isinstance(videos, list):
        raise CommandError(f'{context}: videos должен быть списком')

    for video in videos:
        if not isinstance(video, dict):
            raise CommandError(f'{context}: описание видео должно быть объектом')
        video_id = str(video.get('id', '')).strip()
        if not video_id:
            raise CommandError(f'{context}: у видео отсутствует id')
        if video_id in seen:
            raise CommandError(
                f'Повторяющийся video id в gallery.json: {video_id}',
            )
        seen.add(video_id)
        result.add(video_id)
    return result


def gallery_layout(payload):
    contents = payload.get('contents') if isinstance(payload, dict) else None
    if not isinstance(contents, dict):
        raise CommandError('В gallery.json отсутствует объект contents')

    seen_video_ids = set()
    root_video_ids = _video_ids(
        contents.get('videos', []),
        'contents',
        seen_video_ids,
    )
    folder_videos = {}

    def visit_folders(folders, context):
        if not isinstance(folders, list):
            raise CommandError(f'{context}: folders должен быть списком')
        for index, folder in enumerate(folders):
            folder_context = f'{context}[{index}]'
            if not isinstance(folder, dict):
                raise CommandError(f'{folder_context}: папка должна быть объектом')
            thumb = folder.get('thumb')
            category_id = str(
                thumb.get('id', '') if isinstance(thumb, dict) else ''
            ).strip()
            if not category_id:
                raise CommandError(f'{folder_context}: у thumb отсутствует id')
            if category_id in folder_videos:
                raise CommandError(
                    f'Повторяющийся id папки в gallery.json: {category_id}',
                )
            folder_videos[category_id] = _video_ids(
                folder.get('videos', []),
                folder_context,
                seen_video_ids,
            )
            visit_folders(folder.get('folders', []), f'{folder_context}.folders')

    visit_folders(contents.get('folders', []), 'contents.folders')
    return root_video_ids, folder_videos


def _describe_difference(expected, actual):
    parts = []
    missing = sorted(expected - actual)
    extra = sorted(actual - expected)
    if missing:
        parts.append(f'нет в БД: {missing}')
    if extra:
        parts.append(f'лишние в БД: {extra}')
    return '; '.join(parts)


def audit_catalog(root_video_ids, folder_videos):
    categories = list(Category.objects.all())
    root_categories = {
        category.cat_id: category
        for category in categories
        if not category.serial
    }
    serial_categories = {
        category.cat_id: category
        for category in categories
        if category.serial
    }

    if len(root_categories) + len(serial_categories) != len(categories):
        raise CommandError('В БД есть повторяющиеся cat_id')

    actual_root_ids = set(root_categories)
    if actual_root_ids != root_video_ids:
        raise CommandError(
            'Корневые фильмы не совпадают с gallery.json: '
            + _describe_difference(root_video_ids, actual_root_ids),
        )
    for category_id, category in root_categories.items():
        if category.film_id != category_id:
            raise CommandError(
                f'Корневой фильм {category_id}: film_id={category.film_id!r}',
            )

    expected_folder_ids = set(folder_videos)
    actual_folder_ids = set(serial_categories)
    if actual_folder_ids != expected_folder_ids:
        raise CommandError(
            'Папки сериалов не совпадают с gallery.json: '
            + _describe_difference(expected_folder_ids, actual_folder_ids),
        )
    for category_id, category in serial_categories.items():
        if category.film_id != category_id:
            raise CommandError(
                f'Папка {category_id}: film_id={category.film_id!r}',
            )

    movies_by_category = defaultdict(set)
    movie_count = 0
    for film_id, category_id in Movie.objects.values_list(
        'film_id',
        'cat_id__cat_id',
    ):
        movies_by_category[category_id].add(film_id)
        movie_count += 1

    if sum(len(ids) for ids in movies_by_category.values()) != movie_count:
        raise CommandError('В БД есть повторяющиеся film_id фильмов')

    for category_id in root_video_ids:
        actual_movie_ids = movies_by_category.pop(category_id, set())
        if actual_movie_ids != {category_id}:
            raise CommandError(
                f'Корневой фильм {category_id} не совпадает с gallery.json: '
                + _describe_difference({category_id}, actual_movie_ids),
            )

    for category_id, expected_movie_ids in folder_videos.items():
        actual_movie_ids = movies_by_category.pop(category_id, set())
        if actual_movie_ids != expected_movie_ids:
            raise CommandError(
                f'Состав папки {category_id} не совпадает с gallery.json: '
                + _describe_difference(expected_movie_ids, actual_movie_ids),
            )
    if movies_by_category:
        raise CommandError(
            'Фильмы привязаны к отсутствующим папкам: '
            f'{sorted(movies_by_category)}',
        )


class Command(BaseCommand):
    help = 'Check that the Django catalogue exactly matches gallery.json.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--gallery',
            default=str(
                settings.BASE_DIR.parent
                / 'control_server'
                / 'configs'
                / 'gallery.json'
            ),
            help='Path to the authoritative gallery.json.',
        )

    def handle(self, *args, **options):
        gallery_path = Path(options['gallery'])
        try:
            with gallery_path.open(encoding='utf-8') as gallery_file:
                payload = json.load(gallery_file)
        except (OSError, json.JSONDecodeError) as error:
            raise CommandError(
                f'Не удалось прочитать {gallery_path}: {error}',
            ) from error

        root_video_ids, folder_videos = gallery_layout(payload)
        audit_catalog(root_video_ids, folder_videos)
        episode_count = sum(len(ids) for ids in folder_videos.values())
        self.stdout.write(self.style.SUCCESS(
            'Каталог соответствует gallery.json: '
            f'{len(root_video_ids)} корневых фильма, '
            f'{len(folder_videos)} папки, {episode_count} серий.',
        ))
