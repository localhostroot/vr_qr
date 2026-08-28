#!/bin/sh
set -eu

CODE_ARCHIVE=${1:?code archive is required}
FRONTEND_ARCHIVE=${2:?frontend source archive is required}
PASSWORD_FILE=${3:?password file is required}
DEPLOY_STAMP=${4:-$(date +%Y%m%d-%H%M%S)}

APP_ROOT=/opt/qr_app
SRV_DIR=$APP_ROOT/srv
FRONTEND_DIR=$APP_ROOT/qr2
ENV_FILE=/etc/qr_app/srv.env
BACKUP_DIR=$APP_ROOT/backups/admin-auth-$DEPLOY_STAMP
WORK_DIR=$(mktemp -d "$APP_ROOT/.admin-auth-deploy.XXXXXX")

BACKUP_READY=0
INSTALL_STARTED=0
ADMIN_AUTH_EXISTED=0
OLD_BUILD=

cleanup_work() {
  case "$WORK_DIR" in
    /opt/qr_app/.admin-auth-deploy.*) rm -rf "$WORK_DIR" ;;
    *) echo "Refusing to remove unexpected work directory: $WORK_DIR" >&2 ;;
  esac
  case "$PASSWORD_FILE" in
    /tmp/site-admin-password-*) rm -f "$PASSWORD_FILE" ;;
    *) echo "Refusing to remove unexpected password path: $PASSWORD_FILE" >&2 ;;
  esac
}

rollback() {
  exit_code=$?
  [ "$exit_code" -eq 0 ] && return

  set +e
  echo "Deployment failed; restoring $BACKUP_DIR" >&2
  if [ "$BACKUP_READY" -eq 1 ] && [ "$INSTALL_STARTED" -eq 1 ]; then
    tar -xzf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT"
    if [ "$ADMIN_AUTH_EXISTED" -eq 1 ]; then
      cp -a "$BACKUP_DIR/admin_auth.py" "$SRV_DIR/database/admin_auth.py"
    else
      rm -f "$SRV_DIR/database/admin_auth.py"
    fi
    cp -a "$BACKUP_DIR/srv.env" "$ENV_FILE"
    if [ -n "$OLD_BUILD" ] && [ -d "$OLD_BUILD" ]; then
      rm -rf "$FRONTEND_DIR/build"
      mv "$OLD_BUILD" "$FRONTEND_DIR/build"
    fi
    systemctl restart srv.service qr2.service
  fi
  cleanup_work
  exit "$exit_code"
}
trap rollback EXIT HUP INT TERM

[ "$APP_ROOT" = /opt/qr_app ]
[ "$SRV_DIR" = /opt/qr_app/srv ]
[ "$FRONTEND_DIR" = /opt/qr_app/qr2 ]
case "$BACKUP_DIR" in
  /opt/qr_app/backups/admin-auth-*) ;;
  *) echo "Unexpected backup path: $BACKUP_DIR" >&2; exit 1 ;;
esac
case "$PASSWORD_FILE" in
  /tmp/site-admin-password-*) ;;
  *) echo "Unexpected password path: $PASSWORD_FILE" >&2; exit 1 ;;
esac
[ -f "$CODE_ARCHIVE" ]
[ -f "$FRONTEND_ARCHIVE" ]
[ -f "$PASSWORD_FILE" ]
[ -f "$ENV_FILE" ]
[ -x "$SRV_DIR/venv/bin/python" ]
[ -d "$FRONTEND_DIR/node_modules" ]
[ -d "$FRONTEND_DIR/build" ]

IFS= read -r site_admin_password < "$PASSWORD_FILE"
[ "${#site_admin_password}" -eq 6 ]

tar -tzf "$CODE_ARCHIVE" | while IFS= read -r archive_path; do
  case "$archive_path" in
    qr_svelte5/src/routes/+layout.svelte|\
    qr_svelte5/src/routes/site-admin/+page.svelte|\
    srv/database/admin_auth.py|\
    srv/database/api.py|\
    srv/database/tests.py|\
    srv/srv/settings.py) ;;
    *) echo "Unexpected path in archive: $archive_path" >&2; exit 1 ;;
  esac
done
[ "$(tar -tzf "$CODE_ARCHIVE" | wc -l)" -eq 6 ]

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
tar -tzf "$FRONTEND_ARCHIVE" | grep '^src/routes/+layout.svelte$' >/dev/null

mkdir -p "$BACKUP_DIR" "$WORK_DIR/code" "$WORK_DIR/frontend"
sqlite3 "$SRV_DIR/db.sqlite3" ".backup '$BACKUP_DIR/srv-db.sqlite3'"
sqlite3 "$BACKUP_DIR/srv-db.sqlite3" 'PRAGMA quick_check;' | grep '^ok$' >/dev/null
tar -czf "$BACKUP_DIR/source-files.tar.gz" -C "$APP_ROOT" \
  srv/database/api.py \
  srv/database/tests.py \
  srv/srv/settings.py
if [ -f "$SRV_DIR/database/admin_auth.py" ]; then
  cp -a "$SRV_DIR/database/admin_auth.py" "$BACKUP_DIR/admin_auth.py"
  ADMIN_AUTH_EXISTED=1
fi
cp -a "$ENV_FILE" "$BACKUP_DIR/srv.env"
tar -czf "$BACKUP_DIR/frontend-build.tar.gz" -C "$FRONTEND_DIR" build
BACKUP_READY=1

tar -xzf "$CODE_ARCHIVE" -C "$WORK_DIR/code"
tar -xzf "$FRONTEND_ARCHIVE" -C "$WORK_DIR/frontend"
ln -s "$FRONTEND_DIR/node_modules" "$WORK_DIR/frontend/node_modules"

# The production directory intentionally keeps only the compiled frontend.
# Preserve the existing private statistics settings by reading them from that
# build without printing or copying the values into Git or deployment logs.
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

mkdir -p "$WORK_DIR/frontend/src/routes/site-admin"
cp -a "$WORK_DIR/code/qr_svelte5/src/routes/+layout.svelte" \
  "$WORK_DIR/frontend/src/routes/+layout.svelte"
cp -a "$WORK_DIR/code/qr_svelte5/src/routes/site-admin/+page.svelte" \
  "$WORK_DIR/frontend/src/routes/site-admin/+page.svelte"
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

INSTALL_STARTED=1
cp -a "$WORK_DIR/code/srv/database/admin_auth.py" \
  "$SRV_DIR/database/admin_auth.py"
cp -a "$WORK_DIR/code/srv/database/api.py" "$SRV_DIR/database/api.py"
cp -a "$WORK_DIR/code/srv/database/tests.py" "$SRV_DIR/database/tests.py"
cp -a "$WORK_DIR/code/srv/srv/settings.py" "$SRV_DIR/srv/settings.py"

env_tmp=$(mktemp /etc/qr_app/.srv.env.XXXXXX)
grep -v '^SITE_ADMIN_PASSWORD=' "$ENV_FILE" > "$env_tmp"
printf 'SITE_ADMIN_PASSWORD=%s\n' "$site_admin_password" >> "$env_tmp"
if ! grep -q '^DJANGO_SECRET_KEY=.' "$env_tmp"; then
  django_secret=$(
    "$SRV_DIR/venv/bin/python" -c 'import secrets; print(secrets.token_urlsafe(48))'
  )
  printf 'DJANGO_SECRET_KEY=%s\n' "$django_secret" >> "$env_tmp"
fi
chown --reference="$ENV_FILE" "$env_tmp"
chmod --reference="$ENV_FILE" "$env_tmp"
mv "$env_tmp" "$ENV_FILE"

(cd "$SRV_DIR" && SITE_ADMIN_PASSWORD="$site_admin_password" \
  venv/bin/python manage.py makemigrations --check --dry-run)
(cd "$SRV_DIR" && SITE_ADMIN_PASSWORD="$site_admin_password" \
  venv/bin/python manage.py test database)

OLD_BUILD="$FRONTEND_DIR/build.before-admin-auth-$DEPLOY_STAMP"
mv "$FRONTEND_DIR/build" "$OLD_BUILD"
mv "$WORK_DIR/frontend/build" "$FRONTEND_DIR/build"
chown -R --reference="$FRONTEND_DIR" "$FRONTEND_DIR/build"

systemctl restart srv.service qr2.service
systemctl is-active --quiet srv.service
systemctl is-active --quiet qr2.service

ready=0
attempt=1
while [ "$attempt" -le 15 ]; do
  if curl --silent --fail --output /dev/null http://127.0.0.1:8004/; then
    ready=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done
[ "$ready" -eq 1 ]

public_base=https://cinema.local.vr360.pro
resolve=cinema.local.vr360.pro:443:127.0.0.1
unauthorized_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --resolve "$resolve" \
  "$public_base/api/admin/search_orders/")
[ "$unauthorized_code" = 403 ]

login_json="$WORK_DIR/login.json"
cookie_jar="$WORK_DIR/cookies.txt"
printf '{"password":"%s"}' "$site_admin_password" > "$login_json"
login_code=$(curl --silent --show-error --output "$WORK_DIR/login-response.json" \
  --write-out '%{http_code}' --resolve "$resolve" \
  --cookie-jar "$cookie_jar" --header 'Content-Type: application/json' \
  --data-binary "@$login_json" "$public_base/api/admin/login/")
[ "$login_code" = 200 ]
grep '"authenticated":true' "$WORK_DIR/login-response.json" >/dev/null

authorized_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --resolve "$resolve" --cookie "$cookie_jar" \
  "$public_base/api/admin/search_orders/")
[ "$authorized_code" = 200 ]

root_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --resolve "$resolve" "$public_base/")
site_admin_code=$(curl --silent --show-error --output /dev/null \
  --write-out '%{http_code}' --resolve "$resolve" "$public_base/site-admin")
[ "$root_code" = 200 ]
[ "$site_admin_code" = 200 ]

rm -rf "$OLD_BUILD"
OLD_BUILD=
cleanup_work
trap - EXIT HUP INT TERM
echo "Deployment completed; backup: $BACKUP_DIR; unauth=$unauthorized_code auth=$authorized_code root=$root_code site_admin=$site_admin_code"
