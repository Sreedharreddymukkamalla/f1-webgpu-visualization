/**
 * SectorTimingWidget - TV-like sector timing display for qualifying
 * Shows sector times with purple/green/yellow color coding
 */

import type { QualifyingMetadata } from '../playback/websocketClient';

export type SectorStatus = 'purple' | 'green' | 'yellow' | 'none';

interface DriverSectorState {
  driver: string;
  sector1: string | null;
  sector1Status: SectorStatus;
  sector2: string | null;
  sector2Status: SectorStatus;
  sector3: string | null;
  sector3Status: SectorStatus;
  lapTime: string | null;
  isPersonalBest: boolean;
}

export class SectorTimingWidget {
  private container: HTMLElement;
  private sectorBests: QualifyingMetadata['sector_bests'] = {};
  private activeDrivers: Map<string, DriverSectorState> = new Map();
  private driverColors: { [code: string]: [number, number, number] } = {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /**
   * Set sector best times for comparison
   */
  setSectorBests(bests: QualifyingMetadata['sector_bests']): void {
    this.sectorBests = bests;
  }

  /**
   * Set driver colors for styling
   */
  setDriverColors(colors: { [code: string]: [number, number, number] }): void {
    this.driverColors = colors;
  }

  /**
   * Update a driver's sector timing (called as they complete sectors)
   */
  updateDriverSector(
    driver: string, 
    sector: 1 | 2 | 3, 
    time: string, 
    personalBest: string | null
  ): void {
    let state = this.activeDrivers.get(driver);
    
    if (!state) {
      state = {
        driver,
        sector1: null,
        sector1Status: 'none',
        sector2: null,
        sector2Status: 'none',
        sector3: null,
        sector3Status: 'none',
        lapTime: null,
        isPersonalBest: false,
      };
      this.activeDrivers.set(driver, state);
    }

    // Determine sector status (purple = overall best, green = personal best, yellow = slower)
    const status = this.getSectorStatus(sector, time, personalBest);
    
    if (sector === 1) {
      state.sector1 = time;
      state.sector1Status = status;
    } else if (sector === 2) {
      state.sector2 = time;
      state.sector2Status = status;
    } else if (sector === 3) {
      state.sector3 = time;
      state.sector3Status = status;
    }

    this.updateDOM();
  }

  /**
   * Set complete lap for a driver (after crossing finish line)
   */
  setDriverLap(driver: string, lapTime: string, isPersonalBest: boolean): void {
    const state = this.activeDrivers.get(driver);
    if (state) {
      state.lapTime = lapTime;
      state.isPersonalBest = isPersonalBest;
      this.updateDOM();
      
      // Clear after 5 seconds
      setTimeout(() => {
        this.activeDrivers.delete(driver);
        this.updateDOM();
      }, 5000);
    }
  }

  /**
   * Clear a driver's timing (e.g., lap deleted or back in pits)
   */
  clearDriver(driver: string): void {
    this.activeDrivers.delete(driver);
    this.updateDOM();
  }

  private getSectorStatus(sector: 1 | 2 | 3, time: string, personalBest: string | null): SectorStatus {
    const sectorKey = `sector${sector}` as 'sector1' | 'sector2' | 'sector3';
    const overallBest = this.sectorBests[sectorKey]?.time;
    
    // Convert time strings to comparable numbers
    const parseTime = (t: string): number => {
      const parts = t.split(':');
      if (parts.length === 2) {
        return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
      }
      return parseFloat(t);
    };

    const currentTime = parseTime(time);
    
    // Check if it's the overall best (purple)
    if (overallBest) {
      const bestTime = parseTime(overallBest);
      if (currentTime <= bestTime) {
        return 'purple';
      }
    }
    
    // Check if it's a personal best (green)
    if (personalBest) {
      const pbTime = parseTime(personalBest);
      if (currentTime < pbTime) {
        return 'green';
      }
    }
    
    // Otherwise it's slower (yellow)
    return 'yellow';
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="sector-timing-widget">
        <div class="sector-header">
          <span class="sector-label">SECTOR TIMES</span>
        </div>
        <div class="sector-entries"></div>
      </div>
    `;
  }

  private updateDOM(): void {
    const entriesEl = this.container.querySelector('.sector-entries');
    if (!entriesEl) return;

    if (this.activeDrivers.size === 0) {
      entriesEl.innerHTML = '<div class="no-active">No active laps</div>';
      return;
    }

    let html = '';
    for (const [driver, state] of this.activeDrivers) {
      const color = this.driverColors[driver] || [255, 255, 255];
      
      html += `
        <div class="sector-entry" style="--driver-rgb: ${color[0]}, ${color[1]}, ${color[2]}">
          <span class="sector-driver">${driver}</span>
          <span class="sector-time ${state.sector1Status}">${state.sector1 || '-'}</span>
          <span class="sector-time ${state.sector2Status}">${state.sector2 || '-'}</span>
          <span class="sector-time ${state.sector3Status}">${state.sector3 || '-'}</span>
          ${state.lapTime ? `<span class="lap-time ${state.isPersonalBest ? 'pb' : ''}">${state.lapTime}</span>` : ''}
        </div>
      `;
    }

    entriesEl.innerHTML = html;
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
