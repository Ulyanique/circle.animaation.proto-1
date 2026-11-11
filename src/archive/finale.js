import logoUrl from '../assets/logo.svg?url';
import {FINALE_START} from './motion.js';
import {ease, finaleState, finalLightPoint} from './finale-motion.js';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import '@fontsource/cormorant-garamond/latin-600.css';

// Финал — отдельный предпросмотр, с тем же исходным знаком и шрифтом, что и заставки.
export function createFinale(canvas,onReady=()=>{}) {
  canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d');
  const logo=new Image();logo.src=logoUrl;
  // Маска сохраняет настоящую форму SVG; градиент лишь окрашивает её в золото.
  const logoCanvas=document.createElement('canvas');logoCanvas.width=480;logoCanvas.height=504;
  let logoReady=false;
  logo.onload=()=>{
    const g=logoCanvas.getContext('2d');g.drawImage(logo,0,0,480,504);
    g.globalCompositeOperation='source-in';const gold=g.createLinearGradient(0,0,480,504);
    gold.addColorStop(0,'#fff0c0');gold.addColorStop(.32,'#d9b368');gold.addColorStop(.62,'#8b5f29');gold.addColorStop(1,'#f1d39a');
    g.fillStyle=gold;g.fillRect(0,0,480,504);logoReady=true;onReady();
  };
  document.fonts.load('600 70px "Cormorant Garamond"','Янтарный циркуль').then(()=>onReady()).catch(()=>{});
  function render(time,projection) {
    // Чёрный стык закрывает переход конца композиции к первому кадру цикла.
    if(time<.8){canvas.style.opacity=String(1-ease(time/.8));ctx.clearRect(0,0,1920,1080);ctx.fillStyle='#030302';ctx.fillRect(0,0,1920,1080);return;}
    const local=time-FINALE_START;
    const {fade,logo:logoOpacity,title,light,closing}=finaleState(local);
    canvas.style.opacity=String(fade);if(fade===0)return;
    ctx.clearRect(0,0,1920,1080);
    const bg=ctx.createRadialGradient(960,470,0,960,500,1100);
    bg.addColorStop(0,'#211b12');bg.addColorStop(.42,'#0e0c09');bg.addColorStop(1,'#030302');ctx.fillStyle=bg;ctx.fillRect(0,0,1920,1080);
    ctx.save();ctx.globalAlpha=.12;ctx.lineWidth=2;
    for(let i=0;i<12;i++){ctx.strokeStyle=i%3?'#967543':'#e7ca91';ctx.beginPath();ctx.moveTo(-150+i*35,1050);ctx.lineTo(960,340+i*4);ctx.lineTo(2070-i*35,1050);ctx.stroke();}ctx.restore();
    // В финале нить продолжает 3D-свет от его проекции и плавно приходит к знаку.
    const start=projection?.visible?projection:{x:250,y:570};
    const head=finalLightPoint(local,start);
    ctx.save();ctx.globalCompositeOperation='lighter';
    for(let strand=0;strand<4;strand++){
      for(let segment=0;segment<24;segment++){
        const a=segment/24,b=(segment+1)/24;
        const pa=finalLightPoint(local-a*1.6,start),pb=finalLightPoint(local-b*1.6,start);
        const spread=(strand-1.5)*5;
        ctx.beginPath();ctx.moveTo(pa.x,pa.y+spread*a);ctx.lineTo(pb.x,pb.y+spread*b);
        ctx.globalAlpha=light*Math.pow(1-a,1.4)*(strand===0?.75:.4);
        ctx.strokeStyle=strand===0?'#fff2c3':'#e5bd72';ctx.lineWidth=strand===0?3:1.3;ctx.stroke();
      }
    }
    const glow=ctx.createRadialGradient(head.x,head.y,0,head.x,head.y,75);
    glow.addColorStop(0,'rgba(255,250,221,.95)');glow.addColorStop(.1,'rgba(255,226,161,.65)');glow.addColorStop(1,'rgba(255,184,80,0)');
    ctx.globalAlpha=light*.85;ctx.fillStyle=glow;ctx.fillRect(head.x-75,head.y-75,150,150);ctx.restore();
    if(logoReady){ctx.save();ctx.globalAlpha=logoOpacity;ctx.shadowColor='rgba(232,190,111,.28)';ctx.shadowBlur=18;ctx.drawImage(logoCanvas,815,220,290,304.5);ctx.restore();}
    ctx.save();ctx.globalAlpha=title;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=12;
    ctx.font='600 78px "Cormorant Garamond", Georgia, serif';
    const gold=ctx.createLinearGradient(0,630,0,708);gold.addColorStop(0,'#fff3cc');gold.addColorStop(.4,'#f0cc78');gold.addColorStop(.75,'#c08c36');gold.addColorStop(1,'#e8c06a');
    ctx.fillStyle=gold;ctx.fillText('Янтарный циркуль',960,670);ctx.restore();
    if(closing>0){ctx.save();ctx.globalAlpha=closing;ctx.fillStyle='#030302';ctx.fillRect(0,0,1920,1080);ctx.restore();}
  }
  return {render};
}
