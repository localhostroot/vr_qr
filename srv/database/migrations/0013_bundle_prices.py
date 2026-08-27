from django.db import migrations


CATEGORY_PRICES = {
    'tv_00': 300,
    'kb_00': 150,
    'geo_02': 300,
    'volga': 300,
    'russia': 300,
}

MOVIE_PRICES = {
    'tyva_01': 100,
    'tyva_02': 100,
    'tyva_03': 100,
    'tyva_04': 100,
    'kb_01': 75,
    'kb_02': 75,
    'geo_02_01': 100,
    'geo_02_02': 100,
    'geo_02_03': 100,
    'geo_02_04': 100,
    'geo_02_05': 100,
    'geo_02_06': 100,
    'volga': 300,
    'russia': 300,
}

PREVIOUS_CATEGORY_PRICES = {
    'tv_00': 350,
    'kb_00': 110,
    'geo_02': 700,
    'volga': 150,
    'russia': 180,
}

PREVIOUS_MOVIE_PRICES = {
    'tyva_01': 50,
    'tyva_02': 90,
    'tyva_03': 120,
    'tyva_04': 90,
    'kb_01': 60,
    'kb_02': 50,
    'geo_02_01': 110,
    'geo_02_02': 140,
    'geo_02_03': 120,
    'geo_02_04': 100,
    'geo_02_05': 140,
    'geo_02_06': 170,
    'volga': 150,
    'russia': 180,
}


def set_prices(apps, schema_editor, category_prices, movie_prices):
    Category = apps.get_model('database', 'Category')
    Movie = apps.get_model('database', 'Movie')

    existing_categories = Category.objects.filter(
        cat_id__in=category_prices,
    ).count()
    existing_movies = Movie.objects.filter(
        film_id__in=movie_prices,
    ).count()

    # Test databases are empty when migrations run. A populated installation
    # must contain the complete known catalogue before any price is changed.
    if existing_categories == 0 and existing_movies == 0:
        return
    if existing_categories != len(category_prices):
        raise RuntimeError('Unexpected category catalogue while updating prices')
    if existing_movies != len(movie_prices):
        raise RuntimeError('Unexpected movie catalogue while updating prices')

    for cat_id, price in category_prices.items():
        updated = Category.objects.filter(cat_id=cat_id).update(price=price)
        if updated != 1:
            raise RuntimeError(f'Expected one category for {cat_id}, updated {updated}')

    for film_id, price in movie_prices.items():
        updated = Movie.objects.filter(film_id=film_id).update(price=price)
        if updated != 1:
            raise RuntimeError(f'Expected one movie for {film_id}, updated {updated}')


def apply_prices(apps, schema_editor):
    set_prices(apps, schema_editor, CATEGORY_PRICES, MOVIE_PRICES)


def restore_prices(apps, schema_editor):
    set_prices(
        apps,
        schema_editor,
        PREVIOUS_CATEGORY_PRICES,
        PREVIOUS_MOVIE_PRICES,
    )


class Migration(migrations.Migration):
    dependencies = [
        ('database', '0012_order_created_at_orderitem_paymenttoken_paidfilm'),
    ]

    operations = [
        migrations.RunPython(apply_prices, restore_prices),
    ]
