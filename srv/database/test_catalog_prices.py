import json
import tempfile
from io import StringIO
from pathlib import Path

from django.core.management import call_command
from django.test import TestCase

from .models import Category, Movie


class CatalogPricesCommandTests(TestCase):
    def setUp(self):
        self.category = Category.objects.create(
            film_id='bundle-film',
            cat_id='bundle',
            name='Test bundle',
            year='2026',
            format='VR',
            price=300,
            route_id='bundle',
            time='10',
            serial=True,
            isAdded=True,
            country='RU',
            image='category_images/bundle.jpg',
            queueImg='queue_category_images/bundle.jpg',
            name_short='Bundle',
            description='Test bundle',
        )
        self.movie = Movie.objects.create(
            film_id='movie-1',
            name='Test movie',
            name_short='Movie',
            description='Test movie',
            route_id='movie',
            year='2026',
            country='RU',
            number='1',
            serial=True,
            isAdded=True,
            cat_id=self.category,
            image='movie_images/movie.jpg',
            time='10',
            format='VR',
            price=75,
            series=True,
        )

    def test_one_ruble_switch_and_exact_snapshot_restore(self):
        with tempfile.TemporaryDirectory() as temp_directory:
            snapshot_path = Path(temp_directory) / 'prices.json'
            call_command(
                'catalog_prices',
                'set-one-ruble',
                snapshot=str(snapshot_path),
                stdout=StringIO(),
            )

            self.category.refresh_from_db()
            self.movie.refresh_from_db()
            self.assertEqual(self.category.price, 1)
            self.assertEqual(self.movie.price, 1)

            payload = json.loads(snapshot_path.read_text(encoding='utf-8'))
            self.assertEqual(payload['categories'][0]['price'], 300)
            self.assertEqual(payload['movies'][0]['price'], 75)

            call_command(
                'catalog_prices',
                'restore-snapshot',
                snapshot=str(snapshot_path),
                stdout=StringIO(),
            )

        self.category.refresh_from_db()
        self.movie.refresh_from_db()
        self.assertEqual(self.category.price, 300)
        self.assertEqual(self.movie.price, 75)

