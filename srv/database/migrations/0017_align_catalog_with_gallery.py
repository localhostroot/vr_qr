from django.db import migrations, models


CATEGORY_IDS = {
    'geo_02': ('geo_02',),
    'kb_00': ('kb_00',),
    'russia': ('russia',),
    'tyva': ('tyva', 'tv_00'),
    'volga': ('volga', 'volga_2'),
}

MOVIE_IDS = {
    'geo_02_01',
    'geo_02_02',
    'geo_02_03',
    'geo_02_04',
    'geo_02_05',
    'geo_02_06',
    'kb_01',
    'kb_02',
    'russia',
    'tyva_01',
    'tyva_02',
    'tyva_03',
    'tyva_04',
    'volga',
}

HISTORICAL_FILM_IDS = {
    'kb': 'kb_00',
    'tv': 'tyva',
    'volga_2': 'volga',
}


def align_catalog(apps, schema_editor):
    Category = apps.get_model('database', 'Category')
    Movie = apps.get_model('database', 'Movie')
    OrderItem = apps.get_model('database', 'OrderItem')
    PaidFilm = apps.get_model('database', 'PaidFilm')

    # Fresh test/development databases have no catalogue to migrate.
    if not Category.objects.exists() and not Movie.objects.exists():
        return

    # This section and its episodes are absent from the approved gallery.
    # The transaction keeps the deletion atomic with all ID normalisation.
    Category.objects.filter(cat_id='geo_01').delete()

    categories = {}
    for target_id, accepted_ids in CATEGORY_IDS.items():
        matches = Category.objects.filter(cat_id__in=accepted_ids)
        match_count = matches.count()
        if match_count != 1:
            raise RuntimeError(
                f'Expected one category for {target_id}, found {match_count}',
            )
        category = matches.get()
        category.cat_id = target_id
        category.film_id = target_id
        category.serial = target_id not in {'russia', 'volga'}
        category.save(update_fields=('cat_id', 'film_id', 'serial'))
        categories[target_id] = category

    actual_category_ids = set(
        Category.objects.values_list('cat_id', flat=True)
    )
    if actual_category_ids != set(CATEGORY_IDS):
        raise RuntimeError(
            'Category IDs do not match the approved gallery: '
            f'{sorted(actual_category_ids)}',
        )

    # The web catalogue represents a root video as a non-serial Category plus
    # one playable Movie. Older local snapshots lack the Movie rows, while the
    # production database already has them and must retain their primary keys.
    for film_id in ('russia', 'volga'):
        movies = Movie.objects.filter(film_id=film_id)
        movie_count = movies.count()
        if movie_count > 1:
            raise RuntimeError(
                f'Expected at most one movie for {film_id}, found {movie_count}',
            )
        category = categories[film_id]
        if movie_count == 0:
            Movie.objects.create(
                film_id=film_id,
                name=category.name,
                name_short=category.name_short,
                description=category.description,
                route_id=category.route_id,
                year=category.year,
                country=category.country,
                number=category.number or '',
                serial=True,
                isAdded=category.isAdded,
                cat_id=category,
                image=category.image,
                time=category.time,
                format=category.format,
                price=category.price,
                series=True,
                backImg=category.backImg,
                queueImg=category.queueImg or category.image,
            )
        else:
            movies.update(cat_id=category)

    actual_movie_ids = set(Movie.objects.values_list('film_id', flat=True))
    if actual_movie_ids != MOVIE_IDS:
        raise RuntimeError(
            'Movie IDs do not match the approved gallery: '
            f'{sorted(actual_movie_ids)}',
        )

    # Orders and access grants are financial history, so retain their rows and
    # move only legacy identifiers that changed in the catalogue.
    for old_id, new_id in HISTORICAL_FILM_IDS.items():
        OrderItem.objects.filter(film_id=old_id).update(film_id=new_id)
        PaidFilm.objects.filter(film_id=old_id).update(film_id=new_id)


class Migration(migrations.Migration):

    dependencies = [
        ('database', '0016_normalize_numeric_viewer_ids'),
    ]

    operations = [
        migrations.RunPython(align_catalog, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='category',
            name='cat_id',
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.AlterField(
            model_name='category',
            name='film_id',
            field=models.CharField(max_length=100, unique=True),
        ),
        migrations.AlterField(
            model_name='movie',
            name='film_id',
            field=models.CharField(max_length=100, unique=True),
        ),
    ]
