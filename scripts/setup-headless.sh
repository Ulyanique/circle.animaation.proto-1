#!/usr/bin/env bash
# Установка портативного Chromium (@sparticuz/chromium) для headless-проверки рендера.
# Ставится в ~/.cache/headless, в git ничего не попадает.
set -euo pipefail
DIR="${HEADLESS_DIR:-$HOME/.cache/headless}"
mkdir -p "$DIR" && cd "$DIR"
[ -f package.json ] || npm init -y >/dev/null
npm install @sparticuz/chromium@131 --no-audit --no-fund
# системных библиотек (libnss3 и т.п.) в песочнице нет — распаковываем поставляемые архивы
mkdir -p libs && node -e "
const zlib=require('zlib'),fs=require('fs'),p='node_modules/@sparticuz/chromium/bin/';
for (const f of ['al2023.tar.br','al2.tar.br']) fs.writeFileSync('libs/'+f.replace('.br',''), zlib.brotliDecompressSync(fs.readFileSync(p+f)));"
(cd libs && tar -xf al2023.tar && tar -xf al2.tar)
echo "OK: Chromium helper installed in $DIR"
