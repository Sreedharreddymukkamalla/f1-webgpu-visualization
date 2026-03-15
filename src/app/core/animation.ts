import type { WebGPURenderer } from 'three/webgpu';
import type { Scene } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { UpdateCallback } from '../../types';

export type { UpdateCallback };

export function startAnimationLoop(renderer: WebGPURenderer, scene: Scene, camera: PerspectiveCamera, controls: OrbitControls, onUpdate?: UpdateCallback): void {
  let previousTime = 0;

  function animate(time: number) {
    requestAnimationFrame(animate);

    // Calculate delta time in seconds
    const deltaTime = (time - previousTime) / 1000;
    previousTime = time;

    controls.update();

    // Call update callback if provided
    if (onUpdate) {
      onUpdate(deltaTime);
    }

    renderer.render(scene, camera);
  }

  animate(0);
}
