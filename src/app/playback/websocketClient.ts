export interface TelemetryFrame {
  t: number;
  lap: number;
  frameNumber?: number;
  track_status?: string;  // "1"=Clear, "2"=Yellow, "4"=SC, "5"=Red, "6"/"7"=VSC
  weather?: {
    track_temp: number | null;
    air_temp: number | null;
    humidity: number | null;
    wind_speed: number | null;
    wind_direction: number | null;
    rain_state: 'DRY' | 'RAINING';
  };
  drivers: {
    [code: string]: {
      x: number;
      y: number;
      lap: number;
      dist: number;
      rel_dist: number;
      speed: number;
      gear: number;
      drs: number;
      throttle: number;
      brake: number;
      rpm: number;
      position: number;
      tyre: number;
    };
  };
}

export interface RaceEvent {
  type: 'dnf' | 'yellow_flag' | 'safety_car' | 'red_flag' | 'vsc';
  frame: number;
  endFrame?: number;
  label: string;
  lap: number | string;
}

// Qualifying-specific types
export interface SectorBest {
  time: string;
  driver: string;
}

export interface QualifyingLapEvent {
  driver: string;
  lap_number: number;
  time_ms: number;  // When this lap was completed (session time in ms)
  lap_time: string;
  lap_time_ms: number;
  sector1: string | null;
  sector2: string | null;
  sector3: string | null;
  is_personal_best: boolean;
  deleted: boolean;
  compound: string;
}

export interface RunningInterval {
  start_ms: number;  // Session time when clock started
  end_ms: number;    // Session time when clock stopped (Aborted or Finished)
}

export interface QualifyingSessionPhase {
  name: 'Q1' | 'Q2' | 'Q3';
  start_ms: number;           // Session time when phase first started
  end_ms: number;             // Session time when phase finally finished
  total_duration_ms: number;  // Accumulated clock time (accounts for red flags)
  running_intervals: RunningInterval[];  // All Started→Aborted/Finished periods
  elimination_positions: number[];
}

export interface QualifyingResult {
  position: number;
  driver_number: number;
  abbreviation: string;
  full_name: string;
  team_name: string;
  team_color: string;
  q1_time: string | null;
  q1_time_ms: number | null;
  q2_time: string | null;
  q2_time_ms: number | null;
  q3_time: string | null;
  q3_time_ms: number | null;
  eliminated_in: 'Q1' | 'Q2' | null;
}

export interface QualifyingMetadata {
  session_type: 'qualifying';
  session_phases: QualifyingSessionPhase[];
  results: QualifyingResult[];
  sector_bests: {
    sector1?: SectorBest;
    sector2?: SectorBest;
    sector3?: SectorBest;
  };
  lap_events: QualifyingLapEvent[];
}

export interface TelemetryMetadata {
  totalFrames: number;
  driverColors: { [code: string]: [number, number, number] };
  totalLaps: number;
  driverTeams?: { [code: string]: { name: string; key: string } };
  events?: RaceEvent[];
  sessionType?: 'R' | 'Q' | 'S' | 'SQ';
  qualifying?: QualifyingMetadata;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  private onFrameCallbacks: Array<(frame: TelemetryFrame) => void> = [];
  private onMetadataCallbacks: Array<(metadata: TelemetryMetadata) => void> = [];
  private onConnectedCallbacks: Array<() => void> = [];
  private onDisconnectedCallbacks: Array<() => void> = [];
  private onModeChangeCallbacks: Array<(mode: string, config: any) => void> = [];
  private onModesReceivedCallbacks: Array<(modes: any, current: string) => void> = [];

  constructor(url: string = import.meta.env.VITE_WS_URL || 'ws://localhost:3001') {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {

          this.reconnectAttempts = 0;
          this.onConnectedCallbacks.forEach(cb => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {

          }
        };

        this.ws.onerror = (error) => {

          reject(error);
        };

        this.ws.onclose = () => {

          this.onDisconnectedCallbacks.forEach(cb => cb());
          this.attemptReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'metadata':

        this.onMetadataCallbacks.forEach(cb => cb(message.data));
        break;

      case 'frame':
        // Pass both frame data and frameNumber
        const frameData = { ...message.data, frameNumber: message.frameNumber };
        this.onFrameCallbacks.forEach(cb => cb(frameData));
        break;

      case 'status':

        break;

      case 'modeChanged':

        this.onModeChangeCallbacks.forEach(cb => cb(message.mode, message.config));
        break;

      case 'modes':

        this.onModesReceivedCallbacks.forEach(cb => cb(message.modes, message.current));
        break;

      case 'error':

        break;

      default:

    }
  }

  sendCommand(command: string, value?: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ command, value }));
    } else {

    }
  }

  play(): void {
    this.sendCommand('start');
  }

  pause(): void {
    this.sendCommand('pause');
  }

  stop(): void {
    this.sendCommand('stop');
  }

  seek(frameNumber: number): void {
    this.sendCommand('seek', frameNumber);
  }

  setSpeed(speed: number): void {
    this.sendCommand('speed', speed);
  }

  // Streaming mode controls (for research simulation)
  setMode(mode: string): void {
    this.sendCommand('mode', mode);
  }

  setStreamingMode(mode: 'replay' | 'live' | 'polling'): void {

    this.sendCommand('mode', mode);
  }

  getModes(): void {
    this.sendCommand('getModes');
  }

  /**
   * Reconnect to the WebSocket server - triggers fresh metadata and first frame
   * Call this after loading a new race to refresh the data
   */
  async reconnect(): Promise<void> {
    // Close existing connection if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    
    // Small delay to ensure clean close
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Reconnect
    return this.connect();
  }

  onFrame(callback: (frame: TelemetryFrame) => void): void {
    this.onFrameCallbacks.push(callback);
  }

  onMetadata(callback: (metadata: TelemetryMetadata) => void): void {
    this.onMetadataCallbacks.push(callback);
  }

  onConnected(callback: () => void): void {
    this.onConnectedCallbacks.push(callback);
  }

  onDisconnected(callback: () => void): void {
    this.onDisconnectedCallbacks.push(callback);
  }

  onModeChange(callback: (mode: string, config: any) => void): void {
    this.onModeChangeCallbacks.push(callback);
  }

  onModesReceived(callback: (modes: any, current: string) => void): void {
    this.onModesReceivedCallbacks.push(callback);
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;


      setTimeout(() => {
        this.connect().catch((error) => {

        });
      }, this.reconnectDelay);
    } else {

    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
