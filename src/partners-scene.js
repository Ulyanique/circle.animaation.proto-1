import * as THREE from 'three';
import backgroundUrl from './assets/partners-background.png';
import curtainUrl from './assets/partners-curtain.png';
import proelectroUrl from './assets/partner-logos/proelectro.svg';
import proelectroschitUrl from './assets/partner-logos/proelectroschit.svg';
import promrukavUrl from './assets/partner-logos/promrukav.svg';
import keazUrl from './assets/partner-logos/keaz.svg';
import {partnersCues, drawPartnersDecor, drawPartnersParticles} from './partners-graphics.js';
import {partnersLogoMotion} from './partners-logo-motion.js';
import { LogoScene } from './scene.js';
import { computePhase } from './timeline.js';
import { OUTPUT } from './scenes/catalog.js';

const image = new Image();
let backgroundCanvas;
const imageReady = new Promise(resolve => {
  image.onload = () => {
    // Центрированный cover без искажения пропорций; масштаб фиксируем один раз.
    backgroundCanvas = document.createElement('canvas');
    backgroundCanvas.width = OUTPUT.width; backgroundCanvas.height = OUTPUT.height;
    const scale = Math.max(OUTPUT.width / image.naturalWidth, OUTPUT.height / image.naturalHeight);
    const sw = OUTPUT.width / scale, sh = OUTPUT.height / scale;
    backgroundCanvas.getContext('2d').drawImage(image, (image.naturalWidth-sw)/2, (image.naturalHeight-sh)/2, sw, sh, 0, 0, OUTPUT.width, OUTPUT.height);
    resolve(true);
  };
  image.onerror = () => resolve(false);
  image.src = backgroundUrl;
});
// Прозрачная штора — отдельный слой, а не часть кадра с фоном.
let curtainCanvas;
const curtainReady = new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    curtainCanvas = document.createElement('canvas');
    curtainCanvas.width = img.naturalWidth; curtainCanvas.height = img.naturalHeight;
    curtainCanvas.getContext('2d').drawImage(img,0,0);
    resolve(true);
  };
  img.onerror = () => resolve(false);
  img.src = curtainUrl;
});
// SVG заранее растеризуются в целевом размере: одинаковый кадр при любом
// порядке seek и без гонки загрузки изображений во время экспорта.
const logoSources = {
  organizer1: { url: proelectroUrl, text: 'ПРОэлектро' },
  organizer2: { url: proelectroschitUrl, text: 'ПРОэлектрощит' },
  partner1: { url: promrukavUrl, text: 'Промрукав' },
  partner2: { url: keazUrl, text: 'КЭАЗ', scale: .86 },
};
const logos = {};
const logosReady = Promise.all(Object.entries(logoSources).map(([key, source]) => new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    const ratio = Math.min(455 / img.naturalWidth, 108 / img.naturalHeight) * (source.scale ?? 1);
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement('canvas');canvas.width = w;canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    // Форма SVG служит маской; прозрачные области остаются прозрачными.
    ctx.globalCompositeOperation = 'source-in';
    const gold = ctx.createLinearGradient(0, 0, 0, h);
    gold.addColorStop(0, '#fff0c7');gold.addColorStop(.32, '#e7c88e');
    gold.addColorStop(.56, '#bd8a4c');gold.addColorStop(.75, '#f0d6a0');gold.addColorStop(1, '#b48046');
    ctx.fillStyle = gold;ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';logos[key] = canvas;resolve(true);
  };
  img.onerror = () => { console.warn(`Не удалось загрузить логотип ${key}`);resolve(false); };
  img.src = source.url;
})));
export const loadPartnersBackground = () => Promise.all([imageReady, logosReady, curtainReady]);

/** Сцена с предоставленными SVG-логотипами и редактируемыми подписями. */
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
    this.card = document.createElement('canvas'); this.card.width=OUTPUT.width; this.card.height=OUTPUT.height;
    this.cardCtx=this.card.getContext('2d'); this.cardTexture.image=this.card;
    const ctx=this.cardCtx, w=OUTPUT.width,h=OUTPUT.height, cfg=this.cfg, tl=cfg.timeline;
    const phase=computePhase(t,tl), data=cfg.partners;
    const cue=partnersCues(phase,tl,data.motion ?? 1), visible=cue.visible;

    ctx.globalAlpha=1;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
    if (visible <= 0) { this.cardTexture.needsUpdate=true; return; }
    ctx.save();ctx.globalAlpha=visible;
    if(backgroundCanvas) ctx.drawImage(backgroundCanvas,0,0);
    else { ctx.fillStyle = '#22070b'; ctx.fillRect(0,0,w,h); }
    // Свет и виньетка — отдельные графические слои над изображением фона
    // рассчитываются для каждого абсолютного времени, одинаково при seek/export.
    const light=ctx.createRadialGradient(cue.backgroundX-130,cue.backgroundY-310,20,cue.backgroundX,cue.backgroundY,900);
    light.addColorStop(0,'rgba(255,192,145,.16)');light.addColorStop(.45,'rgba(197,97,76,.045)');light.addColorStop(1,'rgba(0,0,0,.13)');
    ctx.fillStyle=light;ctx.fillRect(0,0,w,h);
    const glow=ctx.createRadialGradient(cue.backgroundX+220,cue.backgroundY+80,0,cue.backgroundX+220,cue.backgroundY+80,620);
    glow.addColorStop(0,`rgba(221,125,92,${.035+.035*cue.backgroundGlow})`);glow.addColorStop(1,'rgba(221,125,92,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,w,h);
    // Несколько широких, медленно пульсирующих отражений на фоне; их
    // координаты и яркость зависят только от времени сцены.
    if (data.shimmerVisible !== false && cue.motion > 0) {
      ctx.save();ctx.globalCompositeOperation='screen';
      for (const [i, bx, by, radius] of [[0,350,285,420],[1,1580,500,450],[2,940,1000,560]]) {
        const t=cue.time, pulse=.5+.5*Math.sin(t*(.43+i*.11)+i*2.4);
        const x=bx+Math.sin(t*.16+i*2)*80*cue.motion, y=by+Math.cos(t*.19+i)*45*cue.motion;
        const shimmer=ctx.createRadialGradient(x,y,0,x,y,radius);
        shimmer.addColorStop(0,`rgba(230,150,83,${(.025+.075*pulse)*cue.motion})`);
        shimmer.addColorStop(.45,`rgba(199,99,65,${(.01+.025*pulse)*cue.motion})`);
        shimmer.addColorStop(1,'rgba(180,90,60,0)');
        ctx.fillStyle=shimmer;ctx.fillRect(x-radius,y-radius,radius*2,radius*2);
      }
      ctx.restore();
    }
    const vignette=ctx.createRadialGradient(960,520,360,960,520,1100);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(5,0,2,.28)');
    ctx.fillStyle=vignette;ctx.fillRect(0,0,w,h);
    ctx.restore();
    if (data.particlesVisible !== false) drawPartnersParticles(ctx,cue);
    if (curtainCanvas && data.curtainVisible !== false) {
      ctx.save();ctx.globalAlpha=visible*cue.curtain;
      // Небольшой выход за край не открывает пустую полосу при покачивании.
      const x=-10-80*(1-cue.curtain)+cue.curtainSway;
      ctx.drawImage(curtainCanvas,x,0);ctx.restore();
    }
    // Циркуль и ветви уже содержатся в bg.png, не дублируем их графикой.
    drawPartnersDecor(ctx,cue,{...data, curtainVisible: !curtainCanvas && data.curtainVisible !== false, compassVisible:false, foliageVisible:false});
    const text=(value,x,y,font,color,alpha,maxWidth,entry=1)=>{
      ctx.save();ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=font;ctx.fillStyle=color;
      ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=9;ctx.shadowOffsetY=3;
      ctx.fillText(String(value ?? ''),x,y+22*(1-entry),maxWidth);ctx.restore();
    };
    const gold='#e9ca91', warm='#d2ac70', ivory='#f6e4be';
    const title=visible*cue.title;
    text(data.title,960,150,'600 102px "Cormorant Garamond", serif',ivory,title,1000,cue.title);
    text(data.subtitle,960,264,'400 49px "Cormorant Garamond", serif',gold,title,1100,cue.title);
    // Симметричные короткие акценты вместо тяжёлых линий через весь кадр.
    const ornament=(y,alpha,width)=>{
      ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=warm;ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(960-width,y);ctx.lineTo(944,y);ctx.moveTo(976,y);ctx.lineTo(960+width,y);ctx.stroke();
      ctx.translate(960,y);ctx.rotate(Math.PI/4);ctx.strokeRect(-4,-4,8,8);ctx.restore();
    };
    ornament(324,title*.7,300*cue.title);
    const label=(value,y,alpha,entry)=>{
      text(value,960,y,'700 27px Manrope, sans-serif',gold,alpha,560,entry);
      ctx.save();ctx.globalAlpha=alpha*.4;ctx.fillStyle=warm;
      ctx.fillRect(620,y,135*entry,1);ctx.fillRect(1300-135*entry,y,135*entry,1);ctx.restore();
    };
    // Смена имени в настройках сохраняет прежнее поведение: для своего текста
    // показывается текст, а не логотип компании, имя которой заменили.
    const company=(key,value,x,y,entry,index)=>{
      const logo = value === logoSources[key].text ? logos[key] : null;
      const anim=partnersLogoMotion(entry,cue.time,tl.drawDuration,index,cue.motion);
      if (anim.opacity <= 0) return;
      if (!logo) {
        text(value,x,y,'600 57px Manrope, sans-serif',ivory,visible*anim.opacity,465,entry);
        return;
      }
      // Плавная световая маска раскрывает реальные формы SVG слева направо;
      // заготовка отдельная, поэтому маска никогда не затрагивает фон.
      let image=logo;
      if (anim.reveal < 1) {
        image=document.createElement('canvas');image.width=logo.width;image.height=logo.height;
        const mask=image.getContext('2d');mask.drawImage(logo,0,0);
        const feather=Math.max(28,logo.width*.15);
        const edge=-feather+anim.reveal*(logo.width+2*feather);
        const reveal=mask.createLinearGradient(edge-feather,0,edge+feather,0);
        reveal.addColorStop(0,'rgba(255,255,255,1)');reveal.addColorStop(1,'rgba(255,255,255,0)');
        mask.globalCompositeOperation='destination-in';mask.fillStyle=reveal;mask.fillRect(0,0,image.width,image.height);
      }
      ctx.save();ctx.translate(x,y+anim.offsetY);ctx.scale(anim.scale,anim.scale);
      ctx.globalAlpha=visible*anim.opacity;
      ctx.shadowColor='rgba(0,0,0,.6)';ctx.shadowBlur=7;ctx.shadowOffsetY=2;
      ctx.drawImage(image,-logo.width/2,-logo.height/2);
      if (anim.sweep >= 0) {
        // Блик вырезается по форме логотипа и не засвечивает соседний фон.
        const shine=document.createElement('canvas');shine.width=logo.width;shine.height=logo.height;
        const sc=shine.getContext('2d'), sx=-65+anim.sweep*(logo.width+130);
        const beam=sc.createLinearGradient(sx-55,0,sx+55,0);
        beam.addColorStop(0,'rgba(255,248,215,0)');beam.addColorStop(.5,'rgba(255,248,215,.75)');beam.addColorStop(1,'rgba(255,248,215,0)');
        sc.fillStyle=beam;sc.fillRect(0,0,shine.width,shine.height);
        sc.globalCompositeOperation='destination-in';sc.drawImage(image,0,0);
        ctx.shadowColor='transparent';ctx.globalCompositeOperation='screen';ctx.globalAlpha=visible*anim.opacity*anim.glintOpacity;
        ctx.drawImage(shine,-logo.width/2,-logo.height/2);
      }
      ctx.restore();
    };
    text(data.organizerLabel,710,389,'700 27px Manrope, sans-serif',gold,visible*cue.organizerLabel,430,cue.organizerLabel);
    text(data.coorganizerLabel,1210,389,'700 27px Manrope, sans-serif',gold,visible*cue.coorganizerLabel,430,cue.coorganizerLabel);
    company('organizer1',data.organizer1,710,485,cue.organizer,0);
    company('organizer2',data.organizer2,1210,485,cue.organizerSecond,1);
    ornament(595,visible*cue.separator*.55,420*cue.separator);
    label(data.partnerLabel,674,visible*cue.partnerLabel,cue.partnerLabel);
    company('partner1',data.partner1,710,770,cue.partner,2);
    company('partner2',data.partner2,1210,770,cue.partnerSecond,3);
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
