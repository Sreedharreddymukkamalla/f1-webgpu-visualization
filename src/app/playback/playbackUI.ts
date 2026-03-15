import { PlaybackController } from './playbackController';
import type { PlaybackState } from './playbackController';
import { WebSocketClient } from './websocketClient';
import type { TelemetryMetadata } from './websocketClient';
import { PlaybackProgress } from '../ui/playbackProgress/index';
import type { RaceEvent } from './websocketClient';

export class PlaybackUI {
  private container: HTMLElement;
  private controller: PlaybackController;
  private wsClient: WebSocketClient;

  private playbackProgress?: PlaybackProgress;

  private events: RaceEvent[] = [];
  private prevDrivers: Set<string> = new Set();

  constructor(container: HTMLElement, controller: PlaybackController, wsClient: WebSocketClient) {
    this.container = container;
    this.controller = controller;
    this.wsClient = wsClient;

    this.render();
    this.attachEventListeners();

    // Listen to controller state changes
    this.controller.onStateChange((state) => this.updateUI(state));

    // Listen to data for event extraction
    this.wsClient.onFrame((frame) => this.handleFrame(frame));
    this.wsClient.onMetadata((metadata) => this.handleMetadata(metadata));
  }

  private render(): void {
    this.container.innerHTML = `
      <div id="playback-dashboard-root"></div>

    `;
  }

  private attachEventListeners(): void {
    const dashboardRoot = this.container.querySelector('#playback-dashboard-root') as HTMLElement;
    
    // Initialize custom progress bar - append to main container
    this.playbackProgress = new PlaybackProgress(dashboardRoot || this.container, 
      (frame) => {
        this.controller.seekToFrame(frame);
        this.wsClient.seek(frame);
      },
      (action, value) => this.handleAction(action, value)
    );

    document.addEventListener('keydown', (e) => this.handleKeyPress(e));
  }

  private handleAction(action: string, value?: any): void {
    switch (action) {
      case 'togglePlay':
        const state = this.controller.getState();
        if (state.isPlaying) {
          this.controller.pause();
          this.wsClient.pause();
        } else {
          this.controller.play();
          this.wsClient.play();
        }
        break;
      case 'seekRelative':
        this.controller.seekRelative(value);
        this.wsClient.seek(this.controller.getState().currentFrame);
        break;
      case 'changeSpeed':
        const currentSpeed = this.controller.getState().speed;
        const newSpeed = value > 0 ? currentSpeed * 2 : currentSpeed / 2;
        const boundedSpeed = Math.max(0.1, Math.min(newSpeed, 16.0));
        this.controller.setSpeed(boundedSpeed);
        this.wsClient.setSpeed(boundedSpeed);
        break;
      case 'changeStreamingMode':

        // Handle direct (no interpolation) vs interpolated modes
        if (value.endsWith('-direct')) {
          // Direct mode: strip suffix and send base mode to server
          const baseMode = value.replace('-direct', '');
          this.wsClient.setStreamingMode(baseMode as 'replay' | 'live' | 'polling');
          // Emit event for interpolation toggle (will be handled by Visualizer)
          window.dispatchEvent(new CustomEvent('interpolation-mode-change', { 
            detail: { enabled: false, mode: baseMode } 
          }));
        } else {
          // Interpolated mode
          this.wsClient.setStreamingMode(value as 'replay' | 'live' | 'polling');
          window.dispatchEvent(new CustomEvent('interpolation-mode-change', { 
            detail: { enabled: true, mode: value } 
          }));
        }
        break;
    }
  }

  private handleKeyPress(e: KeyboardEvent): void {
    // Ignore if typing in input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const state = this.controller.getState();

    switch (e.key) {
      case ' ': // Spacebar
        e.preventDefault();
        if (state.isPlaying) {
          this.controller.pause();
          this.wsClient.pause();
        } else {
          this.controller.play();
          this.wsClient.play();
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        this.controller.seekRelative(-250);
        this.wsClient.seek(this.controller.getState().currentFrame);
        break;

      case 'ArrowRight':
        e.preventDefault();
        this.controller.seekRelative(250);
        this.wsClient.seek(this.controller.getState().currentFrame);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.controller.increaseSpeed();
        this.wsClient.setSpeed(this.controller.getState().speed);
        break;

      case 'ArrowDown':
        e.preventDefault();
        this.controller.decreaseSpeed();
        this.wsClient.setSpeed(this.controller.getState().speed);
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        this.controller.stop();
        this.wsClient.stop();
        break;

      case '1':
        this.controller.setSpeed(0.5);
        this.wsClient.setSpeed(0.5);
        break;

      case '2':
        this.controller.setSpeed(1.0);
        this.wsClient.setSpeed(1.0);
        break;

      case '3':
        this.controller.setSpeed(2.0);
        this.wsClient.setSpeed(2.0);
        break;

      case '4':
        this.controller.setSpeed(4.0);
        this.wsClient.setSpeed(4.0);
        break;
    }
  }

  private updateUI(state: PlaybackState): void {
    // Progress bar updates also handle integrated controls UI
    this.playbackProgress?.update(state);
  }

  private handleFrame(_frame: any): void {
    // No-op: relying on pre-extracted events from metadata for stability
  }

  private handleMetadata(metadata: TelemetryMetadata): void {
    this.playbackProgress?.clear();
    
    // Single source of truth: initialized with pre-extracted events (Static model)
    this.events = metadata.events || [];
    this.playbackProgress?.setRaceData(metadata.totalFrames, metadata.totalLaps, this.events);
    
    this.prevDrivers.clear();
  }

  destroy(): void {
    document.removeEventListener('keydown', (e) => this.handleKeyPress(e));
  }
}
