import { BASE_FRAME } from "./scenes/catalog.js";
// Нарисованные в canvas элементы: никакой декоративной части в фоновой
// текстуре нет. Все огибающие зависят только от абсолютного времени сцены.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = (a,b,x) => { const t=clamp((x-a)/Math.max(.0001,b-a)); return t*t*(3-2*t); };

export function partnersCues(phase, timeline, motion = 1) {
  const local = phase.beforeStart ? 0 : phase.local;
  const exitStart = timeline.drawDuration + timeline.emergeDuration + timeline.holdDuration;
  const fade = 1 - smooth(exitStart, exitStart + Math.max(.05,timeline.fadeDuration)*.9,local);
  const visible = (phase.beforeStart ? 0 : smooth(0,.85,local)) * fade;
  const startSpan = Math.max(.25,timeline.drawDuration);
  const entry = (a,b) => smooth(a*startSpan,b*startSpan,local);
  const m = clamp(Number.isFinite(motion) ? motion : 1);
  const idle = smooth(startSpan,startSpan+1,local)*fade*m;
  return {
    visible, frame:entry(.08,.9), curtain:entry(.02,.65), foliage:entry(.18,1.0),
    compass:entry(.28,1.1), title:entry(.10,.65),
    organizerLabel:entry(.35,.9), organizer:entry(.65,1.55), organizerSecond:entry(.9,1.8),
    partnerLabel:entry(1.12,1.6), partner:entry(1.4,2.3), partnerSecond:entry(1.65,2.55),
    separator:entry(.9,1.55),
    light: smooth(.45,1.2,local)*(1-smooth(3.8,5.2,local))*m,
    glint: (.5 + .5*Math.sin(local*.39-1.2))*idle,
    leafMotion: idle*Math.sin(local*.48+.7),
    curtainSway: idle * Math.sin(local*.42)*8,
    foliageSway: idle * Math.sin(local*.35+1)*.012,
    compassSway: idle * Math.sin(local*.30+.4)*.008,
    motion:m,
  };
}

function framePath(ctx, inset) {
  const l=54+inset,r=1866-inset,t=42+inset,b=1038-inset,c=38;
  ctx.beginPath();ctx.moveTo(l+c,t);ctx.lineTo(r-c,t);
  ctx.quadraticCurveTo(r-c,t+c,r,t+c);ctx.lineTo(r,b-c);
  ctx.quadraticCurveTo(r-c,b-c,r-c,b);ctx.lineTo(l+c,b);
  ctx.quadraticCurveTo(l+c,b-c,l,b-c);ctx.lineTo(l,t+c);
  ctx.quadraticCurveTo(l+c,t+c,l+c,t);ctx.closePath();
}
function drawFrame(ctx,cue) {
  ctx.save();ctx.globalAlpha=cue.visible*.82;
  // Периметр внешнего контура около 5600 px; запас нужен и для
  // скруглённых углов, иначе последняя часть левой стороны не дорисуется.
  const frameLength=6000;
  ctx.setLineDash([Math.max(.001,frameLength*cue.frame),frameLength]);
  // Позолота с тонкой тёмной кромкой и движущимся отражением.
  ctx.lineWidth=5;ctx.strokeStyle='rgba(33,13,5,.65)';framePath(ctx,0);ctx.stroke();
  // Рамка рисуется в координатах базового кадра; контекст уже отмасштабирован
  // вызывающей стороной, поэтому берём размер из каталога, а не литерал.
  const gold=ctx.createLinearGradient(0,0,BASE_FRAME.width,BASE_FRAME.height);
  gold.addColorStop(0,'#805b34');gold.addColorStop(.25,'#d1ac70');
  gold.addColorStop(.48,'#f4dcaa');gold.addColorStop(.72,'#99703e');gold.addColorStop(1,'#d8b77f');
  ctx.strokeStyle=gold;ctx.lineWidth=2.5;framePath(ctx,0);ctx.stroke();
  ctx.strokeStyle='rgba(255,239,197,.5)';ctx.lineWidth=.7;framePath(ctx,1.5);ctx.stroke();
  ctx.globalAlpha=cue.visible*.37;ctx.lineWidth=1;framePath(ctx,10);ctx.stroke();
  ctx.setLineDash([]);
  // Небольшие ювелирные акценты на углах появляются вместе с рамкой.
  ctx.globalAlpha=cue.visible*cue.frame*.65;ctx.fillStyle='#e8cc96';
  for(const [x,y] of [[112,42],[1808,42],[112,1038],[1808,1038]]){
    ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-3,-3,6,6);ctx.restore();
  }
  const x=180+1560*cue.glint;
  const glow=ctx.createRadialGradient(x,42,0,x,42,75);
  glow.addColorStop(0,'rgba(255,240,196,.32)');glow.addColorStop(1,'rgba(255,230,180,0)');
  ctx.globalAlpha=cue.visible*cue.frame*cue.motion*.65;ctx.fillStyle=glow;ctx.fillRect(x-75,0,150,117);
  ctx.restore();
}
function drawCurtain(ctx,cue) {
  ctx.save();ctx.globalAlpha=cue.visible*cue.curtain;
  const x=-80*(1-cue.curtain)+cue.curtainSway;
  ctx.translate(x,0);
  const g=ctx.createLinearGradient(0,0,350,0);
  g.addColorStop(0,'#1a080b');g.addColorStop(.18,'#390c11');g.addColorStop(.36,'#5b1920');
  g.addColorStop(.52,'#29090d');g.addColorStop(.72,'#491219');g.addColorStop(1,'#180609');
  ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=32;ctx.shadowOffsetX=14;
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(390,0);
  ctx.bezierCurveTo(355,190,300,410,185,645);ctx.bezierCurveTo(170,800,225,990,250,1080);
  ctx.lineTo(0,1080);ctx.closePath();ctx.fill();
  ctx.shadowColor='transparent';ctx.save();ctx.clip();
  // Широкие мягкие светотеневые полосы повторяют траекторию сборки ткани.
  for(let i=0;i<9;i++){
    const top=-48+i*56, waist=88+i*13, bottom=40+i*39;
    ctx.beginPath();ctx.moveTo(top,0);ctx.bezierCurveTo(top+18,230,waist-65,430,waist,645);
    ctx.bezierCurveTo(waist-20,810,bottom-18,970,bottom,1080);
    ctx.lineWidth=48+i%3*8;ctx.strokeStyle=i%2?'rgba(245,105,110,.035)':'rgba(5,0,2,.14)';ctx.stroke();
    ctx.lineWidth=12;ctx.strokeStyle='rgba(255,171,161,.035)';ctx.stroke();
  }
  const sheen=ctx.createRadialGradient(135,330,10,145,350,520);
  sheen.addColorStop(0,'rgba(255,155,137,.12)');sheen.addColorStop(.55,'rgba(130,27,35,.04)');sheen.addColorStop(1,'rgba(8,0,2,.35)');
  ctx.fillStyle=sheen;ctx.fillRect(0,0,450,1080);ctx.restore();
  // Полупрозрачные изогнутые полосы с постепенным затуханием вместо
  // жёстких контуров: свет распределяется по ширине каждой складки.
  ctx.save();ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(390,0);
  ctx.bezierCurveTo(355,190,300,410,185,645);ctx.bezierCurveTo(170,800,225,990,250,1080);
  ctx.lineTo(0,1080);ctx.closePath();ctx.clip();
  for(let i=0;i<6;i++){
    const top=20+i*63, mid=82+i*19, bottom=60+i*31;
    for(let j=5;j>=0;j--){
      const width=14+j*11;ctx.beginPath();ctx.moveTo(top,0);
      ctx.bezierCurveTo(top+18,245,mid-45,430,mid,645);
      ctx.bezierCurveTo(mid-13,800,bottom-8,970,bottom,1080);
      ctx.lineWidth=width;ctx.strokeStyle=i%2?'rgba(245,133,126,.012)':'rgba(0,0,0,.022)';ctx.stroke();
    }
  }
  // Едва заметные неровности бархата, всегда одинаковые для данного кадра.
  for(let i=0;i<230;i++){
    const x=(i*73%360), y=(i*193%1080), len=8+(i*17%26);
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+1.5,y+len);
    ctx.strokeStyle=i%3?'rgba(252,176,160,.018)':'rgba(15,0,3,.045)';ctx.lineWidth=.7;ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle='#cba566';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-10,598);ctx.quadraticCurveTo(91,686,190,645);ctx.stroke();
  ctx.strokeStyle='#f1d7a1';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(1,603);ctx.quadraticCurveTo(95,676,186,645);ctx.stroke();
  ctx.fillStyle='#d9b979';ctx.beginPath();ctx.arc(183,647,9,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.moveTo(183,654);ctx.lineTo(183,716);ctx.strokeStyle='#b89458';ctx.lineWidth=3;ctx.stroke();
  const tassel=ctx.createLinearGradient(164,0,204,0);tassel.addColorStop(0,'#79502b');tassel.addColorStop(.5,'#f2d496');tassel.addColorStop(1,'#856035');
  ctx.fillStyle=tassel;ctx.beginPath();ctx.moveTo(176,706);ctx.lineTo(190,706);ctx.lineTo(205,777);ctx.quadraticCurveTo(184,788,164,777);ctx.closePath();ctx.fill();
  ctx.save();ctx.beginPath();ctx.moveTo(176,706);ctx.lineTo(190,706);ctx.lineTo(205,777);ctx.quadraticCurveTo(184,788,164,777);ctx.closePath();ctx.clip();
  for(let i=0;i<12;i++){ctx.beginPath();ctx.moveTo(177+i*1.2,708);ctx.quadraticCurveTo(174+i*1.8,750,165+i*3.5,783);ctx.strokeStyle=i%2?'rgba(255,237,175,.35)':'rgba(75,43,17,.28)';ctx.lineWidth=.8;ctx.stroke();}ctx.restore();
  ctx.restore();
}
function leaf(ctx,x,y,angle,size,alpha) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=alpha;
  ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=7;ctx.shadowOffsetX=3;ctx.shadowOffsetY=4;
  const g=ctx.createLinearGradient(0,-size*.3,size,size*.3);
  g.addColorStop(0,'#5d3a1b');g.addColorStop(.2,'#b58a50');g.addColorStop(.42,'#f9e5af');g.addColorStop(.53,'#c39b5e');g.addColorStop(.75,'#8b602f');g.addColorStop(1,'#d4ae70');
  ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(size*.16,-size*.42,size*.74,-size*.49,size,0);
  ctx.bezierCurveTo(size*.73,size*.32,size*.21,size*.35,0,0);ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle='rgba(255,230,177,.45)';ctx.lineWidth=.8;ctx.stroke();
  ctx.strokeStyle='rgba(81,48,20,.6)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(1,0);ctx.quadraticCurveTo(size*.5,-size*.025,size*.96,0);ctx.stroke();
  for(let i=1;i<=5;i++){const p=size*(.16+i*.12);ctx.beginPath();ctx.moveTo(p,0);ctx.quadraticCurveTo(p+size*.09,-size*.07,p+size*.14,-size*(.23-i*.022));ctx.moveTo(p,0);ctx.quadraticCurveTo(p+size*.09,size*.06,p+size*.14,size*(.19-i*.018));ctx.strokeStyle='rgba(101,65,29,.32)';ctx.lineWidth=.65;ctx.stroke();}
  ctx.restore();
}
function drawFoliage(ctx,cue) {
  ctx.save();ctx.globalAlpha=cue.visible*cue.foliage;ctx.translate(1860,20);ctx.rotate(cue.foliageSway);ctx.translate(-1860,-20);
  ctx.strokeStyle='#b58b52';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(1930,-20);ctx.quadraticCurveTo(1740,55,1505,235);ctx.stroke();
  for(let i=0;i<8;i++){
    const x=1885-i*47,y=5+i*27,sgn=i%2===0?-1:1;
    const endX=x-18,endY=y+sgn*52;
    ctx.beginPath();ctx.moveTo(x,y);ctx.quadraticCurveTo(x-5,y+sgn*22,endX,endY);ctx.lineWidth=1.8;ctx.stroke();
    const a=smooth(.05+i*.065,.38+i*.065,cue.foliage);
    const flutter=cue.leafMotion*.018*Math.sin(i*1.7+0.4);
    leaf(ctx,endX,endY,(sgn<0?-2.5:2.3)+flutter,54+i%3*5,a);
    leaf(ctx,x-28,y+sgn*28,(sgn<0?-2.9:2.7)-flutter*.8,40,a);
  }
  ctx.restore();
}
// Металлическая ножка строится вдоль локальной оси: отражения следуют
// за её поворотом, а не остаются неподвижными на экране.
function compassLeg(ctx, angle, length, width, pointed) {
  ctx.save();ctx.rotate(angle);
  const metal=ctx.createLinearGradient(-width/2,0,width/2,0);
  metal.addColorStop(0,'#4d311b');metal.addColorStop(.12,'#977044');
  metal.addColorStop(.28,'#bfa574');metal.addColorStop(.41,'#e5d2a6');
  metal.addColorStop(.53,'#b38c58');metal.addColorStop(.7,'#77502a');
  metal.addColorStop(.88,'#b99a67');metal.addColorStop(1,'#583719');
  ctx.shadowColor='rgba(0,0,0,.62)';ctx.shadowBlur=18;ctx.shadowOffsetX=9;ctx.shadowOffsetY=12;
  ctx.beginPath();ctx.moveTo(-width*.47,10);ctx.quadraticCurveTo(-width*.61,37,-width*.43,70);
  ctx.lineTo(-width*.28,length-42);ctx.lineTo(0,length);ctx.lineTo(width*.22,length-40);
  ctx.lineTo(width*.43,70);ctx.quadraticCurveTo(width*.57,36,width*.47,10);ctx.closePath();
  ctx.fillStyle=metal;ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle='#57391f';ctx.lineWidth=1.5;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-width*.28,60);ctx.lineTo(-width*.18,length-47);
  ctx.strokeStyle='rgba(255,244,211,.75)';ctx.lineWidth=1.4;ctx.stroke();
  ctx.beginPath();ctx.moveTo(width*.26,64);ctx.lineTo(width*.12,length-51);
  ctx.strokeStyle='rgba(46,25,12,.55)';ctx.lineWidth=1.1;ctx.stroke();
  // Тонкие неодинаковые штрихи дают металлу шероховатость без изображения.
  ctx.save();ctx.globalAlpha=.17;
  for(let i=0;i<15;i++){let x=-width*.38+(i*13%29)/29*width*.76;
    ctx.beginPath();ctx.moveTo(x,76+(i*37%120));ctx.lineTo(x*.7,length-80-(i*29%90));
    ctx.strokeStyle=i%3?'#fff0c9':'#42250f';ctx.lineWidth=.45;ctx.stroke();}
  ctx.restore();
  if(pointed){ctx.fillStyle='#32251f';ctx.beginPath();ctx.moveTo(-3,length-17);ctx.lineTo(0,length+17);ctx.lineTo(3,length-17);ctx.fill();}
  ctx.restore();
}
function drawCompass(ctx,cue) {
  ctx.save();ctx.globalAlpha=cue.visible*cue.compass;
  ctx.translate(1710+65*(1-cue.compass),610+25*(1-cue.compass));ctx.rotate(cue.compassSway);
  // Реальные повороты ножек вокруг шарнира при появлении.
  compassLeg(ctx,.39-.13*(1-cue.compass),440,35,true);
  compassLeg(ctx,-.18+.13*(1-cue.compass),430,25,true);
  // Хомут и вращающаяся гайка с кольцевой фаской.
  const hinge=ctx.createRadialGradient(-11,-14,2,0,0,40);
  hinge.addColorStop(0,'#e9d9b6');hinge.addColorStop(.25,'#cab386');hinge.addColorStop(.56,'#9b7040');
  hinge.addColorStop(.75,'#ccb183');hinge.addColorStop(1,'#5a361b');
  ctx.shadowColor='rgba(0,0,0,.55)';ctx.shadowBlur=10;ctx.shadowOffsetX=4;ctx.shadowOffsetY=5;
  ctx.fillStyle=hinge;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='transparent';ctx.strokeStyle='#60401f';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='rgba(255,238,190,.72)';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,27,0,Math.PI*2);ctx.stroke();
  const screw=ctx.createRadialGradient(-4,-5,1,0,0,15);screw.addColorStop(0,'#fbe8ba');screw.addColorStop(.55,'#b88b4e');screw.addColorStop(1,'#65421e');
  ctx.fillStyle=screw;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='rgba(72,42,18,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-6,3);ctx.lineTo(6,-3);ctx.stroke();
  // Кольцо и стойка имеют тёмную кромку и узкий блик, как гнутый металл.
  ctx.beginPath();ctx.arc(0,-52,27,0,Math.PI*2);ctx.moveTo(0,-25);ctx.lineTo(0,-8);
  ctx.strokeStyle='#65421f';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#e4c58d';ctx.lineWidth=4;ctx.stroke();
  ctx.beginPath();ctx.arc(-1,-53,27,3.6,5.8);ctx.strokeStyle='rgba(255,245,212,.75)';ctx.lineWidth=1.3;ctx.stroke();
  ctx.save();ctx.globalAlpha*=cue.light*.8;ctx.fillStyle='#fff4d5';ctx.shadowColor='#ffe2a3';ctx.shadowBlur=24;ctx.beginPath();ctx.arc(-15,-17,3,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.restore();
}

export function drawPartnersDecor(ctx,cue,settings) {
  if (settings.curtainVisible !== false) drawCurtain(ctx,cue);
  if (settings.frameVisible !== false) drawFrame(ctx,cue);
  if (settings.foliageVisible !== false) drawFoliage(ctx,cue);
  if (settings.compassVisible !== false) drawCompass(ctx,cue);
}
