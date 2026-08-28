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
SOURCE_INSTALL_STARTED=0
FRONTEND_SWITCHED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.viewer-session-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop qr2.service control_server.service srv.service
    cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"

    if [ "$SOURCE_INSTALL_STARTED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      rm -f "$CONTROL_DIR/utils/viewerIdentity.js"
      rm -f "$SRV_DIR/database/viewer_identity.py"
      rm -f "$SRV_DIR/database/migrations/0015_order_viewer_session_id.py"
      rm -f "$SRV_DIR/database/migrations/0016_normalize_numeric_viewer_ids.py"
      if [ -f "$BACKUP_DIR/optional-source-files.tar.gz" ]; then
        tar -xzf "$BACKUP_DIR/optional-source-files.tar.gz" -C "$APP_ROOT"
      fi
    fi

    if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
      rm -rf "$FRONTEND_DIR/build"
      mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    fi

    systemctl start srv.service control_server.service qr2.service
  fi

  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/viewer-session-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/controllers/index.js|control_server/handlers/index.js|control_server/services/paidPlayback.js|control_server/test/paidPlayback.test.js|control_server/test/queue.test.js|control_server/utils/viewerIdentity.js|srv/database/api.py|srv/database/models.py|srv/database/payment_processor.py|srv/database/tests.py|srv/database/viewer_identity.py|srv/database/migrations/0015_order_viewer_session_id.py|srv/database/migrations/0016_normalize_numeric_viewer_ids.py)
      ;;
    *)
      echo "Unexpected path in code archive: $archive_path" >&2
      exit 1
      ;;
  esac
done

tar -tzf "$FRONTEND_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    build|build/|build/*)
      case "$archive_path" in
        /*|*../*|*/..|..) echo "Unsafe frontend archive path: $archive_path" >&2; exit 1 ;;
      esac
      ;;
    *)
      echo "Unexpected path in frontend archive: $archive_path" >&2
      exit 1
      ;;
  esac
done
tar -tzf "$FRONTEND_ARCHIVE" | grep '^build/index.js$' >/dev/null

mkdir -p "$BACKUP_DIR"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/controllers/index.js \
  control_server/handlers/index.js \
  control_server/services/paidPlayback.js \
  control_server/test/paidPlayback.test.js \
  control_server/test/queue.test.js \
  srv/database/api.py \
  srv/database/models.py \
  srv/database/payment_processor.py \
  srv/database/tests.py

optional_backup_files=
for optional_path in \
  control_server/utils/viewerIdentity.js \
  srv/database/viewer_identity.py \
  srv/database/migrations/0015_order_viewer_session_id.py \
  srv/database/migrations/0016_normalize_numeric_viewer_ids.py
do
  if [ -f "$APP_ROOT/$optional_path" ]; then
    optional_backup_files="$optional_backup_files $optional_path"
  fi
done
if [ -n "$optional_backup_files" ]; then
  # Paths are fixed deployment paths without spaces; intentional word splitting.
  # shellcheck disable=SC2086
  tar -czf "$BACKUP_DIR/optional-source-files.tar.gz" -C "$APP_ROOT" $optional_backup_files
fi
BACKUP_READY=1

mkdir -p "$WORK_DIR/code" "$WORK_DIR/frontend"
tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
[ -f "$WORK_DIR/frontend/build/index.js" ]

mkdir -p "$CONTROL_DIR/utils" "$CONTROL_DIR/test"
SOURCE_INSTALL_STARTED=1
cp -a "$WORK_DIR/code/control_server/controllers/index.js" "$CONTROL_DIR/controllers/index.js"
cp -a "$WORK_DIR/code/control_server/handlers/index.js" "$CONTROL_DIR/handlers/index.js"
cp -a "$WORK_DIR/code/control_server/services/paidPlayback.js" "$CONTROL_DIR/services/paidPlayback.js"
cp -a "$WORK_DIR/code/control_server/test/paidPlayback.test.js" "$CONTROL_DIR/test/paidPlayback.test.js"
cp -a "$WORK_DIR/code/control_server/test/queue.test.js" "$CONTROL_DIR/test/queue.test.js"
cp -a "$WORK_DIR/code/control_server/utils/viewerIdentity.js" "$CONTROL_DIR/utils/viewerIdentity.js"
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/models.py" "$SRV_DIR/database/models.py"
cp -a "$WORK_DIR/code/srv/database/payment_processor.py" "$SRV_DIR/database/payment_processor.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"
cp -a "$WORK_DIR/code/srv/database/viewer_identity.py" "$SRV_DIR/database/viewer_identity.py"
cp -a "$WORK_DIR/code/srv/database/migrations/0015_order_viewer_session_id.py" "$SRV_DIR/database/migrations/0015_order_viewer_session_id.py"
cp -a "$WORK_DIR/code/srv/database/migrations/0016_normalize_numeric_viewer_ids.py" "$SRV_DIR/database/migrations/0016_normalize_numeric_viewer_ids.py"

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
(cd "$CONTROL_DIR" && node --test)

systemctl stop qr2.service control_server.service srv.service
(cd "$SRV_DIR" && venv/bin/python manage.py migrate database)

mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
FRONTEND_SWITCHED=1
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
cleanup_work

systemctl start srv.service control_server.service qr2.service

systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr2.service

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null
curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/ >/dev/null

normalized_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/00","film_id":"__missing__"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$normalized_response" | grep '"success":true' >/dev/null
printf '%s' "$normalized_response" | grep '"valid":false' >/dev/null
printf '%s' "$normalized_response" | grep '"viewer_id":"__codex_smoke__/0"' >/dev/null

external_status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --resolve cinema.local.vr360.pro:443:127.0.0.1 \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/00","film_id":"__missing__"}' \
  https://cinema.local.vr360.pro/api/tokens/viewer_film_access/)
[ "$external_status" = 403 ]

trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
