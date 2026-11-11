import './archive.css';
import {createArchiveScene} from './scene.js';
import {createFinale} from './finale.js';
import {loadArchiveMedia} from './media.js';
import {ARCHIVE_DURATION, FINALE_START, SLOT_COUNT, SLOT_DURATION, videoElapsedForSlot} from './motion.js';
import {ARCHIVE_SLOTS} from './slots.js';
import {parseClipTime,formatClipTime,validateClipRange,clipTarget,sourceRange} from './clip-range.js';

const canvas=document.querySelector('#archive-stage'), stage=createArchiveScene(canvas);
let finale;
function render(time){stage.render(time);finale.render(time,time>=FINALE_START-.8?stage.projectLight(FINALE_START-.8):null);}
const slots=document.querySelector('#slots'), seek=document.querySelector('[data-seek]'), play=document.querySelector('[data-play]'), output=document.querySelector('[data-time]'), status=document.querySelector('.status');
const media=Array(SLOT_COUNT).fill(null), generations=Array(SLOT_COUNT).fill(0);
let time=0, playing=true, previous=performance.now(), messageTimer, alive=true;
// При паузе асинхронно загруженные знак и шрифт должны сразу появиться.
finale=createFinale(document.querySelector('#archive-finale'),()=>{if(alive&&!playing)render(time);});
function message(text){status.textContent=text;clearTimeout(messageTimer);messageTimer=setTimeout(()=>status.textContent='',5000);}
function format(value){const s=Math.floor(value);return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
seek.max=String(ARCHIVE_DURATION);
function syncVideo(force=false){
  for(let i=0;i<media.length;i++){
    const item=media[i];if(!item || item.kind!=='video')continue;
    const video=item.source, elapsed=videoElapsedForSlot(time,i), target=clipTarget(elapsed,item.range.start,item.range.end), active=time>=i*SLOT_DURATION && time<i*SLOT_DURATION+7.8;
    const hold=elapsed>=Math.max(0,item.range.end-item.range.start-1/30);
    if((!playing || !active || hold) && !video.paused)video.pause();
    if((force || Math.abs(video.currentTime-target)>.20) && !video.seeking) {try{video.currentTime=target;}catch{}}
    if(playing && active && !hold && video.paused)video.play().catch(()=>message('Видео не запустилось: нажмите ▶ после выбора файла.'));
  }
}
function updateTransport(){seek.value=String(time);output.textContent=`${format(time)} / ${format(ARCHIVE_DURATION)}`;play.textContent=playing?'Ⅱ':'▶';play.setAttribute('aria-label',playing?'Пауза':'Воспроизвести');}
for(let i=0;i<SLOT_COUNT;i++){
  const row=document.createElement('div');row.className='slot';row.innerHTML=`<div class="slot-head"><strong>${ARCHIVE_SLOTS[i].name}</strong><span class="slot-number">${ARCHIVE_SLOTS[i].source}</span></div><p class="slot-name">Плейсхолдер</p><div class="slot-actions"><label>Выбрать файл<input type="file" accept="image/*,video/*" aria-label="Выбрать фото или видео для медиаграни ${i+1}"></label><button type="button" disabled>Убрать</button></div><div class="slot-options" hidden><label>Кадр <select aria-label="Кадрирование медиаграни ${i+1}"><option value="cover">Заполнить</option><option value="contain">Вписать</option></select></label><details class="slot-focus"><summary title="Сместить область кадрирования">↔</summary><label>X <input type="range" min="0" max="100" value="50" aria-label="Положение кадрирования по горизонтали ${i+1}"></label><label>Y <input type="range" min="0" max="100" value="50" aria-label="Положение кадрирования по вертикали ${i+1}"></label></details></div><div class="slot-trim" hidden><label>От <input type="text" inputmode="decimal" aria-label="Начало видео ${i+1}" placeholder="0:00"></label><label>До <input type="text" inputmode="decimal" aria-label="Конец видео ${i+1}" placeholder="0:00"></label><button type="button" title="Подставить время исходного видео из списка">↦</button></div>`;
  const input=row.querySelector('input[type=file]'),remove=row.querySelector('.slot-actions button'),name=row.querySelector('.slot-name');
  const options=row.querySelector('.slot-options'),fit=row.querySelector('select'),focus=row.querySelector('.slot-focus'),focusInputs=focus.querySelectorAll('input');
  const trim=row.querySelector('.slot-trim'),from=trim.querySelectorAll('input')[0],to=trim.querySelectorAll('input')[1],sourceButton=trim.querySelector('button');
  function updateRangeFields(){const item=media[i];if(item?.kind==='video'){from.value=formatClipTime(item.range.start);to.value=formatClipTime(item.range.end);}}
  function applyRange(start,end){const item=media[i];if(!item||item.kind!=='video')return;
    if(!validateClipRange(start,end,item.source.duration)){message('Укажите допустимые границы: начало раньше конца, конец не позже длины видео.');updateRangeFields();return;}
    item.range={start,end:Math.min(end,item.source.duration)};updateRangeFields();syncVideo(true);render(time);
  }
  for(const field of [from,to])field.addEventListener('change',()=>applyRange(parseClipTime(from.value),parseClipTime(to.value)));
  sourceButton.addEventListener('click',()=>{const item=media[i];if(!item||item.kind!=='video')return;const range=sourceRange(ARCHIVE_SLOTS[i].source,item.source.duration);
    if(!range){message('Время из списка не помещается в этот файл. Укажите границы вручную.');return;}applyRange(range.start,range.end);});
  fit.addEventListener('change',()=>{focus.hidden=fit.value!=='cover';stage.setFit(i,fit.value);render(time);});
  for(const control of focusInputs)control.addEventListener('input',()=>{stage.setFocus(i,Number(focusInputs[0].value)/100,Number(focusInputs[1].value)/100);render(time);});
  input.addEventListener('change',async()=>{
    const file=input.files?.[0];input.value='';if(!file)return;const version=++generations[i];name.textContent='Загрузка…';
    try{const next=await loadArchiveMedia(file);if(version!==generations[i]){next.dispose();return;}const old=media[i];media[i]=next;
      if(next.kind==='video'){next.range={start:0,end:next.source.duration};next.source.addEventListener('seeked',()=>{if(media[i]!==next)return;syncVideo();if(!playing)render(time);});}
      stage.setMedia(i,next.texture,next.aspect);old?.dispose();options.hidden=false;trim.hidden=next.kind!=='video';updateRangeFields();name.textContent=next.name;name.title=next.name;remove.disabled=false;syncVideo(true);render(time);}
    catch(error){if(version!==generations[i])return;name.textContent=media[i]?.name || 'Плейсхолдер';message(error.message);}
  });
  remove.addEventListener('click',()=>{generations[i]++;const old=media[i];media[i]=null;stage.resetMedia(i);old?.dispose();fit.value='cover';focus.hidden=false;focus.open=false;for(const control of focusInputs)control.value='50';options.hidden=true;trim.hidden=true;name.textContent='Плейсхолдер';name.title='';remove.disabled=true;render(time);});slots.appendChild(row);
}
play.addEventListener('click',()=>{playing=!playing;previous=performance.now();syncVideo(true);updateTransport();});
seek.addEventListener('input',()=>{time=Math.min(ARCHIVE_DURATION-.001,Math.max(0,Number(seek.value)));syncVideo(true);render(time);updateTransport();});
document.querySelector('[data-restart]').addEventListener('click',()=>{time=0;previous=performance.now();syncVideo(true);render(time);updateTransport();});
// Медиа воспроизводится по реальному времени: при просадке кадров скорость
// сцены не замедляется и не заставляет видео постоянно перематываться назад.
function frame(now){if(!alive)return;const dt=Math.max(0,(now-previous)/1000);previous=now;if(playing){time=(time+dt)%ARCHIVE_DURATION;syncVideo();updateTransport();render(time);}requestAnimationFrame(frame);}
document.addEventListener('visibilitychange',()=>{previous=performance.now();});
const viewer=document.querySelector('.viewer'),stageFrame=document.querySelector('.stage-frame');
const resize=()=>{const box=viewer.getBoundingClientRect(),width=Math.min(box.width,box.height*16/9);if(!width)return;
  stageFrame.style.width=`${width}px`;stageFrame.style.height=`${width*9/16}px`;stage.resize();render(time);};
const observer=new ResizeObserver(resize);observer.observe(viewer);window.addEventListener('resize',resize);resize();updateTransport();requestAnimationFrame(frame);
window.addEventListener('pagehide',event=>{
  if(event.persisted){playing=false;syncVideo();updateTransport();return;}
  alive=false;for(let i=0;i<generations.length;i++)generations[i]++;
  observer.disconnect();for(const item of media)item?.dispose();stage.dispose();
});
window.addEventListener('pageshow',event=>{if(event.persisted&&alive){previous=performance.now();resize();updateTransport();}});
