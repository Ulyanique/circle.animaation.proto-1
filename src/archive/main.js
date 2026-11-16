import './archive.css';
import {createArchiveScene} from './scene.js';
import {createFinale} from './finale.js';
import {loadArchiveMedia} from './media.js';
import {FINALE_START, SLOT_COUNT, SLOT_DURATION} from './motion.js';
import {parseClipTime, formatClipTime, validateClipRange, clipTarget, sourceRange} from './clip-range.js';
import {
  loadArchiveSession, saveArchiveSession, clampSlotDuration,
  MIN_SLOT_DURATION, MAX_SLOT_DURATION, swapArchiveItems,
  mapArchiveTime, archiveTotalDuration, realElapsedForSlot,
} from './session.js';
import {saveArchiveMediaFile, loadArchiveMediaFile, deleteArchiveMediaFile, swapArchiveMediaFiles} from './storage.js';
import {encodeOfflineVideo} from '../offline-video.js';

const canvas = document.querySelector('#archive-stage');
const finaleCanvas = document.querySelector('#archive-finale');
const stage = createArchiveScene(canvas);
let finale;
let slotsState = loadArchiveSession();

function renderAt(realTime) {
  const mapped = mapArchiveTime(slotsState, realTime);
  const cTime = mapped.canonicalTime;
  stage.render(cTime);
  finale.render(cTime, cTime >= FINALE_START - 0.8 ? stage.projectLight(FINALE_START - 0.8) : null);
}

const slotsRoot = document.querySelector('#slots');
const seek = document.querySelector('[data-seek]');
const play = document.querySelector('[data-play]');
const output = document.querySelector('[data-time]');
const exportBtn = document.querySelector('[data-export]');
const status = document.querySelector('.status');
const media = Array(SLOT_COUNT).fill(null);
const generations = Array(SLOT_COUNT).fill(0);
const rowRefs = [];

let time = 0;
let playing = true;
let exporting = false;
let cancelExportFlag = false;
let previous = performance.now();
let messageTimer;
let alive = true;

// При паузе асинхронно загруженные знак и шрифт должны сразу появиться.
finale = createFinale(finaleCanvas, () => {
  if (alive && !playing && !exporting) renderAt(time);
});

function message(text) {
  status.textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => { status.textContent = ''; }, 5000);
}

function format(value) {
  const s = Math.floor(value);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function totalDuration() {
  return archiveTotalDuration(slotsState);
}

function persistSession() {
  saveArchiveSession(slotsState);
}

function syncVideo(force = false, atTime = time) {
  const mapped = mapArchiveTime(slotsState, atTime);
  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    if (!item || item.kind !== 'video') continue;
    const video = item.source;
    const elapsed = realElapsedForSlot(slotsState, atTime, i);
    const target = clipTarget(elapsed, item.range.start, item.range.end);
    const slotEnd = (mapped.slotStarts[i] ?? i * SLOT_DURATION) + slotsState[i].duration;
    const active = mapped.realTime >= (mapped.slotStarts[i] ?? 0) && mapped.realTime < slotEnd - 0.2;
    const hold = elapsed >= Math.max(0, item.range.end - item.range.start - 1 / 30);
    if ((!playing || exporting || !active || hold) && !video.paused) video.pause();
    if ((force || Math.abs(video.currentTime - target) > 0.20) && !video.seeking) {
      try { video.currentTime = target; } catch { /* noop */ }
    }
    if (playing && !exporting && active && !hold && video.paused) {
      video.play().catch(() => message('Видео не запустилось: нажмите ▶ после выбора файла.'));
    }
  }
}

async function seekVideosExact(atTime) {
  const tasks = [];
  for (let i = 0; i < media.length; i++) {
    const item = media[i];
    if (!item || item.kind !== 'video') continue;
    const video = item.source;
    if (!video.paused) video.pause();
    const elapsed = realElapsedForSlot(slotsState, atTime, i);
    const target = clipTarget(elapsed, item.range.start, item.range.end);
    if (Math.abs(video.currentTime - target) < 0.008) continue;
    tasks.push(new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        video.removeEventListener('seeked', done);
        resolve();
      };
      const timer = setTimeout(done, 1500);
      video.addEventListener('seeked', done, { once: true });
      try { video.currentTime = target; } catch { done(); }
    }));
  }
  if (tasks.length) await Promise.all(tasks);
}

function updateTransport() {
  const dur = totalDuration();
  seek.max = String(dur);
  if (time >= dur) time = Math.max(0, dur - 0.001);
  seek.value = String(time);
  output.textContent = `${format(time)} / ${format(dur)}`;
  play.textContent = playing ? 'Ⅱ' : '▶';
  play.setAttribute('aria-label', playing ? 'Пауза' : 'Воспроизвести');
}

function applySlotStageState(i) {
  const item = media[i];
  const cfg = slotsState[i];
  if (item) {
    stage.setMedia(i, item.texture, item.aspect);
    stage.setFit(i, cfg.fit);
    stage.setFocus(i, cfg.focusX / 100, cfg.focusY / 100);
  } else {
    stage.resetMedia(i);
  }
}

function refreshRowUI(i) {
  const ref = rowRefs[i];
  const cfg = slotsState[i];
  const item = media[i];
  ref.title.textContent = cfg.name;
  ref.source.textContent = cfg.source;
  ref.duration.value = String(cfg.duration);
  ref.moveUp.disabled = i === 0 || exporting;
  ref.moveDown.disabled = i === SLOT_COUNT - 1 || exporting;
  ref.fit.value = cfg.fit;
  ref.focus.hidden = cfg.fit !== 'cover';
  ref.focusX.value = String(cfg.focusX);
  ref.focusY.value = String(cfg.focusY);
  if (item) {
    ref.name.textContent = item.name;
    ref.name.title = item.name;
    ref.remove.disabled = exporting;
    ref.options.hidden = false;
    ref.trim.hidden = item.kind !== 'video';
    if (item.kind === 'video') {
      ref.from.value = formatClipTime(item.range.start);
      ref.to.value = formatClipTime(item.range.end);
    }
  } else {
    ref.name.textContent = 'Плейсхолдер';
    ref.name.title = '';
    ref.remove.disabled = true;
    ref.options.hidden = true;
    ref.trim.hidden = true;
    ref.focus.open = false;
  }
}

async function attachFileToSlot(i, file, { persistFile = true, savedRange = null } = {}) {
  const version = ++generations[i];
  const ref = rowRefs[i];
  ref.name.textContent = 'Загрузка…';
  try {
    const next = await loadArchiveMedia(file);
    if (version !== generations[i] || !alive) {
      next.dispose();
      return;
    }
    const old = media[i];
    media[i] = next;
    if (next.kind === 'video') {
      const validSaved = savedRange && validateClipRange(savedRange.start, savedRange.end, next.source.duration)
        ? { start: savedRange.start, end: Math.min(savedRange.end, next.source.duration) }
        : { start: 0, end: next.source.duration };
      next.range = validSaved;
      slotsState[i].range = validSaved;
      next.source.addEventListener('seeked', () => {
        if (media[i] !== next || exporting) return;
        syncVideo();
        if (!playing) renderAt(time);
      });
    } else {
      slotsState[i].range = null;
    }
    old?.dispose();
    applySlotStageState(i);
    if (persistFile) {
      persistSession();
      void saveArchiveMediaFile(i, file);
    }
    refreshRowUI(i);
    syncVideo(true);
    renderAt(time);
  } catch (error) {
    if (version !== generations[i]) return;
    refreshRowUI(i);
    message(error.message);
  }
}

async function moveSlot(from, to) {
  if (exporting || from < 0 || to < 0 || from >= SLOT_COUNT || to >= SLOT_COUNT || from === to) return;
  generations[from]++;
  generations[to]++;
  slotsState = swapArchiveItems(slotsState, from, to);
  const mediaFrom = media[from];
  media[from] = media[to];
  media[to] = mediaFrom;
  applySlotStageState(from);
  applySlotStageState(to);
  refreshRowUI(from);
  refreshRowUI(to);
  persistSession();
  void swapArchiveMediaFiles(from, to);
  syncVideo(true);
  updateTransport();
  renderAt(time);
}

for (let i = 0; i < SLOT_COUNT; i++) {
  const row = document.createElement('div');
  row.className = 'slot';
  row.innerHTML = `
    <div class="slot-head">
      <strong data-slot-title></strong>
      <div class="slot-head-tools">
        <span class="slot-number" data-slot-source></span>
        <span class="slot-move">
          <button type="button" data-move="-1" title="Переместить эпизод выше" aria-label="Переместить эпизод ${i + 1} выше">↑</button>
          <button type="button" data-move="1" title="Переместить эпизод ниже" aria-label="Переместить эпизод ${i + 1} ниже">↓</button>
        </span>
      </div>
    </div>
    <p class="slot-name">Плейсхолдер</p>
    <div class="slot-actions">
      <label>Выбрать файл<input type="file" accept="image/*,video/*" aria-label="Выбрать фото или видео для медиаграни ${i + 1}"></label>
      <button type="button" data-remove disabled>Убрать</button>
    </div>
    <div class="slot-timing">
      <span>Длительность, с</span>
      <input type="number" data-duration min="${MIN_SLOT_DURATION}" max="${MAX_SLOT_DURATION}" step="0.5" value="${slotsState[i].duration}" aria-label="Длительность эпизода ${i + 1} в секундах">
    </div>
    <div class="slot-options" hidden>
      <label>Кадр <select aria-label="Кадрирование медиаграни ${i + 1}"><option value="cover">Заполнить</option><option value="contain">Вписать</option></select></label>
      <details class="slot-focus"><summary title="Сместить область кадрирования">↔</summary>
        <label>X <input type="range" min="0" max="100" value="50" aria-label="Положение кадрирования по горизонтали ${i + 1}"></label>
        <label>Y <input type="range" min="0" max="100" value="50" aria-label="Положение кадрирования по вертикали ${i + 1}"></label>
      </details>
    </div>
    <div class="slot-trim" hidden>
      <label>От <input type="text" inputmode="decimal" aria-label="Начало видео ${i + 1}" placeholder="0:00"></label>
      <label>До <input type="text" inputmode="decimal" aria-label="Конец видео ${i + 1}" placeholder="0:00"></label>
      <button type="button" title="Подставить время исходного видео из списка">↦</button>
    </div>`;

  const input = row.querySelector('input[type=file]');
  const remove = row.querySelector('[data-remove]');
  const name = row.querySelector('.slot-name');
  const title = row.querySelector('[data-slot-title]');
  const source = row.querySelector('[data-slot-source]');
  const moveUp = row.querySelector('[data-move="-1"]');
  const moveDown = row.querySelector('[data-move="1"]');
  const duration = row.querySelector('[data-duration]');
  const options = row.querySelector('.slot-options');
  const fit = row.querySelector('select');
  const focus = row.querySelector('.slot-focus');
  const focusInputs = focus.querySelectorAll('input');
  const trim = row.querySelector('.slot-trim');
  const [from, to] = trim.querySelectorAll('input');
  const sourceButton = trim.querySelector('button');

  rowRefs.push({
    row, input, remove, name, title, source, moveUp, moveDown, duration,
    options, fit, focus, focusX: focusInputs[0], focusY: focusInputs[1],
    trim, from, to, sourceButton,
  });

  function applyRange(start, end) {
    const item = media[i];
    if (!item || item.kind !== 'video') return;
    if (!validateClipRange(start, end, item.source.duration)) {
      message('Укажите допустимые границы: начало раньше конца, конец не позже длины видео.');
      refreshRowUI(i);
      return;
    }
    item.range = { start, end: Math.min(end, item.source.duration) };
    slotsState[i].range = item.range;
    persistSession();
    refreshRowUI(i);
    syncVideo(true);
    renderAt(time);
  }

  for (const field of [from, to]) {
    field.addEventListener('change', () => applyRange(parseClipTime(from.value), parseClipTime(to.value)));
  }
  sourceButton.addEventListener('click', () => {
    const item = media[i];
    if (!item || item.kind !== 'video') return;
    const range = sourceRange(slotsState[i].source, item.source.duration);
    if (!range) {
      message('Время из списка не помещается в этот файл. Укажите границы вручную.');
      return;
    }
    applyRange(range.start, range.end);
  });

  fit.addEventListener('change', () => {
    slotsState[i].fit = fit.value === 'contain' ? 'contain' : 'cover';
    focus.hidden = slotsState[i].fit !== 'cover';
    stage.setFit(i, slotsState[i].fit);
    persistSession();
    renderAt(time);
  });

  for (const control of focusInputs) {
    control.addEventListener('input', () => {
      slotsState[i].focusX = Number(focusInputs[0].value);
      slotsState[i].focusY = Number(focusInputs[1].value);
      stage.setFocus(i, slotsState[i].focusX / 100, slotsState[i].focusY / 100);
      persistSession();
      renderAt(time);
    });
  }

  duration.addEventListener('change', () => {
    slotsState[i].duration = clampSlotDuration(duration.value);
    duration.value = String(slotsState[i].duration);
    persistSession();
    updateTransport();
    syncVideo(true);
    renderAt(time);
  });

  moveUp.addEventListener('click', () => { void moveSlot(i, i - 1); });
  moveDown.addEventListener('click', () => { void moveSlot(i, i + 1); });

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file || exporting) return;
    await attachFileToSlot(i, file, { persistFile: true });
  });

  remove.addEventListener('click', () => {
    if (exporting) return;
    generations[i]++;
    const old = media[i];
    media[i] = null;
    slotsState[i].fit = 'cover';
    slotsState[i].focusX = 50;
    slotsState[i].focusY = 50;
    slotsState[i].range = null;
    stage.resetMedia(i);
    old?.dispose();
    persistSession();
    void deleteArchiveMediaFile(i);
    refreshRowUI(i);
    renderAt(time);
  });

  slotsRoot.appendChild(row);
  refreshRowUI(i);
}

// Восстанавливаем ранее выбранные файлы из IndexedDB при повторном открытии вкладки.
(async () => {
  for (let i = 0; i < SLOT_COUNT; i++) {
    if (!alive) return;
    const saved = await loadArchiveMediaFile(i);
    if (saved && generations[i] === 0 && !media[i]) {
      await attachFileToSlot(i, saved, { persistFile: false, savedRange: slotsState[i].range });
    }
  }
})();

async function runArchiveExport() {
  if (exporting) {
    cancelExportFlag = true;
    return;
  }
  exporting = true;
  cancelExportFlag = false;
  const wasPlaying = playing;
  const savedTime = time;
  playing = false;
  syncVideo(true);
  updateTransport();
  for (let i = 0; i < SLOT_COUNT; i++) refreshRowUI(i);

  const exportWidth = 1920;
  const exportHeight = 1080;
  const fps = 30;
  const dur = totalDuration();
  const totalFrames = Math.max(1, Math.round(dur * fps));
  const composite = document.createElement('canvas');
  composite.width = exportWidth;
  composite.height = exportHeight;
  const ctx = composite.getContext('2d', { alpha: false });

  exportBtn.classList.add('is-busy');
  exportBtn.textContent = 'Отменить (0%)';

  try {
    await document.fonts.ready;
    stage.setExportSize(exportWidth, exportHeight);
    const result = await encodeOfflineVideo({
      canvas: composite,
      fps,
      total: totalFrames,
      cancelled: () => cancelExportFlag || !alive,
      onProgress: (done, total) => {
        const pct = Math.floor((done / total) * 100);
        exportBtn.textContent = `Отменить (${pct}%)`;
      },
      draw: async (frameIndex) => {
        const frameTime = Math.min(dur - 0.0001, frameIndex / fps);
        await seekVideosExact(frameTime);
        for (const item of media) {
          if (item?.kind === 'video') item.texture.needsUpdate = true;
        }
        renderAt(frameTime);
        ctx.clearRect(0, 0, exportWidth, exportHeight);
        ctx.drawImage(canvas, 0, 0, exportWidth, exportHeight);
        const finaleOpacity = Number.parseFloat(finaleCanvas.style.opacity || '0');
        if (finaleOpacity > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, finaleOpacity));
          ctx.drawImage(finaleCanvas, 0, 0, exportWidth, exportHeight);
          ctx.restore();
        }
      },
    });
    if (result?.blob) {
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `circle-archive.${result.ext || 'mp4'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      message('Экспорт MP4 завершён.');
    } else if (cancelExportFlag) {
      message('Экспорт отменён.');
    }
  } catch (error) {
    message(`Ошибка экспорта: ${error?.message || error}`);
  } finally {
    exporting = false;
    cancelExportFlag = false;
    exportBtn.classList.remove('is-busy');
    exportBtn.textContent = 'Скачать MP4';
    time = savedTime;
    playing = wasPlaying;
    previous = performance.now();
    for (let i = 0; i < SLOT_COUNT; i++) refreshRowUI(i);
    resize();
    syncVideo(true);
    updateTransport();
  }
}

exportBtn?.addEventListener('click', () => { void runArchiveExport(); });

play.addEventListener('click', () => {
  if (exporting) return;
  playing = !playing;
  previous = performance.now();
  syncVideo(true);
  updateTransport();
});

seek.addEventListener('input', () => {
  if (exporting) return;
  const dur = totalDuration();
  time = Math.min(dur - 0.001, Math.max(0, Number(seek.value)));
  syncVideo(true);
  renderAt(time);
  updateTransport();
});

document.querySelector('[data-restart]').addEventListener('click', () => {
  if (exporting) return;
  time = 0;
  previous = performance.now();
  syncVideo(true);
  renderAt(time);
  updateTransport();
});

// Медиа воспроизводится по реальному времени: при просадке кадров скорость
// сцены не замедляется и не заставляет видео постоянно перематываться назад.
function frame(now) {
  if (!alive) return;
  const dt = Math.max(0, (now - previous) / 1000);
  previous = now;
  if (playing && !exporting) {
    const dur = totalDuration();
    time = (time + dt) % dur;
    syncVideo();
    updateTransport();
    renderAt(time);
  }
  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange', () => { previous = performance.now(); });
const viewer = document.querySelector('.viewer');
const stageFrame = document.querySelector('.stage-frame');
const resize = () => {
  if (exporting) return;
  const box = viewer.getBoundingClientRect();
  const width = Math.min(box.width, box.height * 16 / 9);
  if (!width) return;
  stageFrame.style.width = `${width}px`;
  stageFrame.style.height = `${width * 9 / 16}px`;
  stage.resize();
  renderAt(time);
};
const observer = new ResizeObserver(resize);
observer.observe(viewer);
window.addEventListener('resize', resize);
resize();
updateTransport();
requestAnimationFrame(frame);

window.addEventListener('pagehide', (event) => {
  if (event.persisted) {
    playing = false;
    syncVideo();
    updateTransport();
    return;
  }
  alive = false;
  cancelExportFlag = true;
  for (let i = 0; i < generations.length; i++) generations[i]++;
  observer.disconnect();
  for (const item of media) item?.dispose();
  stage.dispose();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted && alive) {
    previous = performance.now();
    resize();
    updateTransport();
  }
});
