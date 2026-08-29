#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend source archive is required}
DEPLOY_STAMP=${3:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
CONTROL_DIR=$APP_ROOT/control_server
FRONTEND_DIR=$APP_ROOT/qr2
BACKUP_DIR=$APP_ROOT/backups/connection-monitoring-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.connection-monitoring-deploy.XXXXXX")

BACKUP_READY=0
SOURCE_INSTALLED=0
FRONTEND_SWITCHED=0

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.connection-monitoring-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  trap - EXIT HUP INT TERM
  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2

  if [ "$BACKUP_READY" -eq 1 ]; then
    systemctl stop control_server.service qr2.service

    if [ "$SOURCE_INSTALLED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/control-source.tar.gz" -C "$APP_ROOT"
    fi

    if [ "$FRONTEND_SWITCHED" -eq 1 ]; then
      [ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
      rm -rf "$FRONTEND_DIR/build"
      mv "$BACKUP_DIR/frontend-build" "$FRONTEND_DIR/build"
    fi

    systemctl start control_server.service qr2.service
  fi

  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/connection-monitoring-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -d "$CONTROL_DIR" ]
[ -d "$FRONTEND_DIR/build" ]
[ -d "$FRONTEND_DIR/node_modules" ]

tar -tzf "$CODE_ARCHIVE" | grep -v '/$' | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/handlers/index.js|\
    control_server/state/presenceHistory.js|\
    control_server/test/overview.test.js|\
    control_server/test/presenceHistory.test.js)
      ;;
    *) echo "Unexpected path in code archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | grep -vc '/$')" -eq 4 ]

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
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/+page.svelte$' >/dev/null

mkdir -p "$BACKUP_DIR" "$WORK_DIR/frontend"
tar -czf "$BACKUP_DIR/control-source.tar.gz" -C "$APP_ROOT" \
  control_server/handlers/index.js \
  control_server/state/presenceHistory.js \
  control_server/test/overview.test.js \
  control_server/test/presenceHistory.test.js
cp -a "$CONTROL_DIR/presence-history.json" "$BACKUP_DIR/presence-history.json"
BACKUP_READY=1

tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# Private statistics values exist only in the compiled production build.
# Reuse them without printing or writing them into Git or deployment logs.
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

mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
FRONTEND_SWITCHED=1
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"

systemctl restart control_server.service qr2.service
systemctl is-active --quiet control_server.service
systemctl is-active --quiet qr2.service

ready=0
attempt=1
while [ "$attempt" -le 20 ]; do
  if curl --silent --fail --output /dev/null http://127.0.0.1:8004/; then
    ready=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
[ "$ready" -eq 1 ]

(cd "$CONTROL_DIR" && node --input-type=module -e '
  import WebSocket from "ws";
  const socket = new WebSocket("ws://127.0.0.1:11000/api/");
  const timeout = setTimeout(() => {
    console.error("Timed out waiting for vrOverview");
    process.exit(1);
  }, 10000);
  socket.on("open", () => socket.send(JSON.stringify({ type: "getVrOverview" })));
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type !== "vrOverview" || !Array.isArray(message.connectionHealth)) {
      console.error("Invalid vrOverview response");
      process.exit(1);
    }
    clearTimeout(timeout);
    socket.close();
    console.log(`vrOverview connectionHealth entries: ${message.connectionHealth.length}`);
  });
')

cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR"
