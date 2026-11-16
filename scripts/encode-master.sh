#!/bin/bash
# Мастер для монтажа из PNG-последовательности (P0-2).
#
# Площадка и монтаж просят разное. Браузерный экспорт даёт MP4/WebM; монтажная
# программа чаще ждёт промежуточный кодек без потерь. Здесь — ProRes 422 HQ
# (Final Cut, Premiere, DaVinci) и DNxHR HQX (Avid/Windows).
#
# Требуется ffmpeg в PATH. Сначала кадры: FPS=60 npm run render:frames
#
# Использование:
#   IN=out/frames OUT=out/master.mov CODE=prores scripts/encode-master.sh
#   IN=out/frames OUT=out/master.mov CODE=dnxhr  scripts/encode-master.sh
#
# Про 10 бит: PNG уже 8 бит на канал, поэтому 10-битная глубина здесь — это
# честная упаковка 8 бит в 10-битный контейнер, а не дополнительные оттенки.
# Настоящие 10 бит даёт браузерный экспорт (вариант VP9 10 бит); см. README.
set -euo pipefail

FPS=${FPS:-60}
IN=${IN:-out/frames}
OUT=${OUT:-out/master.mov}
CODE=${CODE:-prores}

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg не найден в PATH. Мастер в ProRes/DNxHR собирается только им." >&2
  echo "Без ffmpeg используйте браузерный экспорт: пульт → «Файл» → вариант доставки." >&2
  exit 1
fi

if [ ! -d "$IN" ]; then
  echo "Нет каталога с кадрами: $IN" >&2
  echo "Сначала отрендерьте последовательность: FPS=$FPS OUT=$IN npm run render:frames" >&2
  exit 1
fi

FIRST=$(find "$IN" -maxdepth 1 -name 'f*.png' | sort | head -n 1)
if [ -z "$FIRST" ]; then
  echo "В $IN нет кадров f00000.png …" >&2
  exit 1
fi

# Теги BT.709 / limited range: без них площадка и монтаж по-разному показывают
# тёмный градиент, а он в этом проекте — половина кадра.
TAGS=(-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv)

case "$CODE" in
  prores)
    # 422 HQ, 10-битный профиль — стандартный промежуточный формат монтажа.
    ARGS=(-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le)
    ;;
  dnxhr)
    # HQX — 12-битный вариант DNxHR; совместим с Avid и Premiere.
    ARGS=(-c:v dnxhd -profile:v dnxhr_hqx -pix_fmt yuv422p10le)
    ;;
  *)
    echo "Неизвестный кодек: $CODE (ожидалось prores или dnxhr)" >&2
    exit 2
    ;;
esac

ffmpeg -y -framerate "$FPS" -i "$IN/f%05d.png" "${ARGS[@]}" "${TAGS[@]}" -movflags +faststart "$OUT"
echo "MASTER $OUT ($CODE, $FPS fps, ${TAGS[*]})"
