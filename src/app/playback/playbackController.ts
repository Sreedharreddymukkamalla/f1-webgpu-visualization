export class PlaybackController {
  private isPlaying: boolean = false;
  private speed: number = 1.0;
  private currentFrame: number = 0;
  private totalFrames: number = 0;

  private onStateChangeCallback?: (state: PlaybackState) => void;
  private onSeekCallback?: () => void;

  getState(): PlaybackState {
    return {
      isPlaying: this.isPlaying,
      speed: this.speed,
      currentFrame: this.currentFrame,
      totalFrames: this.totalFrames,
    };
  }

  setTotalFrames(total: number): void {
    this.totalFrames = total;
    this.notifyStateChange();
  }

  updateFrame(frameNumber: number): void {
    this.currentFrame = frameNumber;
    this.notifyStateChange();
  }

  play(): void {
    this.isPlaying = true;
    this.notifyStateChange();
  }

  pause(): void {
    this.isPlaying = false;
    this.notifyStateChange();
  }

  togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    this.notifyStateChange();
  }

  stop(): void {
    this.isPlaying = false;
    this.currentFrame = 0;
    this.notifyStateChange();
  }

  seekToFrame(frameNumber: number): void {
    this.currentFrame = Math.max(0, Math.min(frameNumber, this.totalFrames - 1));
    this.onSeekCallback?.();
    this.notifyStateChange();
  }

  seekRelative(frameDelta: number): void {
    this.seekToFrame(this.currentFrame + frameDelta);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(speed, 16.0));
    this.notifyStateChange();
  }

  increaseSpeed(): void {
    this.setSpeed(this.speed * 2);
  }

  decreaseSpeed(): void {
    this.setSpeed(this.speed * 0.5);
  }

  getProgress(): number {
    return this.totalFrames > 0 ? this.currentFrame / this.totalFrames : 0;
  }

  onStateChange(callback: (state: PlaybackState) => void): void {
    this.onStateChangeCallback = callback;
  }

  onSeek(callback: () => void): void {
    this.onSeekCallback = callback;
  }

  private notifyStateChange(): void {
    this.onStateChangeCallback?.(this.getState());
  }
}

export interface PlaybackState {
  isPlaying: boolean;
  speed: number;
  currentFrame: number;
  totalFrames: number;
}
