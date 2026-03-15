import * as THREE from 'three';
import { RacingLine } from '../circuit/racingLine';
import type { CarConfig } from '../../types';

export class Car {
  public name: string;
  public mesh: THREE.Mesh;
  public position: number = 0; // 0-1 along the racing line
  public speed: number = 0.05; // Speed multiplier
  public isMoving: boolean = false;
  private racingLine: RacingLine | null = null;
  private material: THREE.MeshStandardMaterial;
  private onLapCompleted?: () => void;

  constructor(config: CarConfig) {
    this.name = config.name;
    this.speed = config.speed ?? 0.05;
    this.position = config.startPosition ?? 0;

    const geometry = new THREE.SphereGeometry(2, 32, 16);
    this.material = new THREE.MeshStandardMaterial({
      color: config.color,
      emissive: config.color,
      emissiveIntensity: 0.2,
      metalness: 0.3,
      roughness: 0.7,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.position.y = 2; // Position sphere above the track (radius = 2)
  }

  setRacingLine(racingLine: RacingLine): void {
    this.racingLine = racingLine;
    this.moveTo(this.position);
  }

  update(deltaTime: number): void {
    if (!this.isMoving || !this.racingLine) {
      return;
    }

    // Move along the racing line
    this.position += this.speed * deltaTime;

    // Loop back to start
    if (this.position >= 1) {
      this.position -= 1;
      this.onLapCompleted?.();
    }

    this.moveTo(this.position);
  }

  moveTo(t: number): void {
    if (!this.racingLine || !this.racingLine.isLoaded()) {
      return;
    }

    this.position = Math.max(0, Math.min(1, t));

    // Update mesh position and rotation (sphere sits on track with radius offset)
    this.racingLine.placeObjectAt(this.mesh, this.position, 2);
  }

  setColor(color: number): void {
    this.material.color.set(color);
    this.material.emissive.set(color);
  }

  start(): void {
    this.isMoving = true;
  }

  stop(): void {
    this.isMoving = false;
  }

  /**
   * Reset the car to starting position.
   */
  reset(): void {
    this.position = 0;
    this.isMoving = false;
    this.moveTo(0);
  }

  /**
   * Set callback for when a lap is completed.
   */
  setOnLapCompleted(callback: () => void): void {
    this.onLapCompleted = callback;
  }

  /**
   * Prepare car for a race with random speed variation.
   */
  prepareForRace(onFinish: (carName: string) => void): void {
    this.reset();
    this.speed = THREE.MathUtils.randFloat(0.03, 0.08);
    this.setOnLapCompleted(() => onFinish(this.name));
    this.start();
  }

  /**
   * Get the mesh to add to the scene.
   */
  getMesh(): THREE.Mesh {
    return this.mesh;
  }

  /**
   * Dispose of the car's resources.
   */
  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
