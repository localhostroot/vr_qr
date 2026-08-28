#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
BACKUP_DIR=$APP_ROOT/backups/free-direct-access-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.free-direct-access-deploy.XXXXXX")

BACKUP_READY=0
INSTALL_STARTED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.free-direct-access-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2
  if [ "$BACKUP_READY" -eq 1 ] && [ "$INSTALL_STARTED" -eq 1 ]; then
    tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
    cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"
    if [ -f "$BACKUP_DIR/qr-access-maintenance.service" ]; then
      cp -a "$BACKUP_DIR/qr-access-maintenance.service" /etc/systemd/system/
    else
      rm -f /etc/systemd/system/qr-access-maintenance.service
    fi
    if [ -f "$BACKUP_DIR/qr-access-maintenance.timer" ]; then
      cp -a "$BACKUP_DIR/qr-access-maintenance.timer" /etc/systemd/system/
    else
      rm -f /etc/systemd/system/qr-access-maintenance.timer
    fi
    systemctl daemon-reload
    systemctl restart srv.service
  fi
  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/free-direct-access-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    srv/database/api.py|\
    srv/database/tests.py|\
    srv/database/management/commands/cleanup_access_state.py|\
    system_stuff/qr-access-maintenance.service|\
    system_stuff/qr-access-maintenance.timer) ;;
    *) echo "Unexpected path in archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 5 ]

mkdir -p "$BACKUP_DIR" "$WORK_DIR/code"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  srv/database/api.py \
  srv/database/tests.py
[ -f /etc/systemd/system/qr-access-maintenance.service ] && \
  cp -a /etc/systemd/system/qr-access-maintenance.service "$BACKUP_DIR/"
[ -f /etc/systemd/system/qr-access-maintenance.timer ] && \
  cp -a /etc/systemd/system/qr-access-maintenance.timer "$BACKUP_DIR/"
BACKUP_READY=1

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
INSTALL_STARTED=1
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"
mkdir -p "$SRV_DIR/database/management/commands"
cp -a "$WORK_DIR/code/srv/database/management/commands/cleanup_access_state.py" \
  "$SRV_DIR/database/management/commands/cleanup_access_state.py"
cp -a "$WORK_DIR/code/system_stuff/qr-access-maintenance.service" \
  /etc/systemd/system/qr-access-maintenance.service
cp -a "$WORK_DIR/code/system_stuff/qr-access-maintenance.timer" \
  /etc/systemd/system/qr-access-maintenance.timer

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
(cd "$SRV_DIR" && venv/bin/python manage.py cleanup_access_state --dry-run)

systemctl daemon-reload
systemctl enable --now qr-access-maintenance.timer
systemctl restart srv.service
systemctl is-active --quiet srv.service
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

unknown_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"VDNH/40","film_id":"__missing__"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$unknown_response" | grep '"valid":false' >/dev/null
printf '%s' "$unknown_response" | grep '"free_access":false' >/dev/null

paid_response=$(curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  --header 'Content-Type: application/json' \
  --data '{"user_id":"VDNH/30","film_id":"russia"}' \
  http://127.0.0.1:8000/api/tokens/viewer_film_access/)
printf '%s' "$paid_response" | grep '"free_access":false' >/dev/null

(cd "$SRV_DIR" && venv/bin/python manage.py cleanup_access_state)

cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
