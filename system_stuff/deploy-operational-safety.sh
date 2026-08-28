#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
CONTROL_DIR=$APP_ROOT/control_server
UNIT_PATH=/etc/systemd/system/qr-access-maintenance.service
BACKUP_DIR=$APP_ROOT/backups/operational-safety-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.operational-safety-deploy.XXXXXX")

BACKUP_READY=0
INSTALL_STARTED=0
BACKUP_COMMAND_EXISTED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.operational-safety-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring source files from $BACKUP_DIR" >&2
  if [ "$BACKUP_READY" -eq 1 ] && [ "$INSTALL_STARTED" -eq 1 ]; then
    tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
    if [ "$BACKUP_COMMAND_EXISTED" -eq 1 ]; then
      cp -a "$BACKUP_DIR/backup_database.py" \
        "$SRV_DIR/database/management/commands/backup_database.py"
    else
      rm -f "$SRV_DIR/database/management/commands/backup_database.py"
    fi
    if [ -f "$BACKUP_DIR/qr-access-maintenance.service" ]; then
      cp -a "$BACKUP_DIR/qr-access-maintenance.service" "$UNIT_PATH"
    fi
    systemctl daemon-reload
    systemctl restart srv.service control_server.service
  fi
  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/operational-safety-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/handlers/index.js|\
    control_server/services/paidPlayback.js|\
    srv/database/payment_processor.py|\
    srv/database/management/commands/backup_database.py|\
    system_stuff/qr-access-maintenance.service) ;;
    *) echo "Unexpected path in archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 5 ]

mkdir -p "$BACKUP_DIR" "$WORK_DIR/code"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
sqlite3 "$BACKUP_DIR/srv-db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/handlers/index.js \
  control_server/services/paidPlayback.js \
  srv/database/payment_processor.py
if [ -f "$SRV_DIR/database/management/commands/backup_database.py" ]; then
  cp -a "$SRV_DIR/database/management/commands/backup_database.py" "$BACKUP_DIR/"
  BACKUP_COMMAND_EXISTED=1
fi
cp -a "$UNIT_PATH" "$BACKUP_DIR/qr-access-maintenance.service"
BACKUP_READY=1

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
INSTALL_STARTED=1
cp -a "$WORK_DIR/code/control_server/handlers/index.js" \
  "$CONTROL_DIR/handlers/index.js"
cp -a "$WORK_DIR/code/control_server/services/paidPlayback.js" \
  "$CONTROL_DIR/services/paidPlayback.js"
cp -a "$WORK_DIR/code/srv/database/payment_processor.py" \
  "$SRV_DIR/database/payment_processor.py"
mkdir -p "$SRV_DIR/database/management/commands"
cp -a "$WORK_DIR/code/srv/database/management/commands/backup_database.py" \
  "$SRV_DIR/database/management/commands/backup_database.py"
cp -a "$WORK_DIR/code/system_stuff/qr-access-maintenance.service" "$UNIT_PATH"

(cd "$CONTROL_DIR" && node --test)
(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
mkdir -p "$WORK_DIR/backup-smoke"
(cd "$SRV_DIR" && venv/bin/python manage.py backup_database \
  --destination "$WORK_DIR/backup-smoke" --keep 2)
[ "$(find "$WORK_DIR/backup-smoke" -maxdepth 1 -type f -name 'qr-db-*.sqlite3' | wc -l)" -eq 1 ]

systemctl daemon-reload
systemctl restart srv.service control_server.service
systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr-access-maintenance.timer

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null

free_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"VDNH/40","film_id":"russia"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$free_response" | grep '"valid":true' >/dev/null
printf '%s' "$free_response" | grep '"free_access":true' >/dev/null

paid_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"VDNH/30","film_id":"russia"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$paid_response" | grep '"free_access":false' >/dev/null

systemctl start qr-access-maintenance.service
systemctl is-failed --quiet qr-access-maintenance.service && exit 1
daily_backup=$(find "$APP_ROOT/backups/daily-db" -maxdepth 1 -type f \
  -name 'qr-db-*.sqlite3' | sort | tail -n 1)
[ -n "$daily_backup" ]
sqlite3 "$daily_backup" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
[ "$(find "$APP_ROOT/backups/daily-db" -maxdepth 1 -type f -name 'qr-db-*.sqlite3' | wc -l)" -le 14 ]

cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR; daily database: $daily_backup"
