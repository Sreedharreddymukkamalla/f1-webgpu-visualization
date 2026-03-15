import { checkWebGPUSupport } from '../../utils/webgpuCheck.js';
import { createRenderer, createScene, createCamera, createControls, setupCameraResize, addLights, startAnimationLoop } from './index';
import { CircuitManager } from '../circuit';
import { Leaderboard } from '../ui/leaderboard/index.js';
import { WeatherWidget } from '../ui/WeatherWidget.js';
import { POVOverlay } from '../ui/POVOverlay.js';
import { WebSocketClient, PlaybackController, PlaybackUI, CarRenderer } from '../playback';
import { POVCamera } from '../camera/POVCamera';
import { setDriverTeams } from '../ui/TeamMapping.js';
import { getRenderSettingsInstance } from '../ui/RenderSettings.js';
import { LoadingOverlay } from './LoadingOverlay';
import { Inspector } from 'three/examples/jsm/inspector/Inspector.js';
import type { TrackData } from '../circuit/trackRenderer.js';
import type { TelemetryMetadata, TelemetryFrame } from '../playback';

/**
 * Main Visualizer class that orchestrates the 3D F1 visualization.
 * Handles initialization of all components and manages their interactions.
 */
export class Visualizer {
  private loadingOverlay: LoadingOverlay;
  private uiContainer: HTMLElement;
  
  // Core 3D components
  private renderer: any;
  private scene: any;
  private camera: any;
  private controls: any;
  
  // F1 components
  private circuitManager!: CircuitManager;
  private carRenderer!: CarRenderer;
  private povCamera!: POVCamera;
  
  // UI components
  private leaderboard!: Leaderboard;
  private weatherWidget!: WeatherWidget;
  private povOverlay!: POVOverlay;
  private playbackController!: PlaybackController;
  
  // WebSocket
  private wsClient!: WebSocketClient;
  
  // State
  private carsReady: boolean = false;
  private pendingFrame: TelemetryFrame | null = null;
  private currentMetadata: TelemetryMetadata | null = null;

  constructor() {
    this.loadingOverlay = new LoadingOverlay();
    this.uiContainer = document.getElementById('app') || document.body;
  }

  /**
   * Initialize the visualization with track data
   */
  async init(trackData: TrackData): Promise<void> {
    // Show loading overlay
    this.loadingOverlay.show();
    
    // Check WebGPU support
    checkWebGPUSupport();

    // Initialize 3D engine
    this.loadingOverlay.setText('Initializing 3D engine...');
    await this.init3DEngine();

    // Load track
    this.loadingOverlay.setText('Loading track...');
    await this.initCircuit(trackData);

    // Initialize WebSocket and playback
    this.loadingOverlay.setText('Connecting to server...');
    await this.initPlayback();

    // Initialize UI components
    this.initUI(trackData);

    // Setup event handlers
    this.setupEventHandlers();

    // Connect WebSocket
    await this.connectWebSocket();

    // Start animation loop
    this.startAnimation();
  }

  private async init3DEngine(): Promise<void> {
    this.renderer = createRenderer();
    
    // Three.js Inspector for WebGPU performance monitoring
    const inspector = new Inspector();
    (this.renderer as any).inspector = inspector;
    
    await this.renderer.init();
    
    this.scene = createScene();
    this.camera = createCamera();
    this.controls = createControls(this.camera, this.renderer.domElement);
    setupCameraResize(this.camera);

    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    addLights(this.scene);
  }

  private async initCircuit(trackData: TrackData): Promise<void> {
    this.circuitManager = new CircuitManager(this.scene, this.camera, this.controls);
    if (trackData) {
      await this.circuitManager.loadTrackFromTelemetry(trackData);
    }
  }

  private async initPlayback(): Promise<void> {
    this.wsClient = new WebSocketClient(import.meta.env.VITE_WS_URL || 'ws://localhost:3001');
    
    // Make wsClient globally accessible for DataFetcher logging
    (window as any).wsClient = this.wsClient;
    
    this.playbackController = new PlaybackController();
    this.carRenderer = new CarRenderer(this.scene);
    this.povCamera = new POVCamera(this.camera);

    // Reset interpolation when seeking to prevent cars from flying
    this.playbackController.onSeek(() => {
      this.carRenderer.resetInterpolation();
    });
  }

  private initUI(trackData: TrackData): void {
    // POV overlay
    const uiOverlayContainer = document.createElement('div');
    this.uiContainer.appendChild(uiOverlayContainer);
    this.povOverlay = new POVOverlay(uiOverlayContainer);

    // Playback controls
    const playbackContainer = document.createElement('div');
    this.uiContainer.appendChild(playbackContainer);
    new PlaybackUI(playbackContainer, this.playbackController, this.wsClient);

    // Leaderboard
    const leaderboardContainer = document.createElement('div');
    this.uiContainer.appendChild(leaderboardContainer);
    this.leaderboard = new Leaderboard(leaderboardContainer);

    if (trackData && trackData.centerline) {
      this.leaderboard.setTrackCenterline(trackData.centerline);
    }

    // Weather widget
    const weatherContainer = document.createElement('div');
    this.uiContainer.appendChild(weatherContainer);
    this.weatherWidget = new WeatherWidget(weatherContainer);
  }

  private setupEventHandlers(): void {
    // Render settings changes
    const renderSettings = getRenderSettingsInstance();
    if (renderSettings) {
      renderSettings.onSettingsChange(async (settings) => {
        if (this.currentMetadata && this.carsReady) {
          console.log('🔄 Render settings changed, reloading cars...');
          this.carRenderer.setCarRenderMode(settings.carRenderMode);
          await this.carRenderer.initializeCars(this.currentMetadata);
        }
      });
    }

    // Metadata handler
    this.wsClient.onMetadata(async (metadata) => {
      await this.handleMetadata(metadata, renderSettings);
    });

    // Frame handler
    this.wsClient.onFrame((frame) => {
      this.handleFrame(frame);
    });

    // Connection handlers
    this.wsClient.onConnected(() => {
      console.log('✅ WebSocket connected - ready for playback');
    });

    this.wsClient.onDisconnected(() => {
      console.warn('⚠️ WebSocket disconnected');
    });

    // Leaderboard driver selection for POV
    this.leaderboard.onDriverSelect((code) => {
      this.switchToPOV(code);
    });

    // ESC to exit POV
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.povCamera.getIsActive()) {
        this.exitPOV();
      }
    });

    // Streaming mode changes - update interpolation interval
    this.wsClient.onModeChange((_mode, config) => {
      if (config?.interval) {
        console.log(`📡 Updating interpolation interval to ${config.interval}ms`);
        this.carRenderer.setUpdateInterval(config.interval);
      }
    });

    // Interpolation toggle from dropdown (for comparing with/without smoothing)
    window.addEventListener('interpolation-mode-change', ((event: CustomEvent) => {
      const { enabled } = event.detail;
      console.log(`🔀 Interpolation mode: ${enabled ? 'enabled' : 'disabled'}`);
      this.carRenderer.setInterpolationEnabled(enabled);
    }) as EventListener);
  }

  private async handleMetadata(metadata: TelemetryMetadata, renderSettings: any): Promise<void> {
    console.log('📊 Received metadata:', metadata);
    this.currentMetadata = metadata;
    
    this.loadingOverlay.setText('Loading 3D car models...');
    this.playbackController.setTotalFrames(metadata.totalFrames);
    
    // Apply current render settings before loading cars
    const currentSettings = renderSettings?.getSettings();
    if (currentSettings) {
      this.carRenderer.setCarRenderMode(currentSettings.carRenderMode);
    }
    
    await this.carRenderer.initializeCars(metadata);
    this.leaderboard.setDriverColors(metadata.driverColors);
    this.leaderboard.setTotalLaps(metadata.totalLaps || 0);
    
    // Set dynamic driver-to-team mapping
    if (metadata.driverTeams) {
      setDriverTeams(metadata.driverTeams);
      this.leaderboard.resetEntries();
    }

    // Handle qualifying mode
    if ((metadata.sessionType === 'Q' || metadata.sessionType === 'SQ') && metadata.qualifying) {
      const isSprint = metadata.sessionType === 'SQ';
      console.log(`🏁 ${isSprint ? 'Sprint ' : ''}Qualifying session detected - enabling qualifying mode`);
      this.leaderboard.setQualifyingData(metadata.qualifying, isSprint);
    } else {
      this.leaderboard.setSessionMode('race');
    }

    // Cars are now ready
    this.carsReady = true;
    if (this.pendingFrame) {
      console.log('📍 Applying pending first frame to position cars');
      this.carRenderer.updatePositions(this.pendingFrame);
      this.leaderboard.updateFromFrame(this.pendingFrame);
      this.weatherWidget.updateFromFrame(this.pendingFrame);
      this.pendingFrame = null;
    }

    // Hide loading overlay
    this.loadingOverlay.hide();
  }

  private handleFrame(frame: TelemetryFrame): void {
    if (!this.carsReady) {
      this.pendingFrame = frame;
      return;
    }
    
    this.carRenderer.updatePositions(frame);
    this.leaderboard.updateFromFrame(frame);
    this.weatherWidget.updateFromFrame(frame);
    
    // Hide out drivers' cars
    const outDrivers = this.leaderboard.getOutDrivers();
    if (outDrivers.size > 0) {
      this.carRenderer.setEliminatedDrivers(outDrivers);
    } else {
      this.carRenderer.showAllCars();
    }
    
    if (this.povCamera.getIsActive()) {
      this.povOverlay.update(frame);
    }

    const frameNumber = frame.frameNumber ?? Math.floor(frame.t * 25);
    this.playbackController.updateFrame(frameNumber);
  }

  private switchToPOV(code: string): void {
    const car = this.carRenderer.getCar(code);
    const mount = this.carRenderer.getCameraMount(code);
    if (car) {
      console.log(`🎥 Switching to POV view for: ${code}`);
      this.povCamera.setTarget(car, mount);
      this.povCamera.activate();
      this.povOverlay.show(code);
      this.leaderboard.setSelectedDriver(code);
      this.controls.enabled = false;
    }
  }

  private exitPOV(): void {
    console.log('🎥 Exiting POV view');
    this.povCamera.deactivate();
    this.povOverlay.hide();
    this.leaderboard.setSelectedDriver(null);
    this.controls.enabled = true;
  }

  private async connectWebSocket(): Promise<void> {
    try {
      await this.wsClient.connect();
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      alert('Failed to connect to streaming server. Make sure the Node.js server is running on port 3001.');
    }
  }

  private startAnimation(): void {
    startAnimationLoop(this.renderer, this.scene, this.camera, this.controls, (deltaTime: number) => {
      // Update car interpolation every frame
      this.carRenderer.update(deltaTime);

      if (this.povCamera.getIsActive()) {
        this.povCamera.update();
      }
    });
  }
}
