import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createCamera(): THREE.PerspectiveCamera {
  // Create camera with balanced near/far ratio to prevent z-fighting
  // Near plane of 10 with far of 100000 gives ratio of 10000:1 (much better than 0.1/50000)
  const camera = new THREE.PerspectiveCamera(
    60, // FOV
    window.innerWidth / window.innerHeight, // Aspect ratio
    10, // Near plane (increased to improve depth precision)
    100000 // Far plane (100km to be safe)
  );
  return camera;
}

export function createControls(camera: THREE.PerspectiveCamera, domElement: HTMLElement): OrbitControls {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  return controls;
}

export function positionCameraForCircuit(camera: THREE.PerspectiveCamera, controls: OrbitControls, maxDimension: number): void {
  const cameraDistance = maxDimension * 2;
  camera.position.set(0, cameraDistance, 0);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
}

export function setupCameraResize(camera: THREE.PerspectiveCamera): void {
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });
}
