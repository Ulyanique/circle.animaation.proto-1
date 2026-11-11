import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {archiveMotion, archiveLightPosition, ARCHIVE_DURATION, FINALE_START, ARCHIVE_PANELS, panelOpacity, MEDIA_SURFACE_SCALE} from './motion.js';
import {mediaFit,mediaOffset,MEDIA_FRAME_ASPECT} from './media-fit.js';
import {mediaLight} from './media-light.js';
import {mediaOutline,mediaSegments,mediaSeams,mediaSupports} from './media-surface.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Отдельный Three.js-адаптер прототипа: не использует настройки или renderer основных сцен. */
export function createArchiveScene(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setClearColor(0x070604); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.12;
  // Software WebGL не вытягивает полноразмерный bloom в реальном времени.
  // На нём уменьшаем разрешение именно предпросмотра; медиа остаются исходными.
  const gl=renderer.getContext(), debug=gl.getExtension('WEBGL_debug_renderer_info');
  const rendererName=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'';
  const software=/swiftshader|llvmpipe|software/i.test(rendererName);
  const composer = software ? null : new EffectComposer(renderer);
  const scene = new THREE.Scene(); scene.background=new THREE.Color(0x070604); scene.fog = new THREE.FogExp2(0x080705,.025);
  // Мягкая студийная среда для металла, без внешних текстур и сетевых запросов.
  const environmentCanvas=document.createElement('canvas');environmentCanvas.width=512;environmentCanvas.height=256;
  const env=environmentCanvas.getContext('2d');
  const sky=env.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#6c5940');sky.addColorStop(.38,'#20190f');sky.addColorStop(.7,'#0e0b08');sky.addColorStop(1,'#44301b');
  env.fillStyle=sky;env.fillRect(0,0,512,256);
  for(const [x,y,w,h] of [[30,22,48,100],[190,16,17,155],[315,32,62,85],[447,20,12,125]]){const glow=env.createLinearGradient(x,0,x+w,0);glow.addColorStop(0,'rgba(255,224,165,0)');glow.addColorStop(.5,'rgba(255,224,165,.7)');glow.addColorStop(1,'rgba(255,224,165,0)');env.fillStyle=glow;env.fillRect(x,y,w,h);}
  const envSource=new THREE.CanvasTexture(environmentCanvas);envSource.mapping=THREE.EquirectangularReflectionMapping;envSource.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromEquirectangular(envSource);envSource.dispose();pmrem.dispose();scene.environment=environment.texture;
  const camera = new THREE.PerspectiveCamera(38,16/9,.1,100);
  if(composer){composer.addPass(new RenderPass(scene,camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(640,360),.48,.6,.84);composer.addPass(bloom);composer.addPass(new OutputPass());}
  scene.add(new THREE.HemisphereLight(0xc7a36a,0x090705,1.5));
  const light=new THREE.PointLight(0xffdf9c,55,18,2); scene.add(light);
  const ambient = new THREE.DirectionalLight(0xe5c58b,1.9); ambient.position.set(-3,6,8); scene.add(ambient);
  const panels=[];
  function polygon(points) {
    const shape=new THREE.Shape();shape.moveTo(...points[0]);for(const p of points.slice(1))shape.lineTo(...p);shape.closePath();
    const geometry=new THREE.ShapeGeometry(shape), pos=geometry.getAttribute('position'), uv=geometry.getAttribute('uv');
    for(let i=0;i<pos.count;i++)uv.setXY(i,(pos.getX(i)+2.9)/5.8,(pos.getY(i)+2.3)/4.6);
    uv.needsUpdate=true;return geometry;
  }
  function placeholder(n) {
    const c=document.createElement('canvas');c.width=1024;c.height=768;const g=c.getContext('2d');
    const grad=g.createLinearGradient(0,0,1024,768);grad.addColorStop(0,'#514b3d');grad.addColorStop(.45,'#27241e');grad.addColorStop(1,'#11100f');g.fillStyle=grad;g.fillRect(0,0,1024,768);
    g.strokeStyle='rgba(229,201,147,.12)';g.lineWidth=2;g.beginPath();g.moveTo(0,620);g.lineTo(1024,180);g.moveTo(0,670);g.lineTo(1024,230);g.stroke();
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
  }
  // Изображение — большая неправильная грань, не прямоугольная картина.
  // Соседние металлические плоскости продолжают её в общей поверхности.
  for(let i=0;i<ARCHIVE_PANELS.length;i++) {
    const group=new THREE.Group(), panel=ARCHIVE_PANELS[i];
    group.position.set(panel.x,0,panel.z);group.rotation.set(0,panel.ry,panel.rz);
    group.scale.setScalar(MEDIA_SURFACE_SCALE);
    const outline=mediaOutline(i);
    const back=new THREE.Mesh(polygon(outline),new THREE.MeshBasicMaterial({color:0x100d09,side:THREE.DoubleSide}));back.position.z=-.01;group.add(back);
    const texture=placeholder(i+1), material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false,side:THREE.DoubleSide});
    // Мягкое общее тонирование связывает разные исходники со светом сцены,
    // не заменяя фото монохромной текстурой.
    const lightUniforms={position:{value:new THREE.Vector2()},strength:{value:0}};
    material.onBeforeCompile=shader=>{
      shader.uniforms.archiveLightPosition=lightUniforms.position;
      shader.uniforms.archiveLightStrength=lightUniforms.strength;
      shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 archiveSurfaceUv;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\narchiveSurfaceUv = uv;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 archiveSurfaceUv;\nuniform vec2 archiveLightPosition;\nuniform float archiveLightStrength;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float archiveLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 archiveWarm = vec3(archiveLuma * 1.07, archiveLuma * 0.94, archiveLuma * 0.78);
        diffuseColor.rgb = mix(diffuseColor.rgb, archiveWarm, 0.13);
        vec2 archiveDelta = archiveSurfaceUv - archiveLightPosition;
        float archiveGlow = exp(-dot(archiveDelta, archiveDelta) * 11.0) * archiveLightStrength;
        diffuseColor.rgb += vec3(1.0, 0.72, 0.34) * archiveGlow;
      `);
    };
    const imageGroup=new THREE.Group();group.add(imageGroup);
    const parts=mediaSegments(i).map(polygon),imageGeometry=mergeGeometries(parts);
    for(const part of parts)part.dispose();
    const image=new THREE.Mesh(imageGeometry,material);imageGroup.add(image);
    // Тонкая золотая грань на срезе, тёмный промежуток отделяет пластины.
    for(const seam of mediaSeams(i))if(seam.length===2){
      const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(seam.map(p=>new THREE.Vector3(p[0],p[1]+.023,.012))),new THREE.LineBasicMaterial({color:0xd4b379,transparent:true,opacity:.65}));imageGroup.add(line);
    }
    // Тёмные изломанные плоскости принадлежат самой медиаконструкции;
    // с внутренней стороны проход открыт, сплошного тоннеля здесь нет.
    const plates=mediaSupports(panel.side);
    for(const [j,vertices] of plates.entries()){
      const facet=new THREE.Mesh(polygon(vertices),new THREE.MeshStandardMaterial({color:[0x483925,0x1c1812,0x675237][(j+i)%3],metalness:.6,roughness:.48,side:THREE.DoubleSide}));
      facet.position.z=-.05-j*.018;group.add(facet);
    }
    const fadeMaterials=[];
    group.traverse(obj=>{if(obj.material){obj.material.transparent=true;obj.material.depthWrite=false;fadeMaterials.push({material:obj.material,opacity:obj.material.opacity});}});
    scene.add(group);panels.push({mesh:image,texture,group,imageGroup,fadeMaterials,lightUniforms,aspect:MEDIA_FRAME_ASPECT,fit:'cover',focusX:.5,focusY:.5});
  }
  const lineCount=128, geometries=[], trailMaterials=[];
  for(let strand=0;strand<5;strand++) {
    const g=new THREE.BufferGeometry(), a=new THREE.BufferAttribute(new Float32Array(lineCount*3),3);a.setUsage(THREE.DynamicDrawUsage);g.setAttribute('position',a);
    const colors=new Float32Array(lineCount*3);for(let i=0;i<lineCount;i++){const f=Math.pow(1-i/(lineCount-1),1.6);colors[i*3]=f;colors[i*3+1]=f;colors[i*3+2]=f;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const line=new THREE.Line(g,new THREE.LineBasicMaterial({color:strand===0?0xfff1bb:0xeabb50,vertexColors:true,transparent:true,opacity:strand===0?.82:.35,blending:THREE.AdditiveBlending,depthWrite:false}));line.frustumCulled=false;scene.add(line);geometries.push(g);trailMaterials.push({material:line.material,opacity:line.material.opacity});
  }
  // Камерно-ориентированная мягкая лента дополняет тонкие линии. Геометрия
  // хранит реальные прошлые положения света и остаётся в глубине сцены.
  const ribbonGeo=new THREE.BufferGeometry(),ribbonPos=new THREE.BufferAttribute(new Float32Array(lineCount*4*3),3).setUsage(THREE.DynamicDrawUsage);
  const ribbonColors=new Float32Array(lineCount*4*3),indices=[];
  for(let i=0;i<lineCount;i++){
    const fade=Math.pow(1-i/(lineCount-1),1.5)*.7;
    for(let side=0;side<4;side++){
      const k=(i*4+side)*3, glow=side===0||side===3?0:fade;
      ribbonColors[k]=glow;ribbonColors[k+1]=glow*.58;ribbonColors[k+2]=glow*.17;
    }
    if(i<lineCount-1)for(let j=0;j<3;j++){const k=i*4+j;indices.push(k,k+1,k+4,k+1,k+5,k+4);}
  }
  ribbonGeo.setAttribute('position',ribbonPos);ribbonGeo.setAttribute('color',new THREE.BufferAttribute(ribbonColors,3));ribbonGeo.setIndex(indices);
  const ribbon=new THREE.Mesh(ribbonGeo,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.28,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false}));
  ribbon.frustumCulled=false;scene.add(ribbon);
  const spriteCanvas=document.createElement('canvas');spriteCanvas.width=spriteCanvas.height=128;const cx=spriteCanvas.getContext('2d');
  const grad=cx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,245,1)');grad.addColorStop(.055,'rgba(255,244,204,.95)');grad.addColorStop(.16,'rgba(255,208,125,.32)');grad.addColorStop(.35,'rgba(255,168,46,.04)');grad.addColorStop(1,'rgba(255,150,20,0)');cx.fillStyle=grad;cx.fillRect(0,0,128,128);
  const flareTexture=new THREE.CanvasTexture(spriteCanvas);const flare=new THREE.Sprite(new THREE.SpriteMaterial({map:flareTexture,color:0xffdf9d,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));flare.scale.set(1.8,1.8,1);scene.add(flare);
  // Узкие лучи вокруг световой точки, как оптическая звезда, а не большой шар.
  const starCanvas=document.createElement('canvas');starCanvas.width=starCanvas.height=256;
  const starCtx=starCanvas.getContext('2d');starCtx.translate(128,128);
  for(const [angle, length, width, opacity] of [[0,125,2,.7],[Math.PI/2,110,1.3,.55],[.75,90,.8,.35],[-.75,90,.8,.35]]){
    starCtx.save();starCtx.rotate(angle);const g=starCtx.createLinearGradient(-length,0,length,0);
    g.addColorStop(0,'rgba(255,220,145,0)');g.addColorStop(.5,`rgba(255,244,204,${opacity})`);g.addColorStop(1,'rgba(255,220,145,0)');
    starCtx.fillStyle=g;starCtx.fillRect(-length,-width/2,length*2,width);starCtx.restore();
  }
  const starTexture=new THREE.CanvasTexture(starCanvas);
  const starFlare=new THREE.Sprite(new THREE.SpriteMaterial({map:starTexture,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));starFlare.scale.set(4,4,1);scene.add(starFlare);
  const stars=new Float32Array(150*3), starsGeo=new THREE.BufferGeometry(); starsGeo.setAttribute('position',new THREE.BufferAttribute(stars,3).setUsage(THREE.DynamicDrawUsage));
  const dust=new THREE.Points(starsGeo,new THREE.PointsMaterial({map:flareTexture,color:0xf8cb6b,size:.085,transparent:true,opacity:.75,blending:THREE.AdditiveBlending,depthWrite:false}));dust.frustumCulled=false;scene.add(dust);
  // Плавающая пыль распределена в пространстве, а не только вдоль линии.
  const ambientGeo = new THREE.BufferGeometry(), ambientPositions = new Float32Array(360*3);
  for(let i=0;i<360;i++) {
    const random = n => { const v=Math.sin(n*127.1+311.7)*43758.5453; return v-Math.floor(v); };
    ambientPositions[i*3]=(random(i*3)-.5)*15;
    ambientPositions[i*3+1]=(random(i*3+1)-.5)*10;
    ambientPositions[i*3+2]=4-random(i*3+2)*132;
  }
  ambientGeo.setAttribute('position',new THREE.BufferAttribute(ambientPositions,3));
  const ambientDust = new THREE.Points(ambientGeo,new THREE.PointsMaterial({map:flareTexture,color:0xd4aa65,size:.10,transparent:true,opacity:.37,blending:THREE.AdditiveBlending,depthWrite:false}));scene.add(ambientDust);
  function beamPoint(time, trail=0, strand=0) {
    // Каждая точка хвоста — это предыдущее положение источника, не
    // отдельная вращающаяся вокруг камеры декоративная кривая.
    const age=trail*4.2, t=time-age, p=archiveLightPosition(t);
    const envelope=Math.min(1,trail*8);
    const spread=(strand-2)*.10*envelope;
    const wave=Math.sin(t*.65+strand*.5)*.018*envelope;
    return [p[0]+spread, p[1]+wave+spread*.5, p[2]];
  }
  function render(time) {
    const m=archiveMotion(time);
    // На стыке гасим 3D-источник одновременно с проявлением его
    // экранного продолжения, чтобы не возникали две независимые точки.
    const t=Math.max(0,Math.min(1,(m.time-(FINALE_START-.8))/1.25));
    const visibility=1-t*t*(3-2*t);
    for(const item of trailMaterials)item.material.opacity=item.opacity*visibility;
    ribbon.material.opacity=.22*visibility;flare.material.opacity=.9*visibility;starFlare.material.opacity=.65*visibility;dust.material.opacity=.48*visibility;light.intensity=55*visibility;
    const beamWorld=new THREE.Vector3(...beamPoint(m.time,0,0));
    for(let i=0;i<panels.length;i++){
      const panel=panels[i],opacity=panelOpacity(m.time,i);panel.group.visible=opacity>0;
      for(const item of panel.fadeMaterials)item.material.opacity=item.opacity*opacity;
      panel.mesh.material.depthWrite=opacity>.98;
      if(opacity>0){
        panel.mesh.updateWorldMatrix(true,false);
        const local=panel.mesh.worldToLocal(beamWorld.clone());
        const glow=mediaLight(local.x,local.y,local.z,visibility);
        panel.lightUniforms.position.value.set(glow.x,glow.y);
        panel.lightUniforms.strength.value=glow.strength;
      }
    }
    camera.position.set(m.cameraX,m.cameraY,m.cameraZ);
    if(Math.abs(camera.fov-m.fov)>.0001){camera.fov=m.fov;camera.updateProjectionMatrix();}
    camera.up.set(Math.sin(m.roll),Math.cos(m.roll),0);camera.lookAt(m.lookX,m.lookY,m.lookZ);
    for(let j=0;j<geometries.length;j++){const attr=geometries[j].getAttribute('position');for(let i=0;i<lineCount;i++){const p=beamPoint(m.time,i/(lineCount-1),j);attr.setXYZ(i,...p);}attr.needsUpdate=true;}
    const point=new THREE.Vector3(),next=new THREE.Vector3(),view=new THREE.Vector3(),side=new THREE.Vector3();
    for(let i=0;i<lineCount;i++){
      const age=i/(lineCount-1);point.fromArray(beamPoint(m.time,age,0));next.fromArray(beamPoint(m.time,Math.min(1,age+.004),0));
      view.subVectors(camera.position,point);side.subVectors(next,point).cross(view).normalize().multiplyScalar(.10+.12*(1-age));
      for(const [j,factor] of [-1,-.18,.18,1].entries())
        ribbonPos.setXYZ(i*4+j,point.x+side.x*factor,point.y+side.y*factor,point.z+side.z*factor);
    }
    ribbonPos.needsUpdate=true;
    const p=beamPoint(m.time,0,0);flare.position.set(...p);starFlare.position.set(...p);light.position.set(...p);
    const a=starsGeo.getAttribute('position');for(let i=0;i<150;i++){const age=(i%50)/50,q=beamPoint(m.time,age,0),k=i*12.9898;const s=Math.sin(k)*43758.5453;const r=s-Math.floor(s);a.setXYZ(i,q[0]+(r-.5)*.5*age,q[1]+Math.sin(k*3.1)*.25*age,q[2]+Math.cos(k)*.35*age);}a.needsUpdate=true;
    if(composer)composer.render();else renderer.render(scene,camera);
  }
  // Проекция реальной точки перехода для согласования 3D-пролёта с финальной графикой.
  const projectionCamera=new THREE.PerspectiveCamera();
  function projectLight(time) {
    const m=archiveMotion(time);projectionCamera.fov=m.fov;projectionCamera.aspect=camera.aspect;
    projectionCamera.position.set(m.cameraX,m.cameraY,m.cameraZ);projectionCamera.up.set(Math.sin(m.roll),Math.cos(m.roll),0);
    projectionCamera.lookAt(m.lookX,m.lookY,m.lookZ);projectionCamera.updateProjectionMatrix();projectionCamera.updateMatrixWorld();
    const p=new THREE.Vector3(...archiveLightPosition(m.time)).project(projectionCamera);
    return {x:(p.x*.5+.5)*1920,y:(.5-p.y*.5)*1080,visible:p.z<1};
  }
  function setFit(index,mode) {
    const panel=panels[index];panel.fit=mode==='contain'?'contain':'cover';
    const f=mediaFit(panel.aspect,panel.fit);panel.imageGroup.scale.set(f.scaleX,f.scaleY,1);
    const offset=mediaOffset(f,panel.focusX,panel.focusY);
    panel.texture.repeat.set(f.repeatX,f.repeatY);panel.texture.offset.set(offset.x,offset.y);
    panel.texture.needsUpdate=true;
  }
  function setMedia(index, texture, aspect=MEDIA_FRAME_ASPECT) {
    const panel=panels[index],old=panel.texture;panel.texture=texture;panel.aspect=aspect;
    panel.mesh.material.map=texture;panel.mesh.material.needsUpdate=true;setFit(index,panel.fit);old.dispose();
  }
  function setFocus(index,x,y) {const panel=panels[index];panel.focusX=x;panel.focusY=y;setFit(index,panel.fit);}
  function resetMedia(index) {panels[index].fit='cover';panels[index].focusX=.5;panels[index].focusY=.5;setMedia(index,placeholder(index+1));}
  function resize() {const bounds=canvas.parentElement.getBoundingClientRect();if(!bounds.width||!bounds.height)return;const ratio=software?Math.min(.65,640/bounds.width,360/bounds.height):Math.min(devicePixelRatio || 1,1.5);renderer.setPixelRatio(ratio);renderer.setSize(bounds.width,bounds.height,false);if(composer){composer.setPixelRatio(ratio);composer.setSize(bounds.width,bounds.height);}camera.aspect=bounds.width/bounds.height;camera.updateProjectionMatrix();}
  function dispose(){scene.traverse(o=>{o.geometry?.dispose(); if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose();}}});environment.dispose();composer?.dispose();renderer.dispose();}
  return {render,resize,setMedia,resetMedia,setFit,setFocus,dispose,projectLight,duration:ARCHIVE_DURATION};
}
