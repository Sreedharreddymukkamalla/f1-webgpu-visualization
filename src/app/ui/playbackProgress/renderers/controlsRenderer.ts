/**
 * Render the playback controls pill
 */
export function renderControls(): string {
  return `
    <div class="integrated-controls">
      <div class="controls-pill">
        <button id="int-rewind" class="int-ctrl-btn" title="Rewind 10s">
          <img src="/images/controls/rewind.png" width="20" height="20">
        </button>
        <button id="int-play-pause" class="int-ctrl-btn main-play" title="Play/Pause">
          <img id="int-play-icon" src="/images/controls/play.png" width="24" height="24">
          <img id="int-pause-icon" src="/images/controls/pause.png" width="24" height="24" style="display:none;">
        </button>
        <button id="int-forward" class="int-ctrl-btn" title="Forward 10s">
          <img src="/images/controls/forward.png" width="20" height="20">
        </button>
        <div class="int-speed-group">
          <button id="int-speed-down" class="int-ctrl-btn small">
            <img src="/images/controls/minus.png" width="12" height="12">
          </button>
          <span id="int-speed-display" class="int-speed-text">1.0x</span>
          <button id="int-speed-up" class="int-ctrl-btn small">
            <img src="/images/controls/plus.png" width="12" height="12">
          </button>
        </div>
        <div class="int-divider"></div>
        <div class="int-mode-group">
          <select id="int-streaming-mode" class="int-mode-select" title="Streaming Mode">
            <optgroup label="With Interpolation">
              <option value="replay">Replay (25 FPS)</option>
              <option value="live">Live Sim (270ms)</option>
              <option value="polling">Polling (500ms)</option>
            </optgroup>
            <optgroup label="Direct (No Smoothing)">
              <option value="live-direct">Live Direct (270ms)</option>
              <option value="polling-direct">Polling Direct (500ms)</option>
            </optgroup>
          </select>
        </div>
        <div id="int-time-display" class="int-time-display">00:00 / 00:00</div>
      </div>
    </div>
  `;
}

/**
 * Render the progress bar
 */
export function renderProgressBar(): string {
  return `
    <div class="playback-progress-bar">
      <div class="playback-progress-fill"></div>
    </div>
    <div class="markers-container"></div>
    <div class="playhead"></div>
    <div class="playback-tooltip"></div>
  `;
}

/**
 * Update play/pause button icons
 */
export function updatePlayPauseIcon(container: HTMLElement, isPlaying: boolean): void {
  const playIcon = container.querySelector('#int-play-icon') as HTMLImageElement;
  const pauseIcon = container.querySelector('#int-pause-icon') as HTMLImageElement;
  
  if (playIcon && pauseIcon) {
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'inline';
    } else {
      playIcon.style.display = 'inline';
      pauseIcon.style.display = 'none';
    }
  }
}

/**
 * Update speed display
 */
export function updateSpeedDisplay(element: HTMLElement | null, speed: number): void {
  if (element) {
    element.textContent = `${speed.toFixed(1)}x`;
  }
}

/**
 * Update time display
 */
export function updateTimeDisplay(element: HTMLElement | null, currentFrame: number, totalFrames: number): void {
  if (!element) return;
  
  const currentTime = Math.floor(currentFrame / 25);
  const totalTime = Math.floor(totalFrames / 25);
  element.textContent = `${formatTime(currentTime)} / ${formatTime(totalTime)}`;
}

/**
 * Format seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
