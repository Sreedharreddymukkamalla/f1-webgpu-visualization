import * as THREE from 'three';
import { Car } from './car';
import { RacingLine } from '../circuit/racingLine';
import GUI from 'lil-gui';

export class CarManager {
  private scene: THREE.Scene;
  private cars: Car[] = [];
  private racingLine: RacingLine | null = null;
  private gui: GUI | null = null; // Optional GUI
  private carFolders: Map<string, GUI> = new Map();
  private sceneFolderRef: GUI | null = null;

  constructor(scene: THREE.Scene, gui?: GUI) {
    this.scene = scene;
    this.gui = gui || null;
    this.createDefaultCars();
  }

  private createDefaultCars(): void {
    // Team colors
    const teamColors = [
      0xe10600, // Red Bull Racing
      0x00a19c, // Mercedes
      0xdc0000, // Ferrari
      0xff8000, // McLaren
      0x006f62, // Aston Martin
      0x0090ff, // Alpine
      0x2b4562, // Williams
      0xb6babd, // Alpha Tauri
      0x900000, // Alfa Romeo
      0x005aff, // Haas
      0x00d2be, // Petronas (Mercedes)
      0xff1801, // Honda (Red Bull)
      0xfff500, // Renault
      0xed1c24, // Shell (Ferrari)
      0xfdb913, // DHL
      0x1e41ff, // Visa
      0xff6600, // Gulf
      0x00e0ff, // Cyan
      0xff00ff, // Magenta
      0x00ff00, // Green
    ];

    for (let i = 0; i < 20; i++) {
      const car = new Car({
        name: `Car ${i + 1}`,
        color: teamColors[i],
        speed: 0.05,
        startPosition: i / 20,
      });
      this.cars.push(car);
      this.scene.add(car.getMesh());
    }
  }

  async loadRacingLine(circuitName: string, rotation?: number): Promise<void> {
    if (this.racingLine) {
      this.cars.forEach((car) => car.stop());
    }

    this.racingLine = new RacingLine();
    await this.racingLine.load(circuitName, rotation);

    this.cars.forEach((car) => {
      car.setRacingLine(this.racingLine!);
      car.moveTo(0);
    });

    // Create UI for cars
    this.createUI();


  }

  /**
   * Create UI controls for cars.
   */
  private createUI(): void {
    // Skip if no GUI available
    if (!this.gui) return;

    // Remove existing car folders
    this.carFolders.forEach((folder) => folder.destroy());
    this.carFolders.clear();
    if (this.sceneFolderRef) {
      this.sceneFolderRef.destroy();
    }

    // Create folder for each car
    this.cars.forEach((car) => {
      const folder = this.gui!.addFolder(car.name);
      this.carFolders.set(car.name, folder);

      // Move checkbox
      folder
        .add({ move: car.isMoving }, 'move')
        .name('Move')
        .onChange((value: boolean) => {
          if (value) {
            car.start();
          } else {
            car.stop();
          }
        });

      // Color picker
      const material = car.mesh.material as THREE.MeshStandardMaterial;
      folder
        .addColor({ color: material.color.getHex() }, 'color')
        .name('Color')
        .onChange((value: number) => {
          car.setColor(value);
        });

      // Position slider
      folder
        .add(car, 'position', 0, 1, 0.001)
        .name('Position')
        .listen()
        .onChange((value: number) => {
          car.moveTo(value);
        });

      folder.close();
    });

    // Scene controls
    const sceneFolder = this.gui!.addFolder('Scene');
    this.sceneFolderRef = sceneFolder;

    // Race button
    sceneFolder.add({ race: () => this.startRace() }, 'race').name('Start Race 🏁');

    // Debug racing line toggle
    let debugLine: THREE.Line | null = null;
    sceneFolder
      .add({ debug: false }, 'debug')
      .name('Show Racing Line')
      .onChange((value: boolean) => {
        if (value && this.racingLine) {
          debugLine = this.racingLine.createDebugLine(0x00ff00, 2);
          this.scene.add(debugLine);
        } else if (debugLine) {
          this.scene.remove(debugLine);
          debugLine.geometry.dispose();
          (debugLine.material as THREE.Material).dispose();
          debugLine = null;
        }
      });

    sceneFolder.open();
  }

  /**
   * Start a race between all cars.
   */
  private startRace(): void {
    let finished = 0;
    const totalCars = this.cars.length;

    const onFinish = (carName: string) => {
      finished++;


      if (finished === totalCars) {

        // Re-enable controls after race
        setTimeout(() => {
          this.cars.forEach((car) => {
            car.stop();
            const folder = this.carFolders.get(car.name);
            if (folder) {
              folder.controllersRecursive().forEach((c) => c.enable());
            }
          });
        }, 1000);
      }
    };

    // Disable manual controls during race
    this.carFolders.forEach((folder) => {
      folder.controllersRecursive().forEach((c) => c.disable());
    });

    // Start race for each car
    this.cars.forEach((car) => {
      car.prepareForRace(onFinish);
    });
  }

  /**
   * Update all cars.
   */
  update(deltaTime: number): void {
    this.cars.forEach((car) => car.update(deltaTime));
  }

  /**
   * Add a new car.
   */
  addCar(config: { name: string; color: number; speed?: number }): Car {
    const car = new Car(config);

    if (this.racingLine) {
      car.setRacingLine(this.racingLine);
    }

    this.cars.push(car);
    this.scene.add(car.getMesh());

    // Recreate UI to include new car
    if (this.racingLine) {
      this.createUI();
    }

    return car;
  }

  /**
   * Remove a car.
   */
  removeCar(car: Car): void {
    const index = this.cars.indexOf(car);
    if (index !== -1) {
      this.cars.splice(index, 1);
      this.scene.remove(car.getMesh());
      car.dispose();

      // Recreate UI
      if (this.racingLine) {
        this.createUI();
      }
    }
  }

  /**
   * Get all cars.
   */
  getCars(): Car[] {
    return this.cars;
  }

  /**
   * Dispose of all resources.
   */
  dispose(): void {
    this.cars.forEach((car) => {
      this.scene.remove(car.getMesh());
      car.dispose();
    });
    this.cars = [];
    this.carFolders.forEach((folder) => folder.destroy());
    this.carFolders.clear();
    if (this.sceneFolderRef) {
      this.sceneFolderRef.destroy();
    }
  }
}
