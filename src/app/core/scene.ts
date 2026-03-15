import * as THREE from 'three';

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);
  return scene;
}

export function addGridHelper(scene: THREE.Scene, size: number = 1000, divisions: number = 20): void {
  const gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
  scene.add(gridHelper);
}

