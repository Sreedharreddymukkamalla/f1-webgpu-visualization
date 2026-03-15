import type { QualifyingMetadata, QualifyingResult, LiveQualifyingState } from '../types';

/**
 * QualifyingStateManager handles all qualifying session state including:
 * - Phase tracking (Q1, Q2, Q3)
 * - Elimination tracking
 * - Live standings calculation
 * - Timer calculations with red flag support
 */
export class QualifyingStateManager {
  private qualifyingData: QualifyingMetadata | null = null;
  private currentPhase: 'Q1' | 'Q2' | 'Q3' = 'Q1';
  private qualifyingResultsMap: Map<string, QualifyingResult> = new Map();
  private isSprintQualifying: boolean = false;
  
  // Live qualifying state (calculated from lap events up to current time)
  private liveQualifyingState: Map<string, LiveQualifyingState> = new Map();
  private q1EliminatedDrivers: Set<string> = new Set();
  private q2EliminatedDrivers: Set<string> = new Set();

  /**
   * Set qualifying data and reset state
   */
  setData(data: QualifyingMetadata, isSprint: boolean = false): void {
    this.qualifyingData = data;
    this.isSprintQualifying = isSprint;
    
    // Reset all live qualifying state
    this.q1EliminatedDrivers.clear();
    this.q2EliminatedDrivers.clear();
    this.liveQualifyingState.clear();
    this.currentPhase = 'Q1';
    
    // Build lookup map for quick access
    this.qualifyingResultsMap.clear();
    for (const result of data.results) {
      this.qualifyingResultsMap.set(result.abbreviation, result);
    }
  }

  /**
   * Get qualifying data
   */
  getData(): QualifyingMetadata | null {
    return this.qualifyingData;
  }

  /**
   * Get result for a specific driver
   */
  getResult(code: string): QualifyingResult | undefined {
    return this.qualifyingResultsMap.get(code);
  }

  /**
   * Get the current qualifying phase
   */
  getPhase(): 'Q1' | 'Q2' | 'Q3' {
    return this.currentPhase;
  }

  /**
   * Check if this is sprint qualifying
   */
  getIsSprint(): boolean {
    return this.isSprintQualifying;
  }

  /**
   * Get the display name for the current phase
   */
  getPhaseDisplayName(): string {
    return this.isSprintQualifying ? `S${this.currentPhase}` : this.currentPhase;
  }

  /**
   * Get live state for a driver
   */
  getLiveState(code: string): LiveQualifyingState | undefined {
    return this.liveQualifyingState.get(code);
  }

  /**
   * Get all live states
   */
  getAllLiveStates(): Map<string, LiveQualifyingState> {
    return this.liveQualifyingState;
  }

  /**
   * Get elimination zone positions for current phase
   */
  getEliminationZone(): number[] {
    if (this.currentPhase === 'Q1') return [16, 17, 18, 19, 20];
    if (this.currentPhase === 'Q2') return [11, 12, 13, 14, 15];
    return []; // Q3 has no elimination
  }

  /**
   * Get all eliminated drivers
   */
  getEliminatedDrivers(): Set<string> {
    const eliminated = new Set<string>();
    this.q1EliminatedDrivers.forEach(code => eliminated.add(code));
    this.q2EliminatedDrivers.forEach(code => eliminated.add(code));
    return eliminated;
  }

  /**
   * Update qualifying state based on session time
   * Returns the new phase if it changed, null otherwise
   */
  updateTime(sessionTimeMs: number): { phaseChanged: boolean; timerInfo: TimerInfo } {
    if (!this.qualifyingData) {
      return { phaseChanged: false, timerInfo: { remainingMs: 0, isClockRunning: false } };
    }
    
    // Determine current phase based on session time
    let newPhase: 'Q1' | 'Q2' | 'Q3' = 'Q1';
    
    const q1Phase = this.qualifyingData.session_phases.find(p => p.name === 'Q1');
    if (q1Phase && sessionTimeMs < q1Phase.start_ms) {
      newPhase = 'Q1';
    } else {
      for (const phase of this.qualifyingData.session_phases) {
        if (sessionTimeMs >= phase.start_ms && sessionTimeMs <= phase.end_ms) {
          newPhase = phase.name;
          break;
        } else if (sessionTimeMs > phase.end_ms) {
          newPhase = phase.name;
        }
      }
    }
    
    const phaseChanged = newPhase !== this.currentPhase;
    this.currentPhase = newPhase;
    
    // Handle eliminations
    const q2Start = this.qualifyingData.session_phases.find(p => p.name === 'Q2')?.start_ms || Infinity;
    const q3Start = this.qualifyingData.session_phases.find(p => p.name === 'Q3')?.start_ms || Infinity;
    
    // Q1 eliminations: calculate when Q2 starts
    if (sessionTimeMs >= q2Start && this.q1EliminatedDrivers.size === 0) {
      this.calculateQ1Eliminations();
    }
    
    // Q2 eliminations: calculate when Q3 starts
    if (sessionTimeMs >= q3Start && this.q2EliminatedDrivers.size === 0) {
      this.calculateQ2Eliminations();
    }
    
    // Handle seeking backwards
    if (sessionTimeMs < q2Start && this.q1EliminatedDrivers.size > 0) {
      this.q1EliminatedDrivers.clear();
    }
    if (sessionTimeMs < q3Start && this.q2EliminatedDrivers.size > 0) {
      this.q2EliminatedDrivers.clear();
    }
    
    // Calculate live standings
    this.calculateLiveStandings(sessionTimeMs);
    
    // Calculate timer info
    const timerInfo = this.calculateTimer(sessionTimeMs);
    
    return { phaseChanged, timerInfo };
  }

  /**
   * Get the current live position and time for a driver
   */
  getLivePosition(driverCode: string): { position: number; time: string | null; eliminated: boolean } {
    if (!this.qualifyingData || this.liveQualifyingState.size === 0) {
      return { position: 99, time: null, eliminated: false };
    }
    
    // Sort drivers by best time
    const standings = Array.from(this.liveQualifyingState.entries())
      .map(([driver, state]) => ({ driver, ...state }))
      .sort((a, b) => {
        // Eliminated drivers go to the end
        if (a.eliminated && !b.eliminated) return 1;
        if (!a.eliminated && b.eliminated) return -1;
        // No time goes after those with times
        if (a.bestTime === null && b.bestTime !== null) return 1;
        if (a.bestTime !== null && b.bestTime === null) return -1;
        if (a.bestTime === null && b.bestTime === null) return 0;
        return a.bestTime! - b.bestTime!;
      });
    
    const idx = standings.findIndex(s => s.driver === driverCode);
    const state = this.liveQualifyingState.get(driverCode);
    
    return {
      position: idx >= 0 ? idx + 1 : 99,
      time: state?.bestTimeStr || null,
      eliminated: state?.eliminated || false
    };
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.q1EliminatedDrivers.clear();
    this.q2EliminatedDrivers.clear();
    this.liveQualifyingState.clear();
    this.currentPhase = 'Q1';
  }

  /**
   * Calculate Q1 eliminations using official results from API
   */
  private calculateQ1Eliminations(): void {
    if (!this.qualifyingData) return;
    
    this.q1EliminatedDrivers.clear();
    for (const result of this.qualifyingData.results) {
      if (result.eliminated_in === 'Q1') {
        this.q1EliminatedDrivers.add(result.abbreviation);
      }
    }
  }

  /**
   * Calculate Q2 eliminations using official results from API
   */
  private calculateQ2Eliminations(): void {
    if (!this.qualifyingData) return;
    
    this.q2EliminatedDrivers.clear();
    for (const result of this.qualifyingData.results) {
      if (result.eliminated_in === 'Q2') {
        this.q2EliminatedDrivers.add(result.abbreviation);
      }
    }
  }

  /**
   * Calculate live standings based on lap events up to the current time
   */
  private calculateLiveStandings(sessionTimeMs: number): void {
    if (!this.qualifyingData) return;
    
    // Determine phase boundaries
    const q2Start = this.qualifyingData.session_phases.find(p => p.name === 'Q2')?.start_ms || Infinity;
    const q3Start = this.qualifyingData.session_phases.find(p => p.name === 'Q3')?.start_ms || Infinity;
    
    // Determine current phase
    let currentPhaseName: 'Q1' | 'Q2' | 'Q3' = 'Q1';
    if (sessionTimeMs >= q3Start) {
      currentPhaseName = 'Q3';
    } else if (sessionTimeMs >= q2Start) {
      currentPhaseName = 'Q2';
    }
    
    // Reset live state
    this.liveQualifyingState.clear();
    
    // For each driver, calculate their best time FOR THE CURRENT PHASE
    for (const result of this.qualifyingData.results) {
      let bestTime: number | null = null;
      let bestTimeStr: string | null = null;
      
      const isQ1Eliminated = this.q1EliminatedDrivers.has(result.abbreviation);
      const isQ2Eliminated = this.q2EliminatedDrivers.has(result.abbreviation);
      const isEliminated = isQ1Eliminated || isQ2Eliminated;
      
      // Process lap events for this driver
      for (const lap of this.qualifyingData.lap_events) {
        if (lap.driver !== result.abbreviation || lap.deleted) continue;
        if (lap.time_ms > sessionTimeMs) continue;
        
        // Determine which phase this lap belongs to
        const isQ1Lap = lap.time_ms < q2Start;
        const isQ2Lap = lap.time_ms >= q2Start && lap.time_ms < q3Start;
        const isQ3Lap = lap.time_ms >= q3Start;
        
        if (currentPhaseName === 'Q1' && isQ1Lap) {
          if (bestTime === null || lap.lap_time_ms < bestTime) {
            bestTime = lap.lap_time_ms;
            bestTimeStr = lap.lap_time;
          }
        } else if (currentPhaseName === 'Q2') {
          if (isQ1Eliminated) {
            if (isQ1Lap) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            }
          } else {
            if (isQ2Lap) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            } else if (isQ1Lap && bestTime === null) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            }
          }
        } else if (currentPhaseName === 'Q3') {
          if (isQ1Eliminated || isQ2Eliminated) {
            if (isQ1Eliminated && isQ1Lap) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            } else if (isQ2Eliminated && (isQ1Lap || isQ2Lap)) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            }
          } else {
            if (isQ3Lap) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            } else if ((isQ1Lap || isQ2Lap) && bestTime === null) {
              if (bestTime === null || lap.lap_time_ms < bestTime) {
                bestTime = lap.lap_time_ms;
                bestTimeStr = lap.lap_time;
              }
            }
          }
        }
      }
      
      this.liveQualifyingState.set(result.abbreviation, {
        bestTime,
        bestTimeStr,
        eliminated: isEliminated,
        eliminatedIn: isQ1Eliminated ? 'Q1' : (isQ2Eliminated ? 'Q2' : null)
      });
    }
  }

  /**
   * Calculate timer information for the current phase
   */
  private calculateTimer(sessionTimeMs: number): TimerInfo {
    if (!this.qualifyingData) {
      return { remainingMs: 0, isClockRunning: false };
    }

    const currentPhaseData = this.qualifyingData.session_phases.find(p => p.name === this.currentPhase);
    if (!currentPhaseData) {
      return { remainingMs: 0, isClockRunning: false };
    }

    let remainingMs: number;
    let isClockRunning = false;
    
    if (sessionTimeMs < currentPhaseData.start_ms) {
      remainingMs = currentPhaseData.total_duration_ms;
    } else if (sessionTimeMs >= currentPhaseData.end_ms) {
      remainingMs = 0;
    } else if (currentPhaseData.running_intervals && currentPhaseData.running_intervals.length > 0) {
      let elapsedMs = 0;
      
      for (const interval of currentPhaseData.running_intervals) {
        if (sessionTimeMs >= interval.end_ms) {
          elapsedMs += interval.end_ms - interval.start_ms;
        } else if (sessionTimeMs >= interval.start_ms) {
          elapsedMs += sessionTimeMs - interval.start_ms;
          isClockRunning = true;
          break;
        } else {
          break;
        }
      }
      
      remainingMs = Math.max(0, currentPhaseData.total_duration_ms - elapsedMs);
    } else {
      remainingMs = currentPhaseData.end_ms - sessionTimeMs;
    }

    return { remainingMs, isClockRunning };
  }
}

export interface TimerInfo {
  remainingMs: number;
  isClockRunning: boolean;
}
