import * as THREE from 'three';
import backgroundUrl from './assets/partners/bg.png';
import curtainUrl from './assets/partners/shtora.png';
import proelectroUrl from './assets/partners/proelectro.svg';
import proelectroschitUrl from './assets/partners/proelectroschit.svg';
import promrukavUrl from './assets/partners/promrukav.svg';
import keazUrl from './assets/partners/keaz.svg';
import {partnersCues, drawPartnersDecor} from './partners-graphics.js';
import { LogoScene } from './scene.js';
import { computePhase } from './timeline.js';
import { BASE_FRAME } from './scenes/catalog.js';
import { masterSize } from './output-profile.js';

const loadImage = url => new Promise(resolve => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => resolve(null);
  image.src = url;
});
let backgroundCanvas, curtainImage;
const logos = {};
// Золотая заливка использует альфу SVG, а не прямоугольную белую плашку.
function goldenLogo(image) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.max(1, Math.round(1200 * image.naturalHeight / image.naturalWidth));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-in';
  const gold = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gold.addColorStop(0, '#f8e6bd'); gold.addColorStop(.42, '#e5c48b');
  gold.addColorStop(.72, '#b88b4f'); gold.addColorStop(1, '#ebd19b');
  ctx.fillStyle = gold; ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}
const imageReady = Promise.all([backgroundUrl, curtainUrl, proelectroUrl, proelectroschitUrl, promrukavUrl, keazUrl].map(loadImage)).then(images => {
  const [background, curtain, ...marks] = images;
  if (background) {
    // Подгонка с сохранением пропорций (центр кадра), без растяжения.
    backgroundCanvas = document.createElement('canvas');
    const w = BASE_FRAME.width, h = BASE_FRAME.height;
    backgroundCanvas.width = w; backgroundCanvas.height = h;
    const scale = Math.max(w / background.naturalWidth, h / background.naturalHeight);
    const dw = background.naturalWidth * scale, dh = background.naturalHeight * scale;
    backgroundCanvas.getContext('2d').drawImage(background, (w-dw)/2, (h-dh)/2, dw, dh);
  }
  curtainImage = curtain;
  ['organizer1', 'organizer2', 'partner1', 'partner2'].forEach((key, i) => {
    if (marks[i]) logos[key] = goldenLogo(marks[i]);
  });
  return images.every(Boolean);
});
export const loadPartnersBackground = () => imageReady;

/** Сцена с присланными логотипами; изменённые имена остаются текстом. */
export class PartnersScene extends LogoScene {
  constructor(canvas,cfg) {
    super(canvas,cfg,{intro:false});
    this.card = document.createElement('canvas'); this.card.width=masterSize().width; this.card.height=masterSize().height;
    this.cardCtx = this.card.getContext('2d');
    this.cardTexture = new THREE.CanvasTexture(this.card); this.cardTexture.colorSpace=THREE.SRGBColorSpace;
    this.cardScene = new THREE.Scene();
    this.cardCamera = new THREE.OrthographicCamera(-1,1,1,-1,0,2); this.cardCamera.position.z=1;
    this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:this.cardTexture,toneMapped:false}));
    this.cardScene.add(this.cardMesh);
  }
  update(t) {
    // После загрузки canvas в WebGL создаём новый буфер: повторное использование
    // может оставлять устаревшие пиксели в некоторых реализациях Chromium.
    const master = masterSize();
    this.card = document.createElement('canvas'); this.card.width=master.width; this.card.height=master.height;
    this.cardCtx=this.card.getContext('2d'); this.cardTexture.image=this.card;
    // Координаты макета — базовый кадр (1920×1080) из каталога, не литерал.
    const ctx=this.cardCtx, w=BASE_FRAME.width,h=BASE_FRAME.height, cfg=this.cfg, tl=cfg.timeline;
    // Макет нарисован в координатах 1920×1080; при 4K-мастере масштабируем
    // контекст, а не пересчитываем сотни координат.
    ctx.setTransform(master.width / w, 0, 0, master.height / h, 0, 0);
    const phase=computePhase(t,tl), data=cfg.partners;
    const cue=partnersCues(phase,tl,data.motion ?? 1), visible=cue.visible;

    ctx.globalAlpha=1;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
    if (visible <= 0) { this.cardTexture.needsUpdate=true; return; }
    ctx.save();ctx.globalAlpha=visible;
    if(backgroundCanvas) ctx.drawImage(backgroundCanvas,0,0);
    else { ctx.fillStyle = '#22070b'; ctx.fillRect(0,0,w,h); }
    // Мягкий направленный свет объединяет фактуру и графические материалы.
    const light=ctx.createRadialGradient(720,90,20,850,400,900);
    light.addColorStop(0,'rgba(255,190,139,.13)');light.addColorStop(.45,'rgba(197,97,76,.035)');light.addColorStop(1,'rgba(0,0,0,.16)');
    ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    ctx.restore();
    if (data.curtainVisible !== false && curtainImage) {
      ctx.save(); ctx.globalAlpha = visible * cue.curtain;
      ctx.drawImage(curtainImage, -80*(1-cue.curtain)+cue.curtainSway, 0, 476, h);
      ctx.restore();
    }
    drawPartnersDecor(ctx,cue,data);
    const text=(value,x,y,font,color,alpha,maxWidth,entry=1)=>{
      ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=9;ctx.shadowOffsetY=3;
      ctx.fillText(String(value ?? ''),x,y+22*(1-entry),maxWidth);ctx.restore();
    };
    const gold='#e9ca91', warm='#d2ac70', ivory='#f6e4be';
    const title=visible*cue.title;
    text(data.title,960,165,'600 112px "Cormorant Garamond", serif',ivory,title,1130,cue.title);
    text(data.subtitle,960,252,'400 49px "Cormorant Garamond", serif',gold,title,1100,cue.title);
    // Симметричные короткие акценты вместо тяжёлых линий через весь кадр.
    const ornament=(y,alpha,width)=>{
      ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=warm;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(960-width,y);ctx.lineTo(944,y);ctx.moveTo(976,y);ctx.lineTo(960+width,y);ctx.stroke();
      ctx.translate(960,y);ctx.rotate(Math.PI/4);ctx.strokeRect(-4,-4,8,8);ctx.restore();
    };
    ornament(313,title*.7,300*cue.title);
    const label=(value,x,y,alpha,entry)=>{
      text(value,x,y,'600 24px Manrope, sans-serif',warm,alpha,460,entry);
    };
    const defaults = {organizer1:'ПРОэлектро', organizer2:'ПРОэлектрощит', partner1:'Промрукав', partner2:'КЭАЗ'};
    // Пользовательские названия старых JSON не теряются: для них текстовый fallback.
    const company=(key,x,y,entry)=>{
      const value = data[key], logo = logos[key];
      if (!logo || String(value ?? '').trim().toLocaleLowerCase('ru') !== defaults[key].toLocaleLowerCase('ru')) {
        text(value,x,y,'600 52px Manrope, sans-serif',ivory,visible*entry,440,entry);
        return;
      }
      const scale = Math.min(440 / logo.width, 105 / logo.height);
      const lw=logo.width*scale, lh=logo.height*scale;
      ctx.save(); ctx.globalAlpha=visible*entry;
      ctx.beginPath(); ctx.rect(x-250*entry,y-80,500*entry,160); ctx.clip();
      ctx.drawImage(logo,x-lw/2,y-lh/2+22*(1-entry),lw,lh); ctx.restore();
    };
    label(data.organizerLabel,690,389,visible*cue.organizerLabel,cue.organizerLabel);
    label(data.coorganizerLabel,1230,389,visible*cue.organizerLabel,cue.organizerLabel);
    company('organizer1',690,485,cue.organizer);
    company('organizer2',1230,485,cue.organizerSecond);
    ornament(595,visible*cue.separator*.55,420*cue.separator);
    label(data.partnerLabel,960,674,visible*cue.partnerLabel,cue.partnerLabel);
    company('partner1',690,770,cue.partner);
    company('partner2',1230,770,cue.partnerSecond);
    this.cardTexture.needsUpdate=true;
  }
  render() {
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.cardScene,this.cardCamera);
  }
  dispose() {
    this.cardTexture.dispose();this.cardMesh.geometry.dispose();this.cardMesh.material.dispose();
    super.dispose();
  }
}
