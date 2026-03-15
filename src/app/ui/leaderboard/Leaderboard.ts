import type { TelemetryFrame, QualifyingMetadata } from '../../playback/websocketClient';
import type { 
  SessionMode, 
  LeaderboardEntry, 
  DriverColors, 
  TrackCenterline,
  LiveQualifyingState,
  PitState
} from './types';

// State managers
import { TrackProjection } from './utils/trackProjection';
import { PitDetection } from './state/pitDetection';
import { DNFDetection } from './state/dnfDetection';
import { QualifyingStateManager } from './state/qualifyingState';

// Renderers
import { 
  renderLeaderboardContainer, 
  updateLapCounter, 
  updatePhaseIndicator,
  updateQualiTimer,
  updateFlagBanner 
} from './renderers/containerRenderer';
import { 
  renderQualifyingEntry, 
  renderRaceEntry,
  updatePitLabel,
  updateDrsIndicator,
  updateTyreIndicator,
  buildEntryClassName
} from './renderers/entryRenderer';
// Tyre utils imported by renderers

/**
 * Leaderboard component that displays race/qualifying standings.
 * 
 * This class orchestrates the various state managers and renderers to provide
 * a complete leaderboard experience for both race and qualifying sessions.
 */
export class Leaderboard {
  private container: HTMLElement;
  private entries: LeaderboardEntry[] = [];
  private driverColors: DriverColors = {};
  private totalLaps: number = 0;
  private currentLap: number = 0;
  private entryElements: Map<string, HTMLElement> = new Map();
  private selectedCode: string | null = null;
  
  // Session mode
  private sessionMode: SessionMode = 'race';
  
  // State managers
  private trackProjection: TrackProjection;
  private pitDetection: PitDetection;
  private dnfDetection: DNFDetection;
  private qualifyingState: QualifyingStateManager;
  
  // POV camera callback
  private onDriverSelectCallback?: (code: string) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    
    // Initialize state managers
    this.trackProjection = new TrackProjection();
    this.pitDetection = new PitDetection();
    this.dnfDetection = new DNFDetection();
    this.qualifyingState = new QualifyingStateManager();
    
    this.render();
  }

  /**
   * Set the session mode (race or qualifying)
   */
  setSessionMode(mode: SessionMode): void {
    this.sessionMode = mode;
    this.render();
    this.resetEntries();
  }

  /**
   * Set qualifying metadata for TV-like display
   */
  setQualifyingData(data: QualifyingMetadata, isSprint: boolean = false): void {
    this.qualifyingState.setData(data, isSprint);
    this.sessionMode = 'qualifying';
    this.render();
    this.resetEntries();
  }

  /**
   * Set current qualifying phase (Q1, Q2, Q3)
   */
  setQualifyingPhase(phase: 'Q1' | 'Q2' | 'Q3'): void {
    // This is now handled internally by QualifyingStateManager
    updatePhaseIndicator(this.container, phase, this.qualifyingState.getIsSprint());
  }

  /**
   * Update live qualifying state based on current session time
   */
  updateQualifyingTime(sessionTimeMs: number): void {
    if (this.sessionMode !== 'qualifying') return;
    
    const { phaseChanged, timerInfo } = this.qualifyingState.updateTime(sessionTimeMs);
    
    if (phaseChanged) {
      updatePhaseIndicator(
        this.container, 
        this.qualifyingState.getPhase(), 
        this.qualifyingState.getIsSprint()
      );
    }
    
    const qualifyingData = this.qualifyingState.getData();
    if (qualifyingData) {
      const currentPhaseData = qualifyingData.session_phases.find(
        p => p.name === this.qualifyingState.getPhase()
      );
      
      updateQualiTimer(
        this.container,
        timerInfo.remainingMs,
        timerInfo.isClockRunning,
        currentPhaseData ? sessionTimeMs >= currentPhaseData.start_ms : false,
        currentPhaseData ? sessionTimeMs >= currentPhaseData.end_ms : false
      );
    }
  }

  /**
   * Get the current live position and time for a driver
   */
  getLiveQualifyingPosition(driverCode: string): { position: number; time: string | null; eliminated: boolean } {
    return this.qualifyingState.getLivePosition(driverCode);
  }

  /**
   * Set the track centerline for position projection
   */
  setTrackCenterline(centerline: TrackCenterline): void {
    this.trackProjection.setCenterline(centerline);
  }

  /**
   * Set driver colors for display
   */
  setDriverColors(colors: DriverColors): void {
    this.driverColors = colors;
  }

  /**
   * Set total laps for the race
   */
  setTotalLaps(laps: number): void {
    this.totalLaps = laps;
    updateLapCounter(this.container, this.currentLap, this.totalLaps);
  }

  /**
   * Reset all entry elements to force re-render
   */
  resetEntries(): void {
    this.entryElements.clear();
    this.dnfDetection.reset();
    this.pitDetection.reset();
    
    const entriesContainer = this.container.querySelector('.leaderboard-entries');
    if (entriesContainer) {
      entriesContainer.innerHTML = '';
    }
  }

  /**
   * Update leaderboard from telemetry frame
   */
  updateFromFrame(frame: TelemetryFrame): void {
    // For qualifying, update live state based on frame time
    if (this.sessionMode === 'qualifying' && frame.t !== undefined) {
      const sessionTimeMs = frame.t * 1000;
      this.updateQualifyingTime(sessionTimeMs);
    }
    
    // Calculate driver progress
    const driver_progress: { [code: string]: { progress_m: number; distanceFrom: number } } = {};
    const trackLength = this.trackProjection.totalLength;

    for (const [code, pos] of Object.entries(frame.drivers)) {
      let lap: number;
      try {
        lap = parseInt(String(pos.lap || 1));
      } catch {
        lap = 1;
      }

      const projection = this.trackProjection.projectToReference(pos.x || 0.0, pos.y || 0.0);

      // Fix for start-line wrap-around
      const telemetry_dist = pos.dist || 0.0;
      let corrected_projected_m = projection.distanceAlong;
      if (lap === 1 && telemetry_dist < trackLength * 0.5 && projection.distanceAlong > trackLength * 0.5) {
        corrected_projected_m = projection.distanceAlong - trackLength;
      }

      const progress_m = (Math.max(lap, 1) - 1) * trackLength + corrected_projected_m;
      driver_progress[code] = { progress_m, distanceFrom: projection.distanceFrom };
    }

    // Build entries
    const entries: LeaderboardEntry[] = [];
    for (const [code, pos] of Object.entries(frame.drivers)) {
      const color = this.driverColors[code] || [255, 255, 255];
      const { progress_m, distanceFrom } = driver_progress[code];
      const speed = pos.speed || 0;
      
      // Update state machines
      const pitState = this.pitDetection.updateState(code, distanceFrom, speed);
      const isOut = this.dnfDetection.isDriverOut(code, pos.rel_dist);

      // Get qualifying data if available
      const qualiResult = this.qualifyingState.getResult(code);
      
      entries.push({
        code,
        color,
        position: pos.position,
        progress_m,
        lap: pos.lap,
        tyre: pos.tyre,
        drs: pos.drs,
        speed,
        isOut,
        pitState,
        q1Time: qualiResult?.q1_time,
        q2Time: qualiResult?.q2_time,
        q3Time: qualiResult?.q3_time,
        eliminatedIn: qualiResult?.eliminated_in,
      });
    }

    // Sort entries
    this.sortEntries(entries);
    this.entries = entries;
    
    // Update lap counter
    if (entries.length > 0) {
      this.currentLap = entries[0].lap;
      updateLapCounter(this.container, this.currentLap, this.totalLaps);
    }
    
    // Update flag banner
    updateFlagBanner(this.container, frame.track_status);
    
    // Update DOM
    this.updateDOM();
  }

  /**
   * Sort entries based on session mode
   */
  private sortEntries(entries: LeaderboardEntry[]): void {
    const liveStates = this.qualifyingState.getAllLiveStates();
    
    if (this.sessionMode === 'qualifying' && liveStates.size > 0) {
      entries.sort((a, b) => {
        const aState = liveStates.get(a.code);
        const bState = liveStates.get(b.code);
        
        const aEliminated = aState?.eliminated || false;
        const bEliminated = bState?.eliminated || false;
        if (aEliminated && !bEliminated) return 1;
        if (!aEliminated && bEliminated) return -1;
        
        const aTime = aState?.bestTime ?? Infinity;
        const bTime = bState?.bestTime ?? Infinity;
        
        if (aTime === Infinity && bTime !== Infinity) return 1;
        if (aTime !== Infinity && bTime === Infinity) return -1;
        
        return aTime - bTime;
      });
    } else {
      entries.sort((a, b) => b.progress_m - a.progress_m);
    }
  }

  /**
   * Set callback for driver selection (POV camera)
   */
  onDriverSelect(callback: (code: string) => void): void {
    this.onDriverSelectCallback = callback;
  }

  /**
   * Set the currently selected driver
   */
  setSelectedDriver(code: string | null): void {
    this.selectedCode = code;
  }

  /**
   * Get the set of all eliminated drivers (qualifying mode)
   */
  getEliminatedDrivers(): Set<string> {
    return this.qualifyingState.getEliminatedDrivers();
  }

  /**
   * Get the set of all "out" drivers (DNF in race, eliminated in qualifying)
   */
  getOutDrivers(): Set<string> {
    const outDrivers = new Set<string>();
    
    // Add eliminated drivers from qualifying
    this.qualifyingState.getEliminatedDrivers().forEach(code => outDrivers.add(code));
    
    // Add DNF drivers from race
    this.entries.forEach(entry => {
      if (entry.isOut) {
        outDrivers.add(entry.code);
      }
    });
    
    return outDrivers;
  }

  /**
   * Render the initial container structure
   */
  private render(): void {
    this.container.className = 'leaderboard';
    this.container.innerHTML = renderLeaderboardContainer(this.sessionMode);
  }

  /**
   * Update DOM elements for all entries
   */
  private updateDOM(): void {
    const leaderboardEl = this.container.querySelector('.leaderboard-entries') as HTMLElement;
    if (!leaderboardEl) return;

    const entryHeight = 28;
    leaderboardEl.style.height = `${this.entries.length * entryHeight}px`;

    const eliminationZone = this.qualifyingState.getEliminationZone();
    const liveStates = this.qualifyingState.getAllLiveStates();

    this.entries.forEach((entry, index) => {
      let entryEl = this.entryElements.get(entry.code);
      const displayPosition = index + 1;

      if (!entryEl) {
        entryEl = this.createEntryElement(entry, leaderboardEl);
      }

      // Update position and styling
      entryEl.style.transform = `translateY(${index * entryHeight}px)`;
      entryEl.style.setProperty('--position', `${index}`);
      entryEl.style.setProperty('--driver-rgb', `${entry.color[0]}, ${entry.color[1]}, ${entry.color[2]}`);

      const liveState = liveStates.get(entry.code);
      const isLeader = index === 0;
      const isInDangerZone = this.sessionMode === 'qualifying' && 
                            eliminationZone.includes(displayPosition) && 
                            liveState?.eliminated !== true;
      const isEliminated = this.sessionMode === 'qualifying' && liveState?.eliminated === true;
      const showOut = this.sessionMode === 'race' && entry.isOut;
      
      // Update class
      entryEl.className = buildEntryClassName({
        isOut: showOut,
        isSelected: entry.code === this.selectedCode,
        isLeader,
        isInDangerZone,
        isEliminated
      });
      
      // Update cursor
      const isNotClickable = isEliminated || showOut;
      entryEl.style.cursor = isNotClickable ? 'default' : 'pointer';

      // Update content based on mode
      this.updateEntryContent(entryEl, entry, displayPosition, liveState);
    });

    // Remove stale entries
    this.removeStaleEntries();
  }

  /**
   * Create a new entry element
   */
  private createEntryElement(entry: LeaderboardEntry, container: HTMLElement): HTMLElement {
    const entryEl = document.createElement('div');
    entryEl.className = 'leaderboard-entry';
    entryEl.dataset.code = entry.code;
    container.appendChild(entryEl);
    this.entryElements.set(entry.code, entryEl);
    
    // Add click handler
    const driverCode = entry.code;
    entryEl.addEventListener('click', () => {
      const liveState = this.qualifyingState.getLiveState(driverCode);
      const isEliminatedQualifying = liveState?.eliminated || false;
      const currentEntry = this.entries.find(e => e.code === driverCode);
      const isOutRace = this.sessionMode === 'race' && currentEntry?.isOut === true;
      
      if (isEliminatedQualifying || isOutRace) return;
      
      if (this.onDriverSelectCallback) {
        this.onDriverSelectCallback(driverCode);
      }
    });
    entryEl.style.cursor = 'pointer';
    
    return entryEl;
  }

  /**
   * Update the content of an entry element
   */
  private updateEntryContent(
    entryEl: HTMLElement, 
    entry: LeaderboardEntry, 
    displayPosition: number,
    liveState: LiveQualifyingState | undefined
  ): void {
    // Determine expected HTML
    const expectedHTML = this.sessionMode === 'qualifying'
      ? renderQualifyingEntry(entry, displayPosition, liveState)
      : renderRaceEntry(entry, displayPosition);

    // Initialize if needed
    if (!entryEl.dataset.initialized) {
      entryEl.innerHTML = expectedHTML;
      entryEl.dataset.initialized = 'true';
      return;
    }

    // Handle mode-specific updates
    if (this.sessionMode === 'race') {
      this.updateRaceEntry(entryEl, entry, expectedHTML);
    } else {
      this.updateQualifyingEntry(entryEl, entry, expectedHTML, liveState);
    }

    // Always update position
    const positionEl = entryEl.querySelector('.position');
    if (positionEl) {
      positionEl.textContent = `${displayPosition}`;
    }
  }

  /**
   * Update race mode entry content
   */
  private updateRaceEntry(entryEl: HTMLElement, entry: LeaderboardEntry, expectedHTML: string): void {
    const hasOutLabel = entryEl.querySelector('.eliminated-label') !== null;
    const hasIndicators = entryEl.querySelector('.indicators') !== null;
    
    if (entry.isOut && hasIndicators) {
      entryEl.innerHTML = expectedHTML;
    } else if (!entry.isOut && hasOutLabel && !hasIndicators) {
      entryEl.innerHTML = expectedHTML;
    } else if (!entry.isOut) {
      // Update pit label
      const pitLabel = entryEl.querySelector('.pit-label') as HTMLElement;
      if (pitLabel) {
        const previousState = pitLabel.dataset.state as PitState || 'NONE';
        updatePitLabel(pitLabel, previousState, entry.pitState, entry.color);
      }
      
      // Update DRS
      updateDrsIndicator(entryEl.querySelector('.drs-indicator'), entry.drs >= 10);
      
      // Update tyre
      updateTyreIndicator(entryEl.querySelector('.tyre-indicator') as HTMLImageElement, entry.tyre);
    }
  }

  /**
   * Update qualifying mode entry content
   */
  private updateQualifyingEntry(
    entryEl: HTMLElement, 
    entry: LeaderboardEntry, 
    expectedHTML: string,
    liveState: LiveQualifyingState | undefined
  ): void {
    const isEliminated = liveState?.eliminated || false;
    const hasOutLabel = entryEl.querySelector('.eliminated-label') !== null;
    const hasTyreIndicator = entryEl.querySelector('.tyre-indicator') !== null;
    
    if (isEliminated && hasTyreIndicator) {
      entryEl.innerHTML = expectedHTML;
    } else if (!isEliminated && hasOutLabel && !hasTyreIndicator) {
      entryEl.innerHTML = expectedHTML;
    } else if (!isEliminated) {
      // Update time
      const qualiTimeEl = entryEl.querySelector('.quali-time.best-time');
      if (qualiTimeEl) {
        qualiTimeEl.textContent = liveState?.bestTimeStr || '-';
      }
      
      // Update tyre
      updateTyreIndicator(entryEl.querySelector('.tyre-indicator') as HTMLImageElement, entry.tyre);
    }
  }

  /**
   * Remove entry elements that are no longer in the entries list
   */
  private removeStaleEntries(): void {
    const currentCodes = new Set(this.entries.map(e => e.code));
    for (const [code, element] of this.entryElements.entries()) {
      if (!currentCodes.has(code)) {
        element.remove();
        this.entryElements.delete(code);
      }
    }
  }
}
