#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend source archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
STATS_DIR=$APP_ROOT/statisticsDataServer
CONTROL_DIR=$APP_ROOT/control_server
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/headset-identity-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.headset-identity-deploy.XXXXXX")
NEW_SOURCE_LIST=$BACKUP_DIR/new-source-files.txt

BACKUP_READY=0
SOURCE_INSTALLED=0
DATA_MIGRATION_STARTED=0
FRONTEND_SWITCHED=0

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return
  trap - EXIT HUP INT TERM
  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop qr2.service control_server.service srv.service stats.service

    if [ "$SOURCE_INSTALLED" -eq 1 ]; then
      if [ -s "$BACKUP_DIR/source-files.tar.gz" ]; then
        tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      fi
      if [ -f "$NEW_SOURCE_LIST" ]; then
        while IFS= read -r relative_path; do
          case "$relative_path" in
            control_server/scripts/migrateHeadsetIdentity.js|\
            control_server/test/headsetIdentityMigration.test.js|\
            control_server/test/viewerIdentity.test.js|\
            statisticsDataServer/statisticsDatabase/viewer_identity.py|\
            statisticsDataServer/statisticsDatabase/test_migrations.py|\
            statisticsDataServer/statisticsDatabase/migrations/0004_merge_headset_id_aliases.py)
              rm -f "$APP_ROOT/$relative_path"
              ;;
          esac
        done < "$NEW_SOURCE_LIST"
      fi
    fi

    if [ "$DATA_MIGRATION_STARTED" -eq 1 ]; then
      cp -a "$BACKUP_DIR/statistics-db.sqlite3" "$STATS_DIR/db.sqlite3"
      cp -a "$BACKUP_DIR/presence-history.json" "$CONTROL_DIR/presence-history.json"
      cp -a "$BACKUP_DIR/uptime.json" "$CONTROL_DIR/uptime.json"
    fi

    if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
      test "$FRONTEND_DIR" = /opt/qr_app/qr2
      rm -rf "$FRONTEND_DIR/build"
      mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    fi

    systemctl start stats.service srv.service control_server.service qr2.service
  fi

  test "$WORK_DIR" != /opt/qr_app
  rm -rf "$WORK_DIR"
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$STATS_DIR" = /opt/qr_app/statisticsDataServer ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/headset-identity-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -x "$SRV_DIR/venv/bin/python" ]
[ -x "$STATS_DIR/venv/bin/python" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -d "$FRONTEND_DIR/build" ]
[ -f "$CONTROL_DIR/presence-history.json" ]
[ -f "$CONTROL_DIR/uptime.json" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/controllers/index.js|\
    control_server/handlers/index.js|\
    control_server/state/presenceHistory.js|\
    control_server/utils/viewerIdentity.js|\
    control_server/scripts/migrateHeadsetIdentity.js|\
    control_server/test/headsetIdentityMigration.test.js|\
    control_server/test/presenceHistory.test.js|\
    control_server/test/viewerIdentity.test.js|\
    srv/database/viewer_identity.py|\
    statisticsDataServer/statisticsDatabase/models.py|\
    statisticsDataServer/statisticsDatabase/serializers.py|\
    statisticsDataServer/statisticsDatabase/tests.py|\
    statisticsDataServer/statisticsDatabase/test_migrations.py|\
    statisticsDataServer/statisticsDatabase/viewer_identity.py|\
    statisticsDataServer/statisticsDatabase/migrations/0004_merge_headset_id_aliases.py)
      ;;
    *) echo "Unexpected path in code archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 15 ]

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
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/lib/utils/viewerIdentity.js$' >/dev/null
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/+layout.svelte$' >/dev/null

mkdir -p "$BACKUP_DIR" "$WORK_DIR/frontend"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
sqlite3 "$STATS_DIR/db.sqlite3" ".backup '$BACKUP_DIR/statistics-db.sqlite3'"
sqlite3 "$BACKUP_DIR/srv-db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
sqlite3 "$BACKUP_DIR/statistics-db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
cp -a "$CONTROL_DIR/presence-history.json" "$BACKUP_DIR/presence-history.json"
cp -a "$CONTROL_DIR/uptime.json" "$BACKUP_DIR/uptime.json"
tar -czf "$BACKUP_DIR/frontend-build.tar.gz" -C "$FRONTEND_DIR" build

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
BACKUP_READY=1

tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# The production directory intentionally retains the private frontend values
# only inside the compiled server chunk. Reuse them without logging them.
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

(cd "$CONTROL_DIR" && node --test)
(cd "$STATS_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$STATS_DIR" && venv/bin/python manage.py test statisticsDatabase)
(cd "$SRV_DIR" && venv/bin/python manage.py test \
  database.tests.ViewerIdentityTests.test_numeric_headset_ids_ignore_leading_zeroes \
  database.tests.ViewerIdentityTests.test_non_numeric_headset_ids_are_preserved)

echo "JSON migration dry-run:"
(cd "$CONTROL_DIR" && node scripts/migrateHeadsetIdentity.js)

sessions_before=$(sqlite3 "$STATS_DIR/db.sqlite3" 'SELECT count(*) FROM statisticsDatabase_playbacksession;')
device_totals_before=$(sqlite3 -separator '|' "$STATS_DIR/db.sqlite3" \
  'SELECT total(views),total(launches),total(abandoned),total(viewed) FROM statisticsDatabase_device;')
uptime_values_before=$(node --input-type=module -e '
  import fs from "node:fs";
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(String(Object.values(data).reduce((sum, value) => sum + value.length, 0)));
' "$CONTROL_DIR/uptime.json")

DATA_MIGRATION_STARTED=1
systemctl stop stats.service control_server.service
(cd "$STATS_DIR" && venv/bin/python manage.py migrate statisticsDatabase)
(cd "$CONTROL_DIR" && node scripts/migrateHeadsetIdentity.js --apply)
sqlite3 "$STATS_DIR/db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null

sessions_after=$(sqlite3 "$STATS_DIR/db.sqlite3" 'SELECT count(*) FROM statisticsDatabase_playbacksession;')
device_totals_after=$(sqlite3 -separator '|' "$STATS_DIR/db.sqlite3" \
  'SELECT total(views),total(launches),total(abandoned),total(viewed) FROM statisticsDatabase_device;')
uptime_values_after=$(node --input-type=module -e '
  import fs from "node:fs";
  const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(String(Object.values(data).reduce((sum, value) => sum + value.length, 0)));
' "$CONTROL_DIR/uptime.json")

[ "$sessions_before" = "$sessions_after" ]
[ "$device_totals_before" = "$device_totals_after" ]
[ "$uptime_values_before" = "$uptime_values_after" ]

duplicate_devices=$(sqlite3 "$STATS_DIR/db.sqlite3" "
  SELECT count(*) FROM (
    SELECT location_id, CAST(client_id AS INTEGER)
    FROM statisticsDatabase_device
    WHERE client_id <> '' AND client_id NOT GLOB '*[^0-9]*'
    GROUP BY location_id, CAST(client_id AS INTEGER)
    HAVING count(*) > 1
  );
")
[ "$duplicate_devices" -eq 0 ]

post_json_dry_run=$(cd "$CONTROL_DIR" && node scripts/migrateHeadsetIdentity.js)
printf '%s\n' "$post_json_dry_run"
[ "$(printf '%s\n' "$post_json_dry_run" | grep -c '"merged": 0')" -eq 2 ]

mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"
FRONTEND_SWITCHED=1

systemctl restart stats.service srv.service control_server.service qr2.service
systemctl is-active --quiet stats.service
systemctl is-active --quiet srv.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr2.service

curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  --header 'Host: cinema.local.vr360.pro' \
  http://127.0.0.1:8000/api/category/ >/dev/null
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8002/admin/login/ >/dev/null
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/ >/dev/null

invalid_status=$(curl --silent --output /dev/null --write-out '%{http_code}' \
  --header 'Content-Type: application/json' \
  --data '{}' \
  http://127.0.0.1:8002/api/update_statistics/)
[ "$invalid_status" = 400 ]

rm -rf "$WORK_DIR"
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
echo "Invariants: sessions=$sessions_after device_totals=$device_totals_after uptime_values=$uptime_values_after duplicate_devices=$duplicate_devices"
