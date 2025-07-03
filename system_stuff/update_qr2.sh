#!/bin/sh
cd /home/dk
systemctl stop qr2
rm -rf /opt/qr_app/qr2/build
unzip build.zip
rm -rf __MACOSX
rm build.zip
cp -r build /opt/qr_app/qr2/build
rm -rf build
systemctl start qr2