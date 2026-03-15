// Circuit types - REMOVED (now using telemetry-based tracks)
// Previously: CircuitFile, CircuitFormat for STL/3MF loading

// Car types
export interface CarConfig {
  name: string;
  color: number;
  speed?: number;
  startPosition?: number;
}

// Animation types
export type UpdateCallback = (deltaTime: number) => void;

// ============================================================================
// QUALIFYING TYPES - TV-like qualifying display
// ============================================================================

export type SessionType = 'R' | 'Q' | 'S' | 'SQ';
export type QualifyingPhase = 'Q1' | 'Q2' | 'Q3';
export type SectorStatus = 'purple' | 'green' | 'yellow' | 'none';

export interface QualifyingResult {
  position: number;
  driver_number: number;
  abbreviation: string;
  full_name: string;
  team_name: string;
  team_color: string;
  q1_time: string | null;
  q2_time: string | null;
  q3_time: string | null;
  eliminated_in: 'Q1' | 'Q2' | null;
}

export interface SectorBest {
  time: string;
  driver: string;
}

export interface QualifyingLapEvent {
  driver: string;
  lap_number: number;
  lap_time: string;
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
  name: QualifyingPhase;
  start_ms: number;           // Session time when phase first started
  end_ms: number;             // Session time when phase finally finished
  total_duration_ms: number;  // Accumulated clock time (accounts for red flags)
  running_intervals: RunningInterval[];  // All Started→Aborted/Finished periods
  elimination_positions: number[];
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

// Driver's current sector timing during a lap
export interface DriverSectorTiming {
  driver: string;
  currentSector: 1 | 2 | 3 | null; // Which sector they're in (null = not on track)
  sector1Time: string | null;
  sector1Status: SectorStatus;
  sector2Time: string | null;
  sector2Status: SectorStatus;
  sector3Time: string | null;
  sector3Status: SectorStatus;
  isOnHotLap: boolean;
  isDeleted: boolean;
}
