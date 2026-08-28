#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
BACKUP_DIR=$APP_ROOT/backups/follow-up-lease-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.follow-up-lease-deploy.XXXXXX")

BACKUP_READY=0
SOURCE_INSTALL_STARTED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.follow-up-lease-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2
  if [ "$BACKUP_READY" -eq 1 ]; then
    if [ "$SOURCE_INSTALL_STARTED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"
    fi
    systemctl restart srv.service
  fi
  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/follow-up-lease-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    srv/database/api.py|srv/database/payment_processor.py|srv/database/tests.py) ;;
    *) echo "Unexpected path in archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 3 ]

mkdir -p "$BACKUP_DIR" "$WORK_DIR/code"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  srv/database/api.py \
  srv/database/payment_processor.py \
  srv/database/tests.py
BACKUP_READY=1

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
SOURCE_INSTALL_STARTED=1
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/payment_processor.py" "$SRV_DIR/database/payment_processor.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)

systemctl restart srv.service
systemctl is-active --quiet srv.service

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null

normalized_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"__codex_smoke__/00","film_id":"__missing__"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$normalized_response" | grep '"success":true' >/dev/null
printf '%s' "$normalized_response" | grep '"valid":false' >/dev/null
printf '%s' "$normalized_response" | grep '"viewer_id":"__codex_smoke__/0"' >/dev/null

cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
