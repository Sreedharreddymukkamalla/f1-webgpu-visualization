/**
 * DNF detection constants
 */
const DNF_REL_DIST_THRESHOLD = 0.999; // rel_dist >= this is suspicious
const DNF_FROZEN_FRAMES_THRESHOLD = 50; // ~2 seconds at 25fps

/**
 * DNFDetection handles detection of drivers who are OUT (DNF) based on telemetry behavior.
 * 
 * A driver is considered OUT if:
 * 1. rel_dist is NaN or null (telemetry stopped completely)
 *    Note: NaN becomes null when serialized via JSON.stringify() over WebSocket
 * 2. rel_dist is very high (>= 0.999) AND has been frozen for several frames
 *    (distinguishes from legitimate finish line crossings where rel_dist resets to 0)
 */
export class DNFDetection {
  private driverLastRelDist: Map<string, number> = new Map();
  private driverFrozenFrames: Map<string, number> = new Map();

  /**
   * Check if a driver is OUT (DNF) based on their rel_dist value
   */
  isDriverOut(code: string, relDist: number): boolean {
    // Case 1: NaN or null means telemetry stopped - definitely OUT
    // Note: JSON.stringify() converts NaN to null, so we check for both
    if (relDist === null || relDist === undefined || Number.isNaN(relDist)) {
      return true;
    }
    
    const lastRelDist = this.driverLastRelDist.get(code);
    const frozenFrames = this.driverFrozenFrames.get(code) || 0;
    
    // Check if rel_dist is in the "suspicious" high range
    if (relDist >= DNF_REL_DIST_THRESHOLD) {
      // Check if value is frozen (hasn't changed significantly)
      if (lastRelDist !== undefined && Math.abs(relDist - lastRelDist) < 0.0001) {
        // Value is frozen - increment counter
        const newFrozenFrames = frozenFrames + 1;
        this.driverFrozenFrames.set(code, newFrozenFrames);
        
        // If frozen for enough frames, driver is OUT
        if (newFrozenFrames >= DNF_FROZEN_FRAMES_THRESHOLD) {
          return true;
        }
      } else {
        // Value changed - reset frozen counter
        this.driverFrozenFrames.set(code, 0);
      }
    } else {
      // rel_dist is in normal range - reset frozen counter
      this.driverFrozenFrames.set(code, 0);
    }
    
    // Update last known rel_dist
    this.driverLastRelDist.set(code, relDist);
    
    return false;
  }

  /**
   * Reset all DNF detection state
   */
  reset(): void {
    this.driverLastRelDist.clear();
    this.driverFrozenFrames.clear();
  }
}
