# circle.animaation.proto-1

Зацикленная 3D-анимация золотого логотипа (three.js + postprocessing).

## Запуск

    npm install
    npm run dev      # http://localhost:5173
    npm run build    # сборка в dist/

## Цикл
Прорисовка контура → проявление из тени (радиальный шумовой фронт) → удержание с пульсацией и
плавным увеличением → уход в тень → пауза → повтор.

## Настройки
⚙ в правом верхнем углу (или клавиша S). Пробел — пауза. Двойной клик по ползунку — сброс.
- **Экспорт JSON** — копировать/скачать текущие настройки.
- **Импорт** — вставить JSON и «Применить».
- **Сброс** — значения из `src/config.js` (`DEFAULTS`).

Чтобы присланный JSON стал значением по умолчанию, перенесите его в `DEFAULTS` в `src/config.js`.

### Основные группы параметров
- `logo.depth`, `logo.bevel`, `logo.outlineWidthPx` — толщина логотипа, скос и контур (логотип растёт во время проявления).
- `lights.topGlow` — свечение над логотипом (центр кадра).
- `background.lowerShade` — затемнение нижнего левого угла; `background.godRays`, `background.brushed`, `background.fog` — лучи, диагональная текстура и туман.
- `rings.constructionOpacity` — пунктирная разметка «циркулем»; `rings.thickness` — толщина колец (плоские дуги).
- `particles.rayLift` — подсветка пыли кольцами.
- `post.dofEnabled` — размытие (выключено, кадр чёткий); `post.chromaticAberration` — радиальная аберрация у краёв; `post.bloomIntensity` — блум.
