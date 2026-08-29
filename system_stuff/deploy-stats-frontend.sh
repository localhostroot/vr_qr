#!/bin/sh
set -eu

FRONTEND_ARCHIVE=${1:?frontend source archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/stats-frontend-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.stats-frontend.XXXXXX")

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

  case "$WORK_DIR" in
    /opt/qr_app/.stats-frontend.*) rm -rf "$WORK_DIR" ;;
  esac
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/stats-frontend-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$FRONTEND_ARCHIVE" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -d "$FRONTEND_DIR/build" ]

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
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# This dashboard intentionally contains playback statistics only.
! grep -q 'Payment Analytics' "$WORK_DIR/frontend/src/routes/stats/+page.svelte"
! grep -q 'Total Revenue' "$WORK_DIR/frontend/src/routes/stats/+page.svelte"
! grep -q '/api/payments' "$WORK_DIR/frontend/src/routes/stats/+page.svelte"

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
! grep -R -q 'Payment Analytics' "$WORK_DIR/frontend/build"
! grep -R -q 'Total Revenue' "$WORK_DIR/frontend/build"

systemctl stop qr2.service
mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"
FRONTEND_SWITCHED=1

systemctl start qr2.service
systemctl is-active --quiet qr2.service
curl --fail --silent --show-error --retry 15 --retry-delay 1 --retry-connrefused \
  http://127.0.0.1:8004/stats >/dev/null

case "$WORK_DIR" in
  /opt/qr_app/.stats-frontend.*) rm -rf "$WORK_DIR" ;;
esac
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
