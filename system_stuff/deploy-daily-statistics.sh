#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?statistics code archive is required}
FRONTEND_ARCHIVE=${2:?frontend source archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
STATS_DIR=$APP_ROOT/statisticsDataServer
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/daily-statistics-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.daily-statistics.XXXXXX")

BACKEND_INSTALLED=0
STATS_RESTARTED=0
FRONTEND_SWITCHED=0

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return
  trap - EXIT HUP INT TERM
  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
    systemctl stop qr2.service
    [ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
    rm -rf "$FRONTEND_DIR/build"
    mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    systemctl start qr2.service
  fi

  if [ "$BACKEND_INSTALLED" -eq 1 ]; then
    cp -a "$BACKUP_DIR/statisticsDatabase/views.py" "$STATS_DIR/statisticsDatabase/views.py"
    cp -a "$BACKUP_DIR/statisticsDatabase/urls.py" "$STATS_DIR/statisticsDatabase/urls.py"
    cp -a "$BACKUP_DIR/statisticsDatabase/tests.py" "$STATS_DIR/statisticsDatabase/tests.py"
    if [ "$STATS_RESTARTED" -eq 1 ]; then
      systemctl restart stats.service
    fi
  fi

  case "$WORK_DIR" in
    /opt/qr_app/.daily-statistics.*) rm -rf "$WORK_DIR" ;;
  esac
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$STATS_DIR" = /opt/qr_app/statisticsDataServer ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/daily-statistics-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -x "$STATS_DIR/venv/bin/python" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -d "$FRONTEND_DIR/build" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    statisticsDataServer/statisticsDatabase/views.py|\
    statisticsDataServer/statisticsDatabase/urls.py|\
    statisticsDataServer/statisticsDatabase/tests.py) ;;
    *) echo "Unexpected code archive path: $archive_path" >&2; exit 1 ;;
  esac
done

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
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/api/stats/+server.js$' >/dev/null
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/stats/+page.svelte$' >/dev/null

mkdir -p "$BACKUP_DIR/statisticsDatabase" "$WORK_DIR/code" "$WORK_DIR/frontend"
cp -a "$STATS_DIR/statisticsDatabase/views.py" "$BACKUP_DIR/statisticsDatabase/views.py"
cp -a "$STATS_DIR/statisticsDatabase/urls.py" "$BACKUP_DIR/statisticsDatabase/urls.py"
cp -a "$STATS_DIR/statisticsDatabase/tests.py" "$BACKUP_DIR/statisticsDatabase/tests.py"
sqlite3 "$STATS_DIR/db.sqlite3" ".backup '$BACKUP_DIR/statistics-db.sqlite3'"
cp -a "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"

cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/views.py" "$STATS_DIR/statisticsDatabase/views.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/urls.py" "$STATS_DIR/statisticsDatabase/urls.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/tests.py" "$STATS_DIR/statisticsDatabase/tests.py"
BACKEND_INSTALLED=1

(cd "$STATS_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$STATS_DIR" && venv/bin/python manage.py test statisticsDatabase)
sqlite3 "$STATS_DIR/db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null

ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# Reuse production-only frontend values without printing them.
set -- "$FRONTEND_DIR"/build/server/chunks/private-*.js
if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  set -- "$FRONTEND_DIR"/build/server/chunks/private.js
fi
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

systemctl restart stats.service
STATS_RESTARTED=1
systemctl is-active --quiet stats.service
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  -H "Authorization: Token $private_stats_token" \
  'http://127.0.0.1:8002/api/daily_video_stats/?location=VDNH&start_date=2026-08-28&end_date=2026-08-30' \
  > "$WORK_DIR/daily-stats.json"
"$STATS_DIR/venv/bin/python" - "$WORK_DIR/daily-stats.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as source:
    payload = json.load(source)

assert payload['timezone'] == 'Europe/Moscow'
assert [day['launches'] for day in payload['days']] == [528, 1263, 865]
assert payload['total'] == {'launches': 2656, 'abandoned': 473, 'viewed': 1989}
assert len(payload['videos']) == 14
PY

systemctl stop qr2.service
rm -rf "$FRONTEND_DIR/build"
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"
FRONTEND_SWITCHED=1
systemctl start qr2.service
systemctl is-active --quiet qr2.service
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/stats >/dev/null
curl --fail --silent --show-error --retry 5 --retry-delay 1 \
  https://cinema.local.vr360.pro/stats >/dev/null

case "$WORK_DIR" in
  /opt/qr_app/.daily-statistics.*) rm -rf "$WORK_DIR" ;;
esac
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
