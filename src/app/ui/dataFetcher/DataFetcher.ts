import { RenderSettings, type RenderSettingsConfig } from '../RenderSettings.js';
import { raceDataApi } from './api/raceDataApi';
import { Terminal } from './components/Terminal';
import { 
  renderYearSelector, 
  renderRaceSelector, 
  renderSessionSelector,
  renderAuthSection 
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
  private years: number[] = [];
  private races: Race[] = [];
  private sessions: Session[] = [];
  private cachedRaces: CachedRaces = {};
  private selectedYear: number = 2024;
  private selectedRound: number = 0;
  private selectedSession: string = '';
  private bearerToken: string = '';
  private isLoadingRaces: boolean = false;
  private isLoadingSessions: boolean = false;
  
  // Components
  private terminal: Terminal;
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
    this.terminal = new Terminal(container);
    this.renderSettings = new RenderSettings(container);
    this.init();
  }

  private async init(): Promise<void> {
    // Load only years list - don't auto-fetch races for faster initial load
    this.years = await raceDataApi.getYears();
    this.selectedYear = 0; // No year selected initially
    
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

        ${renderYearSelector(this.years, this.selectedYear)}
        ${renderRaceSelector(this.races, this.selectedRound, this.cachedRaces, this.isLoadingRaces)}
        ${renderSessionSelector(this.sessions, this.selectedSession, this.selectedRound, this.cachedRaces, this.isLoadingSessions)}
        ${renderAuthSection(this.bearerToken)}
        ${this.terminal.render()}

        <div id="message-container"></div>

        <div class="load-button-container">
          <button class="load-button" id="fetch-button">LOAD DATA & START</button>
        </div>
      </div>
    `;

    this.terminal.init();
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

    // Bearer token input
    this.setupTokenInput();

    // Option cards (year, race, session selection)
    this.setupOptionCards();
  }

  private setupTokenInput(): void {
    const tokenInput = this.container.querySelector('#bearer-token-input') as HTMLInputElement;
    if (!tokenInput) return;

    tokenInput.addEventListener('input', (e) => {
      this.bearerToken = (e.target as HTMLInputElement).value;
      if (this.bearerToken) {
        localStorage.setItem('f1_bearer_token', this.bearerToken);
      } else {
        localStorage.removeItem('f1_bearer_token');
      }
    });
    
    // Load saved token
    const savedToken = localStorage.getItem('f1_bearer_token');
    if (savedToken) {
      this.bearerToken = savedToken;
      tokenInput.value = savedToken;
    }
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
    
    if (!this.bearerToken || this.bearerToken.trim() === '') {
      this.showMessage(messageContainer, 'Please enter a Bearer token for authentication', 'error');
      return;
    }

    // Start loading
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner"></span>LOADING...';
    messageContainer.innerHTML = '';

    this.terminal.show();
    this.terminal.clear();
    this.terminal.setupWebSocketLogListener();

    try {
      // Check if data exists
      this.terminal.log('Checking data...', 'info');
      const exists = await raceDataApi.checkDataExists(year, round, sessionType);

      if (!exists) {
        // Fetch from FastF1
        this.terminal.log('Fetching from FastF1...', 'info');
        const fetchResult = await raceDataApi.fetchData(year, round, sessionType, this.bearerToken);
        
        if (!fetchResult.success) {
          throw new Error(fetchResult.error || 'Failed to fetch data');
        }
        this.terminal.log('✓ Data fetched successfully', 'success');
      } else {
        this.terminal.log('✓ Using cached data', 'success');
      }

      // Load telemetry
      this.terminal.log('Loading telemetry...', 'info');
      const loadData = await raceDataApi.loadTelemetry(year, round, sessionType, this.bearerToken);

      if (loadData.success) {
        this.terminal.log(`✓ Loaded ${loadData.totalFrames.toLocaleString()} frames`, 'success');
        this.terminal.log(`✓ ${loadData.drivers.length} drivers loaded`, 'success');
        this.terminal.log('Starting visualization...', 'info');
        
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
      this.terminal.log(`✗ Error: ${errorMessage}`, 'error');
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
