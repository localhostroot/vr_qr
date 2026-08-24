#!/bin/sh
set -eu

if [ "$#" -ne 2 ]; then
 echo "Usage: $0 BUILD_ARCHIVE NGINX_CONFIG" >&2
 exit 2
fi

BUILD_ARCHIVE=$1
CANDIDATE_NGINX_CONFIG=$2
APP_DIR=/opt/qr_app/qr2
NGINX_CONFIG=/etc/nginx/sites-enabled/cinema.local.vr360.pro.conf
BACKUP_DIR=/opt/qr_app/backups
QUARANTINE_DIR=/opt/qr_app/quarantine
STAMP=$(date +%Y%m%d-%H%M%S)
STAGE_DIR="$APP_DIR/.root-url-stage-$STAMP"
OLD_BUILD="$APP_DIR/build.before-root-url-$STAMP"
FAILED_BUILD="$QUARANTINE_DIR/qr2-build.failed-root-url-$STAMP"
QUARANTINED_BUILD="$QUARANTINE_DIR/qr2-build.before-root-url-$STAMP"
APP_BACKUP="$BACKUP_DIR/qr2-before-root-url-$STAMP.tar.gz"
NGINX_BACKUP="$BACKUP_DIR/cinema-nginx-before-root-url-$STAMP.conf"

test -f "$BUILD_ARCHIVE"
test -f "$CANDIDATE_NGINX_CONFIG"
test -d "$APP_DIR/build"
test -f "$APP_DIR/start-server.js"

mkdir -p "$BACKUP_DIR" "$QUARANTINE_DIR" "$STAGE_DIR"
tar -tzf "$BUILD_ARCHIVE" >/dev/null
tar -xzf "$BUILD_ARCHIVE" -C "$STAGE_DIR"
test -f "$STAGE_DIR/build/index.js"

tar -czf "$APP_BACKUP" -C "$APP_DIR" build start-server.js
cp "$NGINX_CONFIG" "$NGINX_BACKUP"
install -m 0644 "$CANDIDATE_NGINX_CONFIG" "$NGINX_CONFIG"

if ! nginx -t; then
 cp "$NGINX_BACKUP" "$NGINX_CONFIG"
 nginx -t
 echo "Candidate Nginx configuration rejected; original restored" >&2
 exit 1
fi

mv "$APP_DIR/build" "$OLD_BUILD"
mv "$STAGE_DIR/build" "$APP_DIR/build"
chown -R dk:dk "$APP_DIR/build"

rollback() {
 set +e
 systemctl stop qr2.service
 if [ -d "$APP_DIR/build" ]; then
  mv "$APP_DIR/build" "$FAILED_BUILD"
 fi
 if [ -d "$OLD_BUILD" ]; then
  mv "$OLD_BUILD" "$APP_DIR/build"
 fi
 systemctl start qr2.service
 cp "$NGINX_BACKUP" "$NGINX_CONFIG"
 nginx -t
 systemctl reload nginx
 echo "Deployment failed; frontend and Nginx were rolled back" >&2
 exit 1
}

if ! systemctl restart qr2.service; then
 rollback
fi

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

if [ "$ready" -ne 1 ]; then
 rollback
fi

if ! systemctl reload nginx; then
 rollback
fi

fetch_public_status() {
 path=$1
 attempt=1
 while [ "$attempt" -le 5 ]; do
  if code=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --resolve cinema.local.vr360.pro:443:127.0.0.1 "https://cinema.local.vr360.pro$path"); then
   printf '%s' "$code"
   return 0
  fi
  attempt=$((attempt + 1))
  sleep 1
 done
 return 1
}

ROOT_CODE=$(fetch_public_status /) || rollback
VIEWER_CODE=$(fetch_public_status /CDH/30) || rollback
LEGACY_CODE=$(fetch_public_status /vr/CDH/30) || rollback
DOUBLE_LEGACY_CODE=$(fetch_public_status /new/vr/CDH/30) || rollback
DJANGO_API_CODE=$(fetch_public_status /api/category/) || rollback
SVELTE_API_CODE=$(fetch_public_status /api/auth) || rollback

if [ "$ROOT_CODE" != 200 ] || [ "$VIEWER_CODE" != 200 ] || [ "$LEGACY_CODE" != 404 ] || [ "$DOUBLE_LEGACY_CODE" != 404 ] || [ "$DJANGO_API_CODE" != 200 ] || [ "$SVELTE_API_CODE" != 405 ]; then
 echo "Unexpected health codes: root=$ROOT_CODE viewer=$VIEWER_CODE legacy=$LEGACY_CODE double_legacy=$DOUBLE_LEGACY_CODE django_api=$DJANGO_API_CODE svelte_api=$SVELTE_API_CODE" >&2
 rollback
fi

systemctl is-active --quiet nginx
systemctl is-active --quiet qr2.service
mv "$OLD_BUILD" "$QUARANTINED_BUILD"
rmdir "$STAGE_DIR"

echo "Deployment completed"
echo "Application backup: $APP_BACKUP"
echo "Nginx backup: $NGINX_BACKUP"
echo "Fast rollback build: $QUARANTINED_BUILD"
echo "Health codes: root=$ROOT_CODE viewer=$VIEWER_CODE legacy=$LEGACY_CODE double_legacy=$DOUBLE_LEGACY_CODE django_api=$DJANGO_API_CODE svelte_api=$SVELTE_API_CODE"
