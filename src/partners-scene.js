import * as THREE from 'three';
import backgroundUrl from './assets/partners-texture.jpg';
import {partnersCues, drawPartnersDecor} from './partners-graphics.js';
import { LogoScene } from './scene.js';
import { computePhase } from './timeline.js';
import { OUTPUT } from './scenes/catalog.js';
import { masterSize } from './output-profile.js';

const image = new Image();
let backgroundCanvas;
const imageReady = new Promise(resolve => {
  image.onload = () => {
    // Зафиксировать масштабирование один раз, чтобы повторные seek не зависели
    // от того, когда браузер подготовил внутренний кэш JPEG.
    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.width = OUTPUT.width; backgroundCanvas.height = OUTPUT.height;
    backgroundCanvas.getContext('2d').drawImage(image, 0, 0, OUTPUT.width, OUTPUT.height);
    resolve(true);
  };
  image.onerror = () => resolve(false);
  image.src = backgroundUrl;
});
export const loadPartnersBackground = () => imageReady;

/** Временный макет с названиями, не имитирующими фирменные знаки компаний. */
export class PartnersScene extends LogoScene {
  constructor(canvas,cfg) {
    super(canvas,cfg,{intro:false});
    this.card = document.createElement('canvas'); this.card.width=OUTPUT.width; this.card.height=OUTPUT.height;
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
    const ctx=this.cardCtx, w=OUTPUT.width,h=OUTPUT.height, cfg=this.cfg, tl=cfg.timeline;
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
    const label=(value,y,alpha,entry)=>{
      text(value,960,y,'600 24px Manrope, sans-serif',warm,alpha,560,entry);
      ctx.save();ctx.globalAlpha=alpha*.4;ctx.fillStyle=warm;
      ctx.fillRect(620,y,135*entry,1);ctx.fillRect(1300-135*entry,y,135*entry,1);ctx.restore();
    };
    // Пока фирменных знаков нет, названия раскрываются каждый отдельно:
    // подъём, плавная прозрачность и горизонтальная маска от центра.
    const company=(value,x,y,entry)=>{
      ctx.save();ctx.beginPath();ctx.rect(x-245*entry,y-65,490*entry,130);ctx.clip();
      text(value,x,y,'600 57px Manrope, sans-serif',ivory,visible*entry,465,entry);
      ctx.restore();
    };
    label(data.organizerLabel,389,visible*cue.organizerLabel,cue.organizerLabel);
    company(data.organizer1,710,485,cue.organizer);
    company(data.organizer2,1210,485,cue.organizerSecond);
    ornament(595,visible*cue.separator*.55,420*cue.separator);
    label(data.partnerLabel,674,visible*cue.partnerLabel,cue.partnerLabel);
    company(data.partner1,710,770,cue.partner);
    company(data.partner2,1210,770,cue.partnerSecond);
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
