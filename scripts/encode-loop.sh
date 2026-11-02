#!/bin/bash
# Сборка MP4 из кадров render-loop.cjs. Требуется ffmpeg в PATH.
# Использование: FPS=60 IN=out/frames OUT=out/logo-loop.mp4 scripts/encode-loop.sh
set -e
FPS=${FPS:-24}
IN=${IN:-out/frames}
OUT=${OUT:-out/logo-loop.mp4}
ffmpeg -y -framerate "$FPS" -i "$IN/f%04d.png" -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -movflags +faststart "$OUT"
echo "ENCODED $OUT"
