import re


def normalize_headset_id(value):
    """Return the stable string key used for headset identity."""
    headset_id = str(value or '').strip()
    if not re.fullmatch(r'[0-9]+', headset_id):
        return headset_id
    return re.sub(r'^0+(?=\d)', '', headset_id)
