#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
CONTROL_DIR=$APP_ROOT/control_server
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/viewer-session-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.viewer-session-deploy.XXXXXX")

BACKUP_READY=0
SOURCE_INSTALLED=0
FRONTEND_SWITCHED=0

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop qr2.service control_server.service srv.service

    if [ "$SOURCE_INSTALLED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
    fi

    if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
      rm -rf "$FRONTEND_DIR/build"
      mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    fi

    systemctl start srv.service control_server.service qr2.service
  fi

  rm -rf "$WORK_DIR"
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/handlers/index.js|control_server/services/paidPlayback.js|control_server/test/paidPlayback.test.js|control_server/test/queue.test.js|srv/database/api.py|srv/database/tests.py|srv/srv/settings.py)
      ;;
    *)
      echo "Unexpected path in code archive: $archive_path" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/handlers/index.js \
  control_server/services/paidPlayback.js \
  control_server/test/paidPlayback.test.js \
  control_server/test/queue.test.js \
  srv/database/api.py \
  srv/database/tests.py \
  srv/srv/settings.py

BACKUP_READY=1
mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
FRONTEND_SWITCHED=1

mkdir -p "$WORK_DIR/code"
tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR"
[ -f "$WORK_DIR/build/index.js" ]

cp -a "$WORK_DIR/code/control_server/handlers/index.js" "$CONTROL_DIR/handlers/index.js"
cp -a "$WORK_DIR/code/control_server/services/paidPlayback.js" "$CONTROL_DIR/services/paidPlayback.js"
cp -a "$WORK_DIR/code/control_server/test/paidPlayback.test.js" "$CONTROL_DIR/test/paidPlayback.test.js"
cp -a "$WORK_DIR/code/control_server/test/queue.test.js" "$CONTROL_DIR/test/queue.test.js"
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"
cp -a "$WORK_DIR/code/srv/srv/settings.py" "$SRV_DIR/srv/settings.py"
SOURCE_INSTALLED=1

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
(cd "$CONTROL_DIR" && node --test)

mv "$WORK_DIR/build" "$FRONTEND_DIR/build"
rm -rf "$WORK_DIR"

systemctl restart srv.service
systemctl restart control_server.service
systemctl restart qr2.service

systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr2.service

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/ >/dev/null

direct_access_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/0","film_id":"__missing__"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$direct_access_response" | grep '"success":true' >/dev/null
printf '%s' "$direct_access_response" | grep '"valid":false' >/dev/null

direct_reset_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/0"}' \
  http://127.0.0.1:8000/api/tokens/end_viewer_session/)
printf '%s' "$direct_reset_response" | grep '"success":true' >/dev/null
printf '%s' "$direct_reset_response" | grep '"deactivated":0' >/dev/null

external_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --resolve cinema.local.vr360.pro:443:127.0.0.1 \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/0","film_id":"__missing__"}' \
  https://cinema.local.vr360.pro/api/tokens/viewer_film_access/)
[ "$external_status" = 403 ]

trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
