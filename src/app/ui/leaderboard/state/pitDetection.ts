import type { PitState } from '../types';

/**
 * Pit lane detection constants
 * Distance: Pit lane is typically 25-30m from racing line, grid positions only 5-15m
 * Speed: Cars in pit lane move at 60-80 km/h
 */
const PIT_LANE_DISTANCE_THRESHOLD = 25; // meters from racing line
const PIT_LANE_SPEED_MAX = 85; // km/h (pit lane limit + buffer)
const PIT_LANE_SPEED_MIN = 30; // km/h (must be moving, not on grid)
const PIT_STOP_SPEED = 5; // km/h (considered stationary for pit stop)
const PIT_EXIT_SPEED_THRESHOLD = 90; // km/h (accelerating out of pit)

/**
 * PitDetection handles the state machine for detecting when drivers are in the pit lane.
 * 
 * State machine transitions:
 * NONE → IN_PIT: Car enters pit lane (far from centerline, pit lane speed)
 * IN_PIT → tracks when speed drops to ~0 (pit stop happening)
 * After pit stop → PIT_EXIT: Car starts moving again at pit lane speed
 * PIT_EXIT → NONE: Car accelerates above pit lane speed (rejoining track)
 */
export class PitDetection {
  private driverPitState: Map<string, PitState> = new Map();
  private driverHadPitStop: Map<string, boolean> = new Map();

  /**
   * Get the current pit state for a driver
   */
  getState(code: string): PitState {
    return this.driverPitState.get(code) || 'NONE';
  }

  /**
   * Update and return the pit state for a driver based on their current position and speed
   */
  updateState(code: string, distanceFromTrack: number, speed: number): PitState {
    const currentState = this.driverPitState.get(code) || 'NONE';
    const hadPitStop = this.driverHadPitStop.get(code) || false;
    
    const isInPitLaneArea = distanceFromTrack > PIT_LANE_DISTANCE_THRESHOLD;
    const isAtPitLaneSpeed = speed < PIT_LANE_SPEED_MAX && speed > PIT_LANE_SPEED_MIN;
    const isStopped = speed < PIT_STOP_SPEED;
    const isAccelerating = speed > PIT_EXIT_SPEED_THRESHOLD;
    
    let newState: PitState = currentState;
    
    switch (currentState) {
      case 'NONE':
        // Enter pit lane: far from track AND at pit lane speed
        if (isInPitLaneArea && isAtPitLaneSpeed) {
          newState = 'IN_PIT';
          this.driverHadPitStop.set(code, false);
        }
        break;
        
      case 'IN_PIT':
        // Track if car has stopped (pit stop is happening)
        if (isStopped) {
          this.driverHadPitStop.set(code, true);
        }
        
        // Transition to PIT_EXIT after pit stop and car starts moving again
        if (hadPitStop && isAtPitLaneSpeed) {
          newState = 'PIT_EXIT';
        }
        
        // If car somehow left pit area without stopping (aborted pit?)
        if (!isInPitLaneArea && !isStopped) {
          newState = 'NONE';
          this.driverHadPitStop.set(code, false);
        }
        break;
        
      case 'PIT_EXIT':
        // Exit pit lane: car accelerates above pit lane speed
        if (isAccelerating || !isInPitLaneArea) {
          newState = 'NONE';
          this.driverHadPitStop.set(code, false);
        }
        break;
    }
    
    this.driverPitState.set(code, newState);
    return newState;
  }

  /**
   * Reset all pit state tracking
   */
  reset(): void {
    this.driverPitState.clear();
    this.driverHadPitStop.clear();
  }
}
