#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend source archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
STATS_DIR=$APP_ROOT/statisticsDataServer
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/statistics-canonicalization-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.statistics-canonicalization.XXXXXX")
NEW_SOURCE_LIST=$BACKUP_DIR/new-source-files.txt

SOURCE_INSTALLED=0
DB_BACKUP_READY=0
FRONTEND_SWITCHED=0

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return
  trap - EXIT HUP INT TERM
  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$SOURCE_INSTALLED" -eq 1 ] || [ "$DB_BACKUP_READY" -eq 1 ] || [ "$FRONTEND_SWITCHED" -eq 1 ]; then
    systemctl stop stats.service qr2.service
  fi

  if [ "$SOURCE_INSTALLED" -eq 1 ]; then
    if [ -s "$BACKUP_DIR/source-files.tar.gz" ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
    fi
    if [ -f "$NEW_SOURCE_LIST" ]; then
      while IFS= read -r relative_path; do
        case "$relative_path" in
          statisticsDataServer/statisticsDatabase/video_identity.py|\
          statisticsDataServer/statisticsDatabase/migrations/0005_merge_volga_video_alias.py|\
          statisticsDataServer/statisticsDatabase/migrations/0006_merge_geography_and_remove_obsolete_locations.py)
            rm -f "$APP_ROOT/$relative_path"
            ;;
        esac
      done < "$NEW_SOURCE_LIST"
    fi
  fi

  if [ "$DB_BACKUP_READY" -eq 1 ]; then
    cp -a "$BACKUP_DIR/statistics-db.sqlite3" "$STATS_DIR/db.sqlite3"
  fi

  if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
    [ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
    rm -rf "$FRONTEND_DIR/build"
    mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
  fi

  if [ "$SOURCE_INSTALLED" -eq 1 ] || [ "$DB_BACKUP_READY" -eq 1 ] || [ "$FRONTEND_SWITCHED" -eq 1 ]; then
    systemctl start stats.service qr2.service
  fi
  case "$WORK_DIR" in
    /opt/qr_app/.statistics-canonicalization.*) rm -rf "$WORK_DIR" ;;
  esac
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$STATS_DIR" = /opt/qr_app/statisticsDataServer ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/statistics-canonicalization-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -x "$STATS_DIR/venv/bin/python" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -d "$FRONTEND_DIR/build" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    statisticsDataServer/statisticsDatabase/serializers.py|\
    statisticsDataServer/statisticsDatabase/views.py|\
    statisticsDataServer/statisticsDatabase/tests.py|\
    statisticsDataServer/statisticsDatabase/test_migrations.py|\
    statisticsDataServer/statisticsDatabase/video_identity.py|\
    statisticsDataServer/statisticsDatabase/migrations/0005_merge_volga_video_alias.py|\
    statisticsDataServer/statisticsDatabase/migrations/0006_merge_geography_and_remove_obsolete_locations.py)
      ;;
    *) echo "Unexpected path in code archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 7 ]

tar -tzf "$FRONTEND_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    /*|../*|*/../*)
      echo "Unsafe path in frontend archive: $archive_path" >&2
      exit 1
      ;;
  esac
done
tar -tzf "$FRONTEND_ARCHIVE" | grep '^package.json$' >/dev/null
tar -tzf "$FRONTEND_ARCHIVE" | grep '^svelte.config.js$' >/dev/null
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/stats/+page.svelte$' >/dev/null

mkdir -p "$BACKUP_DIR" "$WORK_DIR/frontend"
existing_files=
: > "$NEW_SOURCE_LIST"
for relative_path in $(tar -tzf "$CODE_ARCHIVE"); do
  if [ -f "$APP_ROOT/$relative_path" ]; then
    existing_files="$existing_files $relative_path"
  else
    printf '%s\n' "$relative_path" >> "$NEW_SOURCE_LIST"
  fi
done
if [ -n "$existing_files" ]; then
  tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" $existing_files
else
  : > "$BACKUP_DIR/source-files.tar.gz"
fi

tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# Reuse the production-only frontend values without printing them.
set -- "$FRONTEND_DIR"/build/server/chunks/private-*.js
[ "$#" -eq 1 ]
private_chunk=$1
[ -f "$private_chunk" ]
read_private_export() {
  node --input-type=module -e '
    import { pathToFileURL } from "node:url";
    const module = await import(pathToFileURL(process.argv[1]));
    process.stdout.write(String(module[process.argv[2]] ?? ""));
  ' "$private_chunk" "$1"
}
private_stats_login=$(read_private_export P)
private_stats_password=$(read_private_export a)
private_statistics_server_url=$(read_private_export b)
private_stats_token=$(read_private_export c)
[ -n "$private_stats_login" ]
[ -n "$private_stats_password" ]
[ -n "$private_statistics_server_url" ]
[ -n "$private_stats_token" ]

(cd "$WORK_DIR/frontend" && \
  PUBLIC_DATABASE=https://cinema.local.vr360.pro/ \
  PUBLIC_BACKEND=wss://cinema.local.vr360.pro/control/api/ \
  PUBLIC_STAT=https://cinema.local.vr360.pro/ \
  PRIVATE_STATS_LOGIN="$private_stats_login" \
  PRIVATE_STATS_PASSWORD="$private_stats_password" \
  PRIVATE_STATISTICS_SERVER_URL="$private_statistics_server_url" \
  PRIVATE_STATS_TOKEN="$private_stats_token" \
  npm run build)
[ -f "$WORK_DIR/frontend/build/index.js" ]

tar -xzf "$CODE_ARCHIVE" -C "$APP_ROOT"
SOURCE_INSTALLED=1
(cd "$STATS_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$STATS_DIR" && venv/bin/python manage.py test statisticsDatabase)

sessions_before=$(sqlite3 "$STATS_DIR/db.sqlite3" \
  'SELECT count(*) FROM statisticsDatabase_playbacksession;')
non_vdnh_sessions_before=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*)
  FROM statisticsDatabase_playbacksession s
  JOIN statisticsDatabase_location l ON l.id=s.location_id
  WHERE upper(l.name) <> 'VDNH';
")
[ "$non_vdnh_sessions_before" -eq 0 ]
geo_sessions_before=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*)
  FROM statisticsDatabase_playbacksession s
  JOIN statisticsDatabase_video v ON v.id=s.video_id
  WHERE v.video_id LIKE 'geo_01_%' OR v.video_id LIKE 'geo_02_%';
")
geo_views_before=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT total(views)
  FROM statisticsDatabase_video
  WHERE video_id LIKE 'geo_01_%' OR video_id LIKE 'geo_02_%';
")
volga_sessions_before=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*)
  FROM statisticsDatabase_playbacksession s
  JOIN statisticsDatabase_video v ON v.id=s.video_id
  WHERE v.video_id IN ('volga', 'volga_2');
")
volga_views_before=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT total(views)
  FROM statisticsDatabase_video
  WHERE video_id IN ('volga', 'volga_2');
")

systemctl stop stats.service
sqlite3 "$STATS_DIR/db.sqlite3" ".backup '$BACKUP_DIR/statistics-db.sqlite3'"
sqlite3 "$BACKUP_DIR/statistics-db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
DB_BACKUP_READY=1

(cd "$STATS_DIR" && venv/bin/python manage.py migrate statisticsDatabase)
sqlite3 "$STATS_DIR/db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null

sessions_after=$(sqlite3 "$STATS_DIR/db.sqlite3" \
  'SELECT count(*) FROM statisticsDatabase_playbacksession;')
[ "$sessions_after" = "$sessions_before" ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" 'SELECT count(*) FROM statisticsDatabase_location;')" -eq 1 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_location WHERE name='VDNH';")" -eq 1 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_video WHERE video_id LIKE 'geo_01_%';")" -eq 0 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_video WHERE video_id LIKE 'geo_02_%';")" -eq 6 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_playbacksession s JOIN statisticsDatabase_video v ON v.id=s.video_id WHERE v.video_id LIKE 'geo_02_%';")" = "$geo_sessions_before" ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT total(views) FROM statisticsDatabase_video WHERE video_id LIKE 'geo_02_%';")" = "$geo_views_before" ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_video WHERE video_id='volga';")" -eq 1 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_video WHERE video_id='volga_2';")" -eq 0 ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT count(*) FROM statisticsDatabase_playbacksession s JOIN statisticsDatabase_video v ON v.id=s.video_id WHERE v.video_id='volga';")" = "$volga_sessions_before" ]
[ "$(sqlite3 "$STATS_DIR/db.sqlite3" "SELECT total(views) FROM statisticsDatabase_video WHERE video_id='volga';")" = "$volga_views_before" ]

video_mismatches=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*) FROM statisticsDatabase_video v
  WHERE v.launches <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.video_id=v.id)
     OR v.abandoned <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.video_id=v.id AND s.status='abandoned')
     OR v.viewed <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.video_id=v.id AND s.status='viewed');
")
device_mismatches=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*) FROM statisticsDatabase_device d
  WHERE d.launches <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.device_id=d.id)
     OR d.abandoned <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.device_id=d.id AND s.status='abandoned')
     OR d.viewed <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.device_id=d.id AND s.status='viewed');
")
location_mismatches=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*) FROM statisticsDatabase_location l
  WHERE l.launches <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.location_id=l.id)
     OR l.abandoned <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.location_id=l.id AND s.status='abandoned')
     OR l.viewed <> (SELECT count(*) FROM statisticsDatabase_playbacksession s WHERE s.location_id=l.id AND s.status='viewed');
")
[ "$video_mismatches" -eq 0 ]
[ "$device_mismatches" -eq 0 ]
[ "$location_mismatches" -eq 0 ]

mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"
FRONTEND_SWITCHED=1

systemctl restart stats.service qr2.service
systemctl is-active --quiet stats.service
systemctl is-active --quiet qr2.service

curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8002/admin/login/ >/dev/null
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/stats >/dev/null

curl --fail --silent --show-error \
  --header "Authorization: Token $private_stats_token" \
  http://127.0.0.1:8002/api/videos/ > "$WORK_DIR/videos.json"
"$STATS_DIR/venv/bin/python" - "$WORK_DIR/videos.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    videos = json.load(source)

ids = {video['video_id'] for video in videos}
expected_geography = {f'geo_02_0{index}' for index in range(1, 7)}
assert expected_geography <= ids
assert 'volga' in ids
assert 'volga_2' not in ids
assert 'test' not in ids
assert len(videos) == 14
PY

(cd "$STATS_DIR" && venv/bin/python manage.py shell -c "
from statisticsDatabase.serializers import StatisticsSerializer
from statisticsDatabase.models import Location
payload = {'event': 'start', 'session_id': 'location-check', 'client_id': '1', 'location_name': 'CDH', 'video_id': 'russia'}
serializer = StatisticsSerializer(data=payload)
assert not serializer.is_valid()
assert not Location.objects.filter(name='CDH').exists()
")

case "$WORK_DIR" in
  /opt/qr_app/.statistics-canonicalization.*) rm -rf "$WORK_DIR" ;;
esac
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
echo "Invariants: sessions=$sessions_after geography_sessions=$geo_sessions_before geography_views=$geo_views_before volga_sessions=$volga_sessions_before volga_views=$volga_views_before mismatches=$video_mismatches/$device_mismatches/$location_mismatches"
