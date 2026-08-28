import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase

from database.models import Category, Movie


class GalleryCatalogAuditTests(TestCase):
    def setUp(self):
        self.single = self.create_category('single', serial=False)
        self.bundle = self.create_category('bundle', serial=True)
        self.create_movie('single', self.single)
        self.create_movie('episode', self.bundle)

    @staticmethod
    def create_category(category_id, serial):
        return Category.objects.create(
            film_id=category_id,
            cat_id=category_id,
            name=f'Category {category_id}',
            year='2026',
            format='VR',
            price=100,
            route_id=category_id,
            time='10',
            serial=serial,
            isAdded=False,
            country='RU',
            image=f'{category_id}.jpg',
            name_short=f'Short {category_id}',
        )

    @staticmethod
    def create_movie(film_id, category):
        return Movie.objects.create(
            film_id=film_id,
            name=f'Movie {film_id}',
            name_short=f'Short {film_id}',
            description='Description',
            route_id=category.route_id,
            year='2026',
            country='RU',
            number='1',
            serial=False,
            isAdded=False,
            cat_id=category,
            image=f'{film_id}.jpg',
            time='10',
            format='VR',
        )

    @staticmethod
    def gallery_payload():
        return {
            'contents': {
                'videos': [{'id': 'single'}],
                'folders': [{
                    'id': 'folder-1',
                    'thumb': {'id': 'bundle'},
                    'videos': [{'id': 'episode'}],
                }],
            },
        }

    def run_audit(self, payload=None):
        with tempfile.TemporaryDirectory() as temp_dir:
            gallery_path = Path(temp_dir) / 'gallery.json'
            gallery_path.write_text(
                json.dumps(payload or self.gallery_payload()),
                encoding='utf-8',
            )
            call_command(
                'audit_gallery_catalog',
                gallery=str(gallery_path),
            )

    def test_matching_catalog_passes(self):
        self.run_audit()

    def test_extra_database_movie_fails(self):
        self.create_movie('extra', self.bundle)

        with self.assertRaisesMessage(CommandError, 'лишние в БД'):
            self.run_audit()

    def test_duplicate_gallery_video_id_fails(self):
        payload = self.gallery_payload()
        payload['contents']['folders'][0]['videos'].append({'id': 'single'})

        with self.assertRaisesMessage(CommandError, 'Повторяющийся video id'):
            self.run_audit(payload)
