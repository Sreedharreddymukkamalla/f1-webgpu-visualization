import * as THREE from 'three';

export function addLights(scene: THREE.Scene): void {
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
  hemisphereLight.position.set(0, 200, 0);
  scene.add(hemisphereLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(100, 200, 100);
  scene.add(directionalLight);

  const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight2.position.set(-100, 150, -100);
  scene.add(directionalLight2);
}

