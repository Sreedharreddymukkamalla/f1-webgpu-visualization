import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TrackRenderer, type TrackData } from './trackRenderer.js';

export class CircuitManager {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private trackRenderer: TrackRenderer;
  private currentTrack: THREE.Group | null = null;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, controls: OrbitControls) {
    this.camera = camera;
    this.controls = controls;
    this.trackRenderer = new TrackRenderer(scene);
  }

  async loadTrackFromTelemetry(trackData: TrackData): Promise<void> {
    try {
      if (!trackData) {
        console.warn('No track data provided for rendering.');
        return;
      }

      await this.trackRenderer.loadTrack(trackData);
      this.adjustCameraToTrack(trackData.bounds);
      this.currentTrack = this.trackRenderer.getBounds() ? new THREE.Group() : null;
    } catch (error) {
      console.error('Error loading track from telemetry:', error);
      throw error;
    }
  }

  private adjustCameraToTrack(bounds: { x_min: number; x_max: number; y_min: number; y_max: number }): void {
    if (!bounds) return;

    const { x_min, x_max, y_min, y_max } = bounds;
    const centerX = (x_min + x_max) / 2;
    const centerZ = (y_min + y_max) / 2;
    const sizeX = x_max - x_min;
    const sizeZ = y_max - y_min;

    console.log(`📐 Track bounds: X[${x_min.toFixed(0)}, ${x_max.toFixed(0)}] Y[${y_min.toFixed(0)}, ${y_max.toFixed(0)}]`);

    const diagonal = Math.sqrt(sizeX * sizeX + sizeZ * sizeZ);
    const fov = this.camera.fov * (Math.PI / 180);
    let cameraHeight = Math.abs(diagonal / (2 * Math.tan(fov / 2)));
    cameraHeight *= 1.8;

    this.camera.position.set(centerX, cameraHeight, centerZ);
    this.camera.lookAt(centerX, 0, centerZ);
    this.controls.target.set(centerX, 0, centerZ);
    this.controls.update();

    console.log(`✅ Camera positioned at (${centerX.toFixed(0)}, ${cameraHeight.toFixed(0)}, ${centerZ.toFixed(0)})`);
  }

  getCurrentTrack(): THREE.Group | null {
    return this.currentTrack;
  }
}