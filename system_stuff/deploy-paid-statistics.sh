#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
STATS_DIR=$APP_ROOT/statisticsDataServer
CONTROL_DIR=$APP_ROOT/control_server
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/paid-statistics-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.paid-statistics-deploy.XXXXXX")

BACKUP_READY=0
SOURCE_INSTALLED=0
FRONTEND_SWITCHED=0

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop qr2.service control_server.service srv.service stats.service

    if [ "$SOURCE_INSTALLED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      rm -f "$CONTROL_DIR/services/paidPlayback.js"
      rm -f "$CONTROL_DIR/test/paidPlayback.test.js"
      rm -f "$STATS_DIR/statisticsDatabase/migrations/0003_playback_sessions.py"
    fi

    cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"
    cp -a "$BACKUP_DIR/statistics-db.sqlite3" "$STATS_DIR/db.sqlite3"

    if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
      rm -rf "$FRONTEND_DIR/build"
      mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    fi

    systemctl start stats.service srv.service control_server.service qr2.service
  fi

  rm -rf "$WORK_DIR"
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/controllers/index.js|control_server/handlers/index.js|control_server/services/paidPlayback.js|control_server/test/paidPlayback.test.js|srv/database/api.py|srv/database/payment_processor.py|srv/database/tests.py|statisticsDataServer/statisticsDatabase/admin.py|statisticsDataServer/statisticsDatabase/models.py|statisticsDataServer/statisticsDatabase/serializers.py|statisticsDataServer/statisticsDatabase/tests.py|statisticsDataServer/statisticsDatabase/views.py|statisticsDataServer/statisticsDatabase/migrations/0003_playback_sessions.py|qr_svelte5/src/routes/api/stats/+server.js|qr_svelte5/src/routes/stats/+page.svelte)
      ;;
    *)
      echo "Unexpected path in code archive: $archive_path" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$BACKUP_DIR"

sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
sqlite3 "$STATS_DIR/db.sqlite3" ".backup '$BACKUP_DIR/statistics-db.sqlite3'"

tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/controllers/index.js \
  control_server/handlers/index.js \
  srv/database/api.py \
  srv/database/payment_processor.py \
  srv/database/tests.py \
  statisticsDataServer/statisticsDatabase/admin.py \
  statisticsDataServer/statisticsDatabase/models.py \
  statisticsDataServer/statisticsDatabase/serializers.py \
  statisticsDataServer/statisticsDatabase/tests.py \
  statisticsDataServer/statisticsDatabase/views.py

BACKUP_READY=1
mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
FRONTEND_SWITCHED=1

mkdir -p "$WORK_DIR/code"
tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR"
[ -f "$WORK_DIR/build/index.js" ]

mkdir -p "$CONTROL_DIR/services" "$CONTROL_DIR/test"
cp -a "$WORK_DIR/code/control_server/controllers/index.js" "$CONTROL_DIR/controllers/index.js"
cp -a "$WORK_DIR/code/control_server/handlers/index.js" "$CONTROL_DIR/handlers/index.js"
cp -a "$WORK_DIR/code/control_server/services/paidPlayback.js" "$CONTROL_DIR/services/paidPlayback.js"
cp -a "$WORK_DIR/code/control_server/test/paidPlayback.test.js" "$CONTROL_DIR/test/paidPlayback.test.js"
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/payment_processor.py" "$SRV_DIR/database/payment_processor.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/admin.py" "$STATS_DIR/statisticsDatabase/admin.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/models.py" "$STATS_DIR/statisticsDatabase/models.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/serializers.py" "$STATS_DIR/statisticsDatabase/serializers.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/tests.py" "$STATS_DIR/statisticsDatabase/tests.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/views.py" "$STATS_DIR/statisticsDatabase/views.py"
cp -a "$WORK_DIR/code/statisticsDataServer/statisticsDatabase/migrations/0003_playback_sessions.py" "$STATS_DIR/statisticsDatabase/migrations/0003_playback_sessions.py"
SOURCE_INSTALLED=1

(cd "$STATS_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$STATS_DIR" && venv/bin/python manage.py test statisticsDatabase)
(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
(cd "$CONTROL_DIR" && node --test)

(cd "$STATS_DIR" && venv/bin/python manage.py migrate statisticsDatabase)

mv "$WORK_DIR/build" "$FRONTEND_DIR/build"
rm -rf "$WORK_DIR"

systemctl restart stats.service
systemctl restart srv.service
systemctl restart control_server.service
systemctl restart qr2.service

systemctl is-active --quiet stats.service
systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr2.service

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8002/admin/login/ >/dev/null
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/stats >/dev/null

invalid_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{}' \
  http://127.0.0.1:8002/api/update_statistics/)
[ "$invalid_status" = 400 ]

trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
