#!/bin/sh
# Installs the Linux cabinet launcher to /opt/contrasteroids-arcade and
# /usr/local/bin/contrasteroids-arcade, with Chromium and xdotool from Debian. Run on the
# cabinet with sudo rights: sh install.sh
set -e
cd "$(dirname "$0")"
command -v chromium >/dev/null && command -v xdotool >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends chromium xdotool
sudo install -d /opt/contrasteroids-arcade
sudo install -m 755 contrasteroids-arcade /opt/contrasteroids-arcade/
sudo install -m 644 frame.html marquee.png /opt/contrasteroids-arcade/
sudo ln -sf /opt/contrasteroids-arcade/contrasteroids-arcade /usr/local/bin/contrasteroids-arcade
echo "installed; launch with: contrasteroids-arcade"
