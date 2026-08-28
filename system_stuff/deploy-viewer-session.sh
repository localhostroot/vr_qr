#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
DEPLOY_STAMP=${2:-$(date +%Y%m%d-%H%M%S)}

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

    cp -a "$BACKUP_DIR/srv-db.sqlite3" "$SRV_DIR/db.sqlite3"

    if [ "$SOURCE_INSTALLED" -eq 1 ]; then
      tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
      rm -f "$CONTROL_DIR/utils/viewerIdentity.js"
      rm -f "$FRONTEND_DIR/src/lib/utils/viewerSession.js"
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

  rm -rf "$WORK_DIR"
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$CONTROL_DIR" = /opt/qr_app/control_server ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
[ -f "$CODE_ARCHIVE" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -x "$SRV_DIR/venv/bin/python" ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    control_server/controllers/index.js|control_server/handlers/index.js|control_server/services/paidPlayback.js|control_server/test/paidPlayback.test.js|control_server/test/queue.test.js|control_server/utils/viewerIdentity.js|qr_svelte5/src/lib/constants/localStorageKeys.js|qr_svelte5/src/lib/utils/+paykeeperPayment.svelte.js|qr_svelte5/src/lib/utils/paymentStatusChecker.js|qr_svelte5/src/lib/utils/viewerSession.js|qr_svelte5/src/routes/payment-result/+page.svelte|srv/database/api.py|srv/database/models.py|srv/database/payment_processor.py|srv/database/tests.py|srv/database/viewer_identity.py|srv/database/migrations/0015_order_viewer_session_id.py|srv/database/migrations/0016_normalize_numeric_viewer_ids.py)
      ;;
    *)
      echo "Unexpected path in code archive: $archive_path" >&2
      exit 1
      ;;
  esac
done

mkdir -p "$BACKUP_DIR"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  control_server/controllers/index.js \
  control_server/handlers/index.js \
  control_server/services/paidPlayback.js \
  control_server/test/paidPlayback.test.js \
  control_server/test/queue.test.js \
  qr2/src/lib/constants/localStorageKeys.js \
  qr2/src/lib/utils/+paykeeperPayment.svelte.js \
  qr2/src/lib/utils/paymentStatusChecker.js \
  qr2/src/routes/payment-result/+page.svelte \
  srv/database/api.py \
  srv/database/models.py \
  srv/database/payment_processor.py \
  srv/database/tests.py

optional_backup_files=
for optional_path in \
  control_server/utils/viewerIdentity.js \
  qr2/src/lib/utils/viewerSession.js \
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

mkdir -p "$WORK_DIR/code"
tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"

# Build away from the live frontend. Preserve private values embedded in the
# current production bundle without printing them to deployment logs.
PRIVATE_CHUNK=$(find "$FRONTEND_DIR/build/server/chunks" -maxdepth 1 -type f -name 'private-*.js' -print -quit)
[ -n "$PRIVATE_CHUNK" ]
PRIVATE_STATS_LOGIN=$(sed -n 's/^const PRIVATE_STATS_LOGIN = "\(.*\)";$/\1/p' "$PRIVATE_CHUNK")
PRIVATE_STATS_PASSWORD=$(sed -n 's/^const PRIVATE_STATS_PASSWORD = "\(.*\)";$/\1/p' "$PRIVATE_CHUNK")
PRIVATE_STATISTICS_SERVER_URL=$(sed -n 's/^const PRIVATE_STATISTICS_SERVER_URL = "\(.*\)";$/\1/p' "$PRIVATE_CHUNK")
PRIVATE_STATS_TOKEN=$(sed -n 's/^const PRIVATE_STATS_TOKEN = "\(.*\)";$/\1/p' "$PRIVATE_CHUNK")
[ -n "$PRIVATE_STATS_LOGIN" ]
[ -n "$PRIVATE_STATS_PASSWORD" ]
[ -n "$PRIVATE_STATISTICS_SERVER_URL" ]
[ -n "$PRIVATE_STATS_TOKEN" ]
export PRIVATE_STATS_LOGIN PRIVATE_STATS_PASSWORD PRIVATE_STATISTICS_SERVER_URL PRIVATE_STATS_TOKEN

mkdir -p "$WORK_DIR/frontend"
tar -cf - \
  --exclude='./build' \
  --exclude='./node_modules' \
  --exclude='./.svelte-kit' \
  -C "$FRONTEND_DIR" . | tar -xf - -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"
mkdir -p \
  "$WORK_DIR/frontend/src/lib/constants" \
  "$WORK_DIR/frontend/src/lib/utils" \
  "$WORK_DIR/frontend/src/routes/payment-result"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/constants/localStorageKeys.js" "$WORK_DIR/frontend/src/lib/constants/localStorageKeys.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/+paykeeperPayment.svelte.js" "$WORK_DIR/frontend/src/lib/utils/+paykeeperPayment.svelte.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/paymentStatusChecker.js" "$WORK_DIR/frontend/src/lib/utils/paymentStatusChecker.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/viewerSession.js" "$WORK_DIR/frontend/src/lib/utils/viewerSession.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/routes/payment-result/+page.svelte" "$WORK_DIR/frontend/src/routes/payment-result/+page.svelte"

(
  cd "$WORK_DIR/frontend"
  NODE_ENV=production \
  PUBLIC_DATABASE=https://cinema.local.vr360.pro/ \
  PUBLIC_BACKEND=wss://cinema.local.vr360.pro/control/api/ \
  PUBLIC_STAT=https://stats.local.vr360.pro/api \
  node node_modules/vite/bin/vite.js build
)
[ -f "$WORK_DIR/frontend/build/index.js" ]

mkdir -p "$CONTROL_DIR/utils" "$CONTROL_DIR/test" "$FRONTEND_DIR/src/lib/utils"
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
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/constants/localStorageKeys.js" "$FRONTEND_DIR/src/lib/constants/localStorageKeys.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/+paykeeperPayment.svelte.js" "$FRONTEND_DIR/src/lib/utils/+paykeeperPayment.svelte.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/paymentStatusChecker.js" "$FRONTEND_DIR/src/lib/utils/paymentStatusChecker.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/lib/utils/viewerSession.js" "$FRONTEND_DIR/src/lib/utils/viewerSession.js"
cp -a "$WORK_DIR/code/qr_svelte5/src/routes/payment-result/+page.svelte" "$FRONTEND_DIR/src/routes/payment-result/+page.svelte"
SOURCE_INSTALLED=1

(cd "$SRV_DIR" && venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && venv/bin/python manage.py test database)
(cd "$CONTROL_DIR" && node --test)

systemctl stop qr2.service control_server.service srv.service
(cd "$SRV_DIR" && venv/bin/python manage.py migrate database)

mv "$FRONTEND_DIR/build" "$BACKUP_DIR/frontend-build"
FRONTEND_SWITCHED=1
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
rm -rf "$WORK_DIR"

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
