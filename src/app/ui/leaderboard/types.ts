import type { QualifyingMetadata, QualifyingResult } from '../../playback/websocketClient';

export type SessionMode = 'race' | 'qualifying';

export type PitState = 'NONE' | 'IN_PIT' | 'PIT_EXIT';

export interface LeaderboardEntry {
  code: string;
  color: [number, number, number];
  position: number;
  progress_m: number;
  lap: number;
  tyre: number;
  drs: number;
  speed: number;
  isOut: boolean;
  pitState: PitState;
  gap?: string;
  // Qualifying-specific fields
  q1Time?: string | null;
  q2Time?: string | null;
  q3Time?: string | null;
  eliminatedIn?: 'Q1' | 'Q2' | null;
  isInDangerZone?: boolean;
}

export interface ProjectionResult {
  distanceAlong: number;  // Distance along the track (progress)
  distanceFrom: number;   // Distance from the track centerline
}

export interface LiveQualifyingState {
  bestTime: number | null;  // Best lap time in ms
  bestTimeStr: string | null;
  eliminated: boolean;
  eliminatedIn: 'Q1' | 'Q2' | null;
}

export interface TrackCenterline {
  x: number[];
  y: number[];
}

export interface DriverColors {
  [code: string]: [number, number, number];
}

// Re-export types from websocketClient for convenience
export type { QualifyingMetadata, QualifyingResult };
