import { WebGPURenderer } from 'three/webgpu';
import * as THREE from 'three';

export function createRenderer() {
  const renderer = new WebGPURenderer({
    antialias: true,
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(new THREE.Color(0x000000), 1);

  const app = document.getElementById('app');
  if (app) {
    app.appendChild(renderer.domElement);
  } else {
    document.body.appendChild(renderer.domElement);
  }

  return renderer;
}

export function setupRendererResize(renderer: WebGPURenderer): void {
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
  });
}
