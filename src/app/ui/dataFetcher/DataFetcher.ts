import { RenderSettings, type RenderSettingsConfig } from '../RenderSettings.js';
import { raceDataApi } from './api/raceDataApi';
import { 
  renderRaceSelector, 
  renderSessionSelector
} from './components/Selectors';
import type { Race, Session, CachedRaces } from './types';

/**
 * DataFetcher component handles the UI for selecting and loading F1 race data.
 * It provides year, race, and session selection along with authentication and
 * a terminal for displaying fetch progress.
 */
export class DataFetcher {
  private container: HTMLElement;
  
  // State
  private races: Race[] = [];
  private sessions: Session[] = [];
  private cachedRaces: CachedRaces = {};
  private selectedYear: number = 2024;
  private selectedRound: number = 0;
  private selectedSession: string = '';
  private bearerToken: string = 'MCT';
  private isLoadingRaces: boolean = false;
  private isLoadingSessions: boolean = false;
  
  // Components
  private renderSettings: RenderSettings;
  
  // Callback
  private onDataFetched?: (
    year: number, 
    round: number, 
    sessionType: string, 
    trackData: any, 
    renderSettings: RenderSettingsConfig
  ) => void;

  constructor(
    container: HTMLElement, 
    onDataFetched?: (
      year: number, 
      round: number, 
      sessionType: string, 
      trackData: any, 
      renderSettings: RenderSettingsConfig
    ) => void
  ) {
    this.container = container;
    this.onDataFetched = onDataFetched;
    this.renderSettings = new RenderSettings(container);
    this.init();
  }

  private async init(): Promise<void> {
    this.selectedYear = 2025;
    this.isLoadingRaces = true;
    this.render();

    this.races = await raceDataApi.getRaces(2025);
    this.cachedRaces = await raceDataApi.getCachedStatus(2025);
    this.isLoadingRaces = false;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="data-fetcher">
        ${this.renderSettings.renderToggleButton()}
        ${this.renderSettings.renderPanel()}
        
        <div class="data-fetcher-header">
          <h1>F1 VISUALIZATION</h1>
          <div class="divider"></div>
        </div>

        ${renderRaceSelector(this.races, this.selectedRound, this.cachedRaces, this.isLoadingRaces)}
        ${renderSessionSelector(this.sessions, this.selectedSession, this.selectedRound, this.cachedRaces, this.isLoadingSessions)}

        <div id="message-container"></div>

        <div class="load-button-container">
          <button class="load-button" id="fetch-button">LOAD DATA & START</button>
        </div>
      </div>
    `;

    this.attachEventListeners();
    this.renderSettings.attachEventListeners();
    this.updateButtonState();
  }

  private updateButtonState(): void {
    const button = this.container.querySelector('#fetch-button') as HTMLButtonElement;
    if (!button) return;

    const isValid = this.selectedYear !== 0 && this.selectedRound !== 0 && this.selectedSession !== '';
    button.disabled = !isValid;
  }

  private attachEventListeners(): void {
    // Fetch button
    const button = this.container.querySelector('#fetch-button') as HTMLButtonElement;
    button?.addEventListener('click', () => this.handleFetch());

    // Option cards (year, race, session selection)
    this.setupOptionCards();
  }

  private setupOptionCards(): void {
    this.container.querySelectorAll('.option-card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const target = e.currentTarget as HTMLElement;
        const type = target.dataset.type;
        const value = target.dataset.value;

        switch (type) {
          case 'year':
            await this.handleYearSelect(parseInt(value!));
            break;
          case 'race':
            await this.handleRaceSelect(parseInt(value!));
            break;
          case 'session':
            this.handleSessionSelect(value!);
            break;
        }
      });
    });
  }

  private async handleYearSelect(year: number): Promise<void> {
    this.selectedYear = year;
    this.selectedRound = 0;
    this.selectedSession = '';
    this.isLoadingRaces = true;
    this.races = [];
    this.sessions = [];
    this.render();
    
    this.races = await raceDataApi.getRaces(this.selectedYear);
    this.cachedRaces = await raceDataApi.getCachedStatus(this.selectedYear);
    this.isLoadingRaces = false;
    this.render();
    this.updateButtonState();
  }

  private async handleRaceSelect(round: number): Promise<void> {
    this.selectedRound = round;
    this.selectedSession = '';
    this.isLoadingSessions = true;
    this.sessions = [];
    this.render();
    
    this.sessions = await raceDataApi.getSessions(this.selectedYear, this.selectedRound);
    
    // Auto-select "Race" session as default
    const raceSession = this.sessions.find(s => s.code === 'R');
    if (raceSession) {
      this.selectedSession = 'R';
    }
    
    this.isLoadingSessions = false;
    this.render();
    this.updateButtonState();
  }

  private handleSessionSelect(sessionCode: string): void {
    this.selectedSession = sessionCode;
    this.container.querySelectorAll('.option-card[data-type="session"]').forEach(c => {
      c.classList.remove('selected');
    });
    const selected = this.container.querySelector(`.option-card[data-type="session"][data-value="${sessionCode}"]`);
    selected?.classList.add('selected');
    this.updateButtonState();
  }

  private async handleFetch(): Promise<void> {
    const button = this.container.querySelector('#fetch-button') as HTMLButtonElement;
    const messageContainer = this.container.querySelector('#message-container') as HTMLElement;

    const { selectedYear: year, selectedRound: round, selectedSession: sessionType } = this;

    // Validation
    if (!round || !sessionType) {
      this.showMessage(messageContainer, 'Please select a Grand Prix and Session first', 'error');
      return;
    }

    // Start loading
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner"></span>LOADING...';
    messageContainer.innerHTML = '';

    try {
      // Check if data exists
      const exists = await raceDataApi.checkDataExists(year, round, sessionType);

      if (!exists) {
        // Fetch from FastF1
        const fetchResult = await raceDataApi.fetchData(year, round, sessionType, this.bearerToken);
        
        if (!fetchResult.success) {
          throw new Error(fetchResult.error || 'Failed to fetch data');
        }
      }

      // Load telemetry
      const loadData = await raceDataApi.loadTelemetry(year, round, sessionType, this.bearerToken);

      if (loadData.success) {
        this.showMessage(messageContainer, '✓ Data loaded successfully', 'success');

        // Wait a moment, then initialize visualization
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (this.onDataFetched) {
          await this.onDataFetched(year, round, sessionType, loadData.track, this.renderSettings.getSettings());
          this.container.style.display = 'none';
        }
      } else {
        throw new Error(loadData.error || 'Failed to load data');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.showMessage(messageContainer, `✗ ${errorMessage}`, 'error');
      
      // Re-enable button on error
      button.disabled = false;
      button.textContent = 'LOAD DATA & START';
    }
  }

  private showMessage(container: HTMLElement, message: string, type: 'success' | 'error'): void {
    container.innerHTML = `<div class="message ${type}">${message}</div>`;
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}
