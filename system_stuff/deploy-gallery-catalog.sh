#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
CONTROL_DIR=$APP_ROOT/control_server
BACKUP_DIR=$APP_ROOT/backups/gallery-catalog-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.gallery-catalog-deploy.XXXXXX")
EXPECTED_GALLERY_SHA256=808fc30d5ed03d09cdeaa6c4ad89b29577fa68fd52f14ffc2043d035faf35f43

BACKUP_READY=0
SOURCE_INSTALL_STARTED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.gallery-catalog-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

start_services() {
  systemctl restart srv.service control_server.service
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2
  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop srv.service control_server.service
    if [ "$SOURCE_INSTALL_STARTED" -eq 1 ]; then
      rm -f \
        "$SRV_DIR/database/management/commands/audit_gallery_catalog.py" \
        "$SRV_DIR/database/migrations/0017_align_catalog_with_gallery.py" \
        "$SRV_DIR/database/test_gallery_catalog.py"
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"
    fi
    start_services
  fi
  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/gallery-catalog-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]
[ -f "$SRV_DIR/db.sqlite3" ]
[ -f "$CONTROL_DIR/configs/gallery.json" ]
[ ! -e "$SRV_DIR/database/management/commands/audit_gallery_catalog.py" ]
[ ! -e "$SRV_DIR/database/migrations/0017_align_catalog_with_gallery.py" ]
[ ! -e "$SRV_DIR/database/test_gallery_catalog.py" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/configs/gallery.json|\
    srv/database/management/commands/audit_gallery_catalog.py|\
    srv/database/management/commands/catalog_prices.py|\
    srv/database/migrations/0017_align_catalog_with_gallery.py|\
    srv/database/models.py|\
    srv/database/test_gallery_catalog.py|\
    srv/database/tests.py) ;;
    *) echo "Unexpected path in archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 7 ]

archive_gallery_hash=$(tar -xOf "$CODE_ARCHIVE" control_server/configs/gallery.json | sha256sum | awk '{print $1}')
[ "$archive_gallery_hash" = "$EXPECTED_GALLERY_SHA256" ]

mkdir -p "$BACKUP_DIR" "$WORK_DIR/code"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/configs/gallery.json \
  srv/database/management/commands/catalog_prices.py \
  srv/database/models.py \
  srv/database/tests.py
BACKUP_READY=1

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"

systemctl stop srv.service control_server.service
SOURCE_INSTALL_STARTED=1
cp -a "$WORK_DIR/code/control_server/configs/gallery.json" \
  "$CONTROL_DIR/configs/gallery.json"
cp -a "$WORK_DIR/code/srv/database/models.py" \
  "$SRV_DIR/database/models.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" \
  "$SRV_DIR/database/tests.py"
cp -a "$WORK_DIR/code/srv/database/test_gallery_catalog.py" \
  "$SRV_DIR/database/test_gallery_catalog.py"
cp -a "$WORK_DIR/code/srv/database/management/commands/audit_gallery_catalog.py" \
  "$SRV_DIR/database/management/commands/audit_gallery_catalog.py"
cp -a "$WORK_DIR/code/srv/database/management/commands/catalog_prices.py" \
  "$SRV_DIR/database/management/commands/catalog_prices.py"
cp -a "$WORK_DIR/code/srv/database/migrations/0017_align_catalog_with_gallery.py" \
  "$SRV_DIR/database/migrations/0017_align_catalog_with_gallery.py"

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py migrate --noinput)
(cd "$SRV_DIR" && venv/bin/python manage.py audit_gallery_catalog)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)

installed_gallery_hash=$(sha256sum "$CONTROL_DIR/configs/gallery.json" | awk '{print $1}')
[ "$installed_gallery_hash" = "$EXPECTED_GALLERY_SHA256" ]

start_services
systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service

curl --fail --silent --show-error --retry 10 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null
curl --fail --silent --show-error \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/movie/ >/dev/null
(cd "$SRV_DIR" && venv/bin/python manage.py audit_gallery_catalog)

cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
