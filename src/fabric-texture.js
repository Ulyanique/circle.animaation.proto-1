import * as THREE from 'three';

// One decoded image and one reusable texture for all scene instances. Neither
// renderAt nor scene switches initiate an asynchronous change to the asset.
export const fabricTexture = new THREE.Texture();
fabricTexture.colorSpace = THREE.SRGBColorSpace;
fabricTexture.minFilter = THREE.LinearMipmapLinearFilter;
fabricTexture.magFilter = THREE.LinearFilter;
export const fabricState = { ready: false };
let pending;

/** Resolves false on failure or timeout; the shader then uses its procedural fallback. */
export function loadFabricTexture() {
  if (pending) return pending;
  pending = new Promise(resolve => {
    if (typeof Image === 'undefined') { resolve(false); return; }
    const image = new Image();
    let settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (ok) {
        fabricTexture.image = image;
        fabricTexture.needsUpdate = true;
        fabricState.ready = true;
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), 8000);
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = new URL('./assets/graphite-stone.jpg', import.meta.url).href;
  });
  return pending;
}
