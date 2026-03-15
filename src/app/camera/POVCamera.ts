import * as THREE from 'three';

/**
 * POV Camera - First-person view from driver's perspective
 * Attaches to a car's camera_mount point and follows the car's movement
 */
export class POVCamera {
  private camera: THREE.PerspectiveCamera;
  private targetCar: THREE.Object3D | null = null;
  private cameraMount: THREE.Object3D | null = null;
  private isActive: boolean = false;
  private originalNear: number = 10;
  
  // Fallback offset if no camera_mount found (cockpit height)
  private defaultOffset = new THREE.Vector3(0, 15, 0);
  
  // For smooth heading interpolation
  private lastPosition = new THREE.Vector3();
  private currentHeading = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
    this.originalNear = camera.near;
  }

  /**
   * Set the target car to follow
   * @param car The car Object3D
   * @param cameraMount Optional camera mount point from the model
   */
  setTarget(car: THREE.Object3D, cameraMount?: THREE.Object3D): void {
    this.targetCar = car;
    this.cameraMount = cameraMount || null;
    this.lastPosition.copy(car.position);
    this.currentHeading = car.rotation.y;
  }

  /**
   * Activate POV mode
   */
  activate(): void {
    if (!this.targetCar) return;
    this.isActive = true;
    this.lastPosition.copy(this.targetCar.position);

    // Reduce near plane to prevent clipping car cockpit geometry
    this.originalNear = this.camera.near;
    this.camera.near = 1.0; 
    this.camera.updateProjectionMatrix();
  }

  /**
   * Deactivate POV mode
   */
  deactivate(): void {
    this.isActive = false;
    this.targetCar = null;
    this.cameraMount = null;

    // Restore original near plane
    this.camera.near = this.originalNear;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Check if POV mode is active
   */
  getIsActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the current target driver code
   */
  getTargetCar(): THREE.Object3D | null {
    return this.targetCar;
  }

  /**
   * Update camera position - call this every frame
   */
  update(): void {
    if (!this.isActive || !this.targetCar) return;

    // Calculate heading from movement direction
    const dx = this.targetCar.position.x - this.lastPosition.x;
    const dz = this.targetCar.position.z - this.lastPosition.z;
    
    if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
      const targetHeading = Math.atan2(dx, dz);
      
      // Smooth heading interpolation
      let headingDiff = targetHeading - this.currentHeading;
      while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
      while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
      
      this.currentHeading += headingDiff * 0.15;
    }
    
    this.lastPosition.copy(this.targetCar.position);

    // Get camera position
    let cameraPos = new THREE.Vector3();
    
    if (this.cameraMount) {
      // Use camera mount from model
      this.cameraMount.getWorldPosition(cameraPos);
    } else {
      // Fallback: position above car
      cameraPos.copy(this.targetCar.position).add(this.defaultOffset);
    }
    
    this.camera.position.copy(cameraPos);
    
    // Look in the direction of travel
    const lookAtDistance = 500;
    const lookAt = new THREE.Vector3(
      cameraPos.x + Math.sin(this.currentHeading) * lookAtDistance,
      cameraPos.y - 5, // Slight downward tilt
      cameraPos.z + Math.cos(this.currentHeading) * lookAtDistance
    );
    
    this.camera.lookAt(lookAt);
  }
}
