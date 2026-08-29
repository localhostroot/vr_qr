VIDEO_ID_ALIASES = {
    'volga_2': 'volga',
    'geo_01_01': 'geo_02_01',
    'geo_01_02': 'geo_02_02',
    'geo_01_03': 'geo_02_03',
    'geo_01_04': 'geo_02_04',
    'geo_01_05': 'geo_02_06',
    'geo_01_06': 'geo_02_05',
}

CANONICAL_VIDEO_TITLES = {
    'volga': 'Течет река Волга',
    'geo_02_01': 'Александр Колчак',
    'geo_02_02': 'Пётр Козлов',
    'geo_02_03': 'Николай Миклухо-Маклай',
    'geo_02_04': 'Константин Романов',
    'geo_02_05': 'Пётр Семёнов Тян-Шанский',
    'geo_02_06': 'Юлий Шокальский',
}


def normalize_video_id(value):
    video_id = str(value or '').strip()
    return VIDEO_ID_ALIASES.get(video_id, video_id)


def canonical_video_title(video_id):
    normalized_id = normalize_video_id(video_id)
    return CANONICAL_VIDEO_TITLES.get(normalized_id, normalized_id)
