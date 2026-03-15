/**
 * Shared constants used across the application
 */

// Playback constants
export const DEFAULT_FPS = 25;
export const FRAMES_PER_SECOND = 25;

// WebSocket constants
export const DEFAULT_WS_URL = 'ws://localhost:3001';
export const DEFAULT_API_URL = 'http://localhost:3001/api';

// Track constants
export const TRACK_INTERPOLATION_POINTS = 4000;
export const PIT_LANE_DISTANCE_THRESHOLD = 25; // meters from racing line
export const PIT_LANE_SPEED_MAX = 85; // km/h
export const PIT_LANE_SPEED_MIN = 30; // km/h

// DNF detection
export const DNF_REL_DIST_THRESHOLD = 0.999;
export const DNF_FROZEN_FRAMES_THRESHOLD = 50;

// UI constants
export const LEADERBOARD_ENTRY_HEIGHT = 28;
