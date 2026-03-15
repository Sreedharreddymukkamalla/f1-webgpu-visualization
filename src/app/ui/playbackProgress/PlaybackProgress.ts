import type { PlaybackState, RaceEvent } from './types';
import { renderControls, renderProgressBar, updatePlayPauseIcon, updateSpeedDisplay, updateTimeDisplay } from './renderers/controlsRenderer';
import { drawMarkers, getEventTooltipText } from './renderers/markersRenderer';

/**
 * PlaybackProgress component handles the playback timeline UI including:
 * - Progress bar with seek functionality
 * - Playback controls (play/pause, speed, skip)
 * - Event markers (DNF, flags, safety car)
 * - Lap markers
 */
export class PlaybackProgress {
  private container: HTMLElement;
  private onSeek: (frame: number) => void;
  private onAction: (action: string, value?: any) => void;
  
  // DOM elements
  private progressFill!: HTMLElement;
  private playhead!: HTMLElement;
  private markersContainer!: HTMLElement;
  private tooltip!: HTMLElement;
  private speedDisplay!: HTMLElement;
  private timeDisplay!: HTMLElement;
  private streamingModeSelect!: HTMLSelectElement;
  
  // State
  private totalFrames: number = 0;
  private totalLaps: number = 0;
  private events: RaceEvent[] = [];
  private isDragging: boolean = false;
  private isHoveringMarker: boolean = false;

  constructor(
    parent: HTMLElement, 
    onSeek: (frame: number) => void, 
    onAction: (action: string, value?: any) => void
  ) {
    this.container = document.createElement('div');
    this.container.className = 'playback-progress-container';
    this.onSeek = onSeek;
    this.onAction = onAction;
    
    this.render();
    parent.appendChild(this.container);
    this.cacheElements();
    this.attachEvents();
    this.initializeControls();
  }
  
  private render(): void {
    this.container.innerHTML = `
      ${renderControls()}
      ${renderProgressBar()}
    `;
  }

  private cacheElements(): void {
    this.progressFill = this.container.querySelector('.playback-progress-fill') as HTMLElement;
    this.playhead = this.container.querySelector('.playhead') as HTMLElement;
    this.markersContainer = this.container.querySelector('.markers-container') as HTMLElement;
    this.tooltip = this.container.querySelector('.playback-tooltip') as HTMLElement;
    this.speedDisplay = this.container.querySelector('#int-speed-display') as HTMLElement;
    this.timeDisplay = this.container.querySelector('#int-time-display') as HTMLElement;
    this.streamingModeSelect = this.container.querySelector('#int-streaming-mode') as HTMLSelectElement;
    
    // Initialize play icon state
    updatePlayPauseIcon(this.container, false);
  }
  
  private attachEvents(): void {
    // Drag to seek
    this.container.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).closest('.controls-pill')) return;
      
      this.isDragging = true;
      this.handleSeek(e);
      this.container.classList.add('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) {
        if (this.isHoveringMarker) return;
        this.handleHoverTooltip(e);
        return;
      }
      this.handleSeek(e);
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.container.classList.remove('dragging');
      }
    });

    // Hover tooltip
    this.container.addEventListener('mousemove', (e) => {
      if (this.isDragging || this.isHoveringMarker) return;
      this.handleHoverTooltip(e);
    });
  }

  private handleSeek(e: MouseEvent): void {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    const frame = Math.floor(progress * this.totalFrames);
    
    this.onSeek(frame);
    this.updateTooltip(x, frame);
  }

  private handleHoverTooltip(e: MouseEvent): void {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    
    if (progress >= 0 && progress <= 1) {
      const frame = Math.floor(progress * this.totalFrames);
      this.updateTooltip(x, frame);
    } else {
      this.tooltip.style.display = 'none';
    }
  }
  
  private updateTooltip(x: number, frame: number): void {
    const tooltipText = getEventTooltipText(this.events, frame, this.totalFrames);
    
    if (tooltipText) {
      this.tooltip.textContent = tooltipText;
      this.tooltip.style.left = `${x}px`;
      this.tooltip.style.display = 'block';
    } else {
      this.tooltip.style.display = 'none';
    }
  }

  private initializeControls(): void {
    const playPauseBtn = this.container.querySelector('#int-play-pause') as HTMLButtonElement;
    const rewindBtn = this.container.querySelector('#int-rewind') as HTMLButtonElement;
    const forwardBtn = this.container.querySelector('#int-forward') as HTMLButtonElement;
    const speedDecreaseBtn = this.container.querySelector('#int-speed-down') as HTMLButtonElement;
    const speedIncreaseBtn = this.container.querySelector('#int-speed-up') as HTMLButtonElement;

    playPauseBtn.onclick = () => this.onAction('togglePlay');
    rewindBtn.onclick = () => this.onAction('seekRelative', -250);
    forwardBtn.onclick = () => this.onAction('seekRelative', 250);
    speedDecreaseBtn.onclick = () => this.onAction('changeSpeed', -1);
    speedIncreaseBtn.onclick = () => this.onAction('changeSpeed', 1);
    this.streamingModeSelect.onchange = () => this.onAction('changeStreamingMode', this.streamingModeSelect.value);
  }

  /**
   * Set race data for the progress bar
   */
  public setRaceData(totalFrames: number, totalLaps: number, events: RaceEvent[] = []): void {
    this.totalFrames = totalFrames;
    this.totalLaps = totalLaps;
    this.events = events;
    
    requestAnimationFrame(() => this.redrawMarkers());
  }
  
  /**
   * Set events without changing other race data
   */
  public setEvents(events: RaceEvent[]): void {
    this.events = events;
    this.redrawMarkers();
  }

  /**
   * Add a single event
   */
  public addEvent(event: RaceEvent): void {
    this.events.push(event);
    this.redrawMarkers();
  }
  
  /**
   * Update the progress bar from playback state
   */
  public update(state: PlaybackState): void {
    if (this.totalFrames <= 0 && state.totalFrames > 0) {
      this.totalFrames = state.totalFrames;
      this.redrawMarkers();
    }
    if (this.totalFrames <= 0) return;
    
    const progress = (state.currentFrame / this.totalFrames) * 100;
    this.progressFill.style.width = `${progress}%`;
    this.playhead.style.left = `${progress}%`;

    updatePlayPauseIcon(this.container, state.isPlaying);
    updateSpeedDisplay(this.speedDisplay, state.speed);
    updateTimeDisplay(this.timeDisplay, state.currentFrame, this.totalFrames);
  }

  private redrawMarkers(): void {
    drawMarkers(
      this.markersContainer,
      this.events,
      this.totalFrames,
      this.totalLaps,
      (text, x) => {
        this.isHoveringMarker = true;
        this.tooltip.textContent = text;
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.display = 'block';
      },
      () => {
        this.isHoveringMarker = false;
        this.tooltip.style.display = 'none';
      }
    );
  }

  /**
   * Toggle visibility of the progress bar
   */
  public toggleVisibility(): void {
    const isVisible = this.container.style.display !== 'none';
    this.container.style.display = isVisible ? 'none' : 'block';
  }

  /**
   * Clear all events
   */
  public clear(): void {
    this.events = [];
    this.redrawMarkers();
  }
}
