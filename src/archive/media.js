import * as THREE from 'three';

const timeoutMs = 15000;
function waitFor(target, event, trigger) {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>finish(new Error('Не удалось загрузить медиа вовремя')),timeoutMs);
    const success=()=>finish(), fail=()=>finish(new Error('Файл не поддерживается браузером или повреждён'));
    function finish(error) {clearTimeout(timer);target.removeEventListener(event,success);target.removeEventListener('error',fail);error?reject(error):resolve();}
    target.addEventListener(event,success,{once:true});target.addEventListener('error',fail,{once:true});trigger();
  });
}
/** Локальные данные живут в текущей вкладке; созданные URL освобождаются при замене. */
export async function loadArchiveMedia(file) {
  if(!file || !(file.type.startsWith('image/') || file.type.startsWith('video/'))) throw new Error('Выберите изображение или видео');
  const url=URL.createObjectURL(file);let source, texture, aspect;
  try {
    if(file.type.startsWith('image/')) {
      source=new Image();await waitFor(source,'load',()=>{source.src=url;});
      if(!source.naturalWidth || !source.naturalHeight)throw new Error('Изображение не содержит пикселей');
      texture=new THREE.Texture(source);texture.needsUpdate=true;aspect=source.naturalWidth/source.naturalHeight;
    } else {
      source=document.createElement('video');source.muted=true;source.playsInline=true;source.preload='auto';
      await waitFor(source,'loadeddata',()=>{source.src=url;source.load();});
      if(!Number.isFinite(source.duration)||source.duration<=0 || !source.videoWidth || !source.videoHeight) throw new Error('Не удалось определить длительность или размер видео');
      texture=new THREE.VideoTexture(source);aspect=source.videoWidth/source.videoHeight;
    }
    texture.colorSpace=THREE.SRGBColorSpace;
    let disposed=false;
    return {texture,source,aspect,kind:file.type.startsWith('video/')?'video':'image',name:file.name,
      dispose(){if(disposed)return;disposed=true;if(source instanceof HTMLVideoElement){source.pause();source.removeAttribute('src');source.load();} texture.dispose();URL.revokeObjectURL(url);}};
  } catch(error) {if(source instanceof HTMLVideoElement){source.pause();source.removeAttribute('src');source.load();}texture?.dispose();URL.revokeObjectURL(url);throw error;}
}
