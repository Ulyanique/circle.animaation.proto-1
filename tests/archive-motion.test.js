import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {archiveMotion,archiveLightPosition,ARCHIVE_PANELS,MEDIA_SURFACE_SCALE,wrapTime,videoTimeForSlot,ARCHIVE_DURATION,FINALE_START,SLOT_COUNT,panelOpacity} from '../src/archive/motion.js';
import {mediaOutline,mediaSegments,mediaCuts,mediaSeams,mediaSupports} from '../src/archive/media-surface.js';

test('сцена детерминирована и не зависит от порядка перемотки',()=>{
  const a=archiveMotion(7.2);archiveMotion(19);assert.deepEqual(archiveMotion(7.2),a);
  assert.equal(wrapTime(ARCHIVE_DURATION),0);assert.equal(wrapTime(NaN),0);
  assert.deepEqual(archiveLightPosition(5),archiveLightPosition(5));
});

test('камера непрерывно летит и смотрит вперёд без поворота к фотографиям',()=>{
  for(let t=0;t<FINALE_START-.05;t+=.05){
    const a=archiveMotion(t),b=archiveMotion(t+.05);
    const yaw=Math.atan2(a.lookX-a.cameraX,a.cameraZ-a.lookZ);
    const pitch=Math.atan2(a.lookY-a.cameraY,a.cameraZ-a.lookZ);
    assert.ok(Math.abs(yaw)<.091 && Math.abs(pitch)<.051);
    assert.ok(a.lookZ<a.cameraZ);assert.equal(a.roll,0);
    assert.ok((b.cameraZ-a.cameraZ)/.05< -1 && (b.cameraZ-a.cameraZ)/.05> -2);
    assert.ok(Math.abs((b.cameraX-a.cameraX)/.05)<.46);
    assert.ok(Math.abs((b.cameraY-a.cameraY)/.05)<.25);
  }
  const positions=Array.from({length:101},(_,i)=>archiveMotion(i*.79));
  assert.ok(Math.max(...positions.map(p=>p.cameraX))-Math.min(...positions.map(p=>p.cameraX))>1.5);
  assert.ok(Math.max(...positions.map(p=>p.cameraY))-Math.min(...positions.map(p=>p.cameraY))>2);
});

test('десять медиа плавно проявляются, свет движется вперёд',()=>{
  assert.equal(SLOT_COUNT,10);
  for(let i=1;i<SLOT_COUNT;i++){
    const boundary=i*8;
    assert.ok(panelOpacity(boundary-2,i)>0 && panelOpacity(boundary-2,i)<1);
    assert.ok(panelOpacity(boundary-2,i-1)>0 && panelOpacity(boundary-2,i-1)<1);
    for(let t=boundary-3;t<boundary+1;t+=.01)assert.ok(Math.abs(panelOpacity(t+.01,i)-panelOpacity(t,i))<.02);
  }
  for(let t=0;t<FINALE_START;t+=.1)assert.ok(archiveLightPosition(t+.1)[2]<archiveLightPosition(t)[2]);
  assert.notDeepEqual(archiveLightPosition(0),archiveLightPosition(-2));
});

test('изображения располагаются с обеих сторон свободного пути',()=>{
  assert.ok(ARCHIVE_PANELS.some(p=>p.side===-1));assert.ok(ARCHIVE_PANELS.some(p=>p.side===1));
  assert.ok(ARCHIVE_PANELS.some((p,i)=>i>0 && p.side===ARCHIVE_PANELS[i-1].side));
  assert.ok(ARCHIVE_PANELS.some((p,i)=>i>0 && p.side!==ARCHIVE_PANELS[i-1].side));
});

test('камера и источник не пересекают медиаграни и их опоры',()=>{
  const scene=new THREE.Group(),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  for(const [i,p] of ARCHIVE_PANELS.entries()){
    const outline=mediaOutline(i),shape=new THREE.Shape();shape.moveTo(...outline[0]);
    for(const point of outline.slice(1))shape.lineTo(...point);shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ShapeGeometry(shape),material);mesh.position.set(p.x,0,p.z);mesh.rotation.set(0,p.ry,p.rz);mesh.scale.setScalar(MEDIA_SURFACE_SCALE);scene.add(mesh);
    for(const [j,points] of mediaSupports(p.side).entries()){
      const supportShape=new THREE.Shape();supportShape.moveTo(...points[0]);for(const pt of points.slice(1))supportShape.lineTo(...pt);supportShape.closePath();
      const support=new THREE.Mesh(new THREE.ShapeGeometry(supportShape),material);
      support.position.z=-.05-j*.018;mesh.add(support);
    }
  }
  scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
  const camera=t=>{const m=archiveMotion(t);return new THREE.Vector3(m.cameraX,m.cameraY,m.cameraZ);};
  for(const [name,point] of [['камера',camera],['свет',t=>new THREE.Vector3(...archiveLightPosition(t))],['край следа слева',t=>new THREE.Vector3(...archiveLightPosition(t)).add(new THREE.Vector3(-.2,-.12,0))],['край следа справа',t=>new THREE.Vector3(...archiveLightPosition(t)).add(new THREE.Vector3(.2,.12,0))]]){
    for(let t=0;t<FINALE_START-.05;t+=.05){const a=point(t),delta=point(t+.05).sub(a),length=delta.length();
      ray.set(a,delta.normalize());ray.far=length;
      assert.equal(ray.intersectObject(scene,true).length,0,`${name} пересекает медиагрань в ${t.toFixed(2)} с`);
    }
  }
});

test('составное фото: три пластины без скачка координат изображения',()=>{
  for(let i=0;i<SLOT_COUNT;i++){
    const {slope,levels,gap}=mediaCuts(i),parts=mediaSegments(i),seams=mediaSeams(i);
    assert.equal(parts.length,3);assert.equal(seams.length,2);
    for(const part of parts)assert.ok(part.length>=3);
    for(const [j,part] of parts.entries())for(const p of part){
      const h=p[1]-slope*p[0];
      if(j===0)assert.ok(h<=levels[0]-gap/2+1e-9);
      if(j===1)assert.ok(h>=levels[0]+gap/2-1e-9&&h<=levels[1]-gap/2+1e-9);
      if(j===2)assert.ok(h>=levels[1]+gap/2-1e-9);
      assert.ok(p[0]>=-2.9-1e-9&&p[0]<=2.9+1e-9&&p[1]>=-2.3-1e-9&&p[1]<=2.3+1e-9);
    }
    for(const [j,seam] of seams.entries()){assert.equal(seam.length,2);for(const p of seam)assert.ok(Math.abs(p[1]-slope*p[0]-levels[j])<1e-9);}
  }
});

test('переходы и фокусное расстояние непрерывны на границах эпизодов',()=>{
  for(let i=1;i<SLOT_COUNT;i++){
    const t=i*8,a=archiveMotion(t-1e-5),b=archiveMotion(t+1e-5);
    for(const key of ['cameraX','cameraY','cameraZ','lookX','lookY','lookZ','fov'])assert.ok(Math.abs(a[key]-b[key])<.001);
    const aLight=archiveLightPosition(t-1e-5),bLight=archiveLightPosition(t+1e-5);
    assert.ok(Math.hypot(...aLight.map((v,j)=>v-bLight[j]))<.001);
  }
});

test('часть траектории следа проецируется в кадр',()=>{
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,100);
  for(let t=1;t<FINALE_START-.8;t+=.2){
    const m=archiveMotion(t);camera.fov=m.fov;camera.position.set(m.cameraX,m.cameraY,m.cameraZ);
    camera.lookAt(m.lookX,m.lookY,m.lookZ);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    let visible=false;
    for(let age=0;age<=4.2;age+=.1){const p=new THREE.Vector3(...archiveLightPosition(t-age)).project(camera);if(Math.abs(p.x)<.98&&Math.abs(p.y)<.98&&p.z>-1&&p.z<1){visible=true;break;}}
    assert.ok(visible,`траектория вне проекции на ${t.toFixed(1)} с`);
  }
});

test('короткое видео удерживается на последнем кадре',()=>{
  assert.equal(videoTimeForSlot(2,0,3),2);assert.equal(videoTimeForSlot(4,0,3),3-1/30);
  assert.equal(videoTimeForSlot(7,0,3),3-1/30);assert.equal(videoTimeForSlot(2,1,3),0);
});

test('на неподвижной медиаграни виден параллакс от движения камеры',()=>{
  const p=ARCHIVE_PANELS[0],surface=new THREE.Group();
  surface.position.set(p.x,0,p.z);surface.rotation.set(0,p.ry,p.rz);surface.scale.setScalar(MEDIA_SURFACE_SCALE);surface.updateMatrixWorld();
  const world=surface.localToWorld(new THREE.Vector3(1,0,0));
  const projected=t=>{const m=archiveMotion(t),camera=new THREE.PerspectiveCamera(m.fov,16/9,.1,100);
    camera.position.set(m.cameraX,m.cameraY,m.cameraZ);camera.lookAt(m.lookX,m.lookY,m.lookZ);camera.updateProjectionMatrix();camera.updateMatrixWorld();return world.clone().project(camera);};
  const a=projected(1),b=projected(4);
  assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>.15,'изображение почти не перемещается в кадре');
});

test('дуги камеры плавно стыкуются между опорными точками',()=>{
  for(let i=0;i<SLOT_COUNT;i++){
    const t=9.3333333333+i*8;if(t>=FINALE_START)break;
    const a=archiveMotion(t-.0001),b=archiveMotion(t+.0001);
    assert.ok(Math.abs(a.cameraX-b.cameraX)<.001);
    const before=(archiveMotion(t).cameraX-archiveMotion(t-.01).cameraX)/.01;
    const after=(archiveMotion(t+.01).cameraX-archiveMotion(t).cameraX)/.01;
    assert.ok(Math.abs(before-after)<.01);
  }
});
