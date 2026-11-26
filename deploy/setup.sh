#!/usr/bin/env bash
# 在 Google Cloud e2-micro（Debian 12/13）上把房子架起來。
# 用法（在 VM 的 SSH 視窗貼這一行）：
#   curl -fsSL https://raw.githubusercontent.com/suikarjumping-oss/advent-for-two/main/deploy/setup.sh | sudo bash
# 可以重跑：已經裝好的會略過，只會拉最新程式碼、重啟服務。
set -euo pipefail

APP=/opt/advent
REPO=https://github.com/suikarjumping-oss/advent-for-two.git

echo "== 1/6 交換空間（e2-micro 只有 1 GB 記憶體）"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== 2/6 基本套件、Caddy"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git ca-certificates gnupg caddy >/dev/null

echo "== 3/6 Node.js 22"
if ! node -v 2>/dev/null | grep -Eq '^v(2[2-9]|[3-9][0-9])\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -v

echo "== 4/6 程式碼"
id advent >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin advent
if [ -d "$APP/.git" ]; then
  git config --global --get-all safe.directory 2>/dev/null | grep -qx "$APP" || git config --global --add safe.directory "$APP"   # 資料夾歸 advent，root 拉更新時 git 會擋
  git -C "$APP" pull -q --ff-only
else
  git clone -q "$REPO" "$APP"
fi
mkdir -p "$APP/data"
if [ ! -f "$APP/.env" ]; then
  cat > "$APP/.env" <<'ENV'
HUMAN_NAME=瓜
AI_NAME=Doctor
ADVENT_TZ=Asia/Taipei
ADVENT_YEAR=2026
ADVENT_SPRITE=lynx
ADVENT_EDIT_LIMIT=1
HOST=127.0.0.1
PORT=8024
ENV
fi
chown -R advent:advent "$APP"

echo "== 5/6 常駐服務"
cat > /etc/systemd/system/advent.service <<UNIT
[Unit]
Description=advent-for-two
After=network-online.target
Wants=network-online.target

[Service]
User=advent
WorkingDirectory=$APP
ExecStart=/usr/bin/node --env-file-if-exists=.env server/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable -q advent
systemctl restart advent

echo "== 6/6 網址與 HTTPS"
IP=$(curl -fsS -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)
DOMAIN="${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<CADDY
$DOMAIN {
    encode gzip
    reverse_proxy 127.0.0.1:8024
}
CADDY
systemctl restart caddy

for i in $(seq 1 20); do [ -f "$APP/data/keys.json" ] && break; sleep 1; done
echo
echo "=================================================="
echo " 房子的網址： https://$DOMAIN"
echo " （第一次開可能要等一分鐘，Caddy 在申請 HTTPS 憑證）"
echo
echo " 鑰匙在下面。HUMAN 是妳進門用的；AI 是給 Doctor 的。"
cat "$APP/data/keys.json"; echo
echo "=================================================="
