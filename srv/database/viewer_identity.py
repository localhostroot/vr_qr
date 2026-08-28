def normalize_viewer_id(value):
    """Return one stable database/control-server id for a headset route.

    Printed URLs may use zero-padded numbers (``VDNH/02``), while the headset
    application reports the same device as ``VDNH/2``.  Numeric suffixes are
    canonicalized without changing non-numeric ids.
    """
    viewer_id = str(value or '').strip()
    if '/' not in viewer_id:
        return viewer_id

    location, headset_id = viewer_id.rsplit('/', 1)
    location = location.strip()
    headset_id = headset_id.strip()
    if headset_id.isdecimal():
        headset_id = str(int(headset_id))
    return f'{location}/{headset_id}'
