export type CarRenderMode = 'detailed' | 'lowpoly';

export interface RenderSettingsConfig {
  carRenderMode: CarRenderMode;
}

export type SettingsChangeCallback = (settings: RenderSettingsConfig) => void;

const DEFAULT_SETTINGS: RenderSettingsConfig = {
  carRenderMode: 'detailed',
};

const STORAGE_KEY = 'f1_render_settings';

// Global instance for access from main.ts
let globalRenderSettingsInstance: RenderSettings | null = null;

export function getRenderSettingsInstance(): RenderSettings | null {
  return globalRenderSettingsInstance;
}

export class RenderSettings {
  private container: HTMLElement;
  private isOpen: boolean = false;
  private settings: RenderSettingsConfig;
  private changeListeners: SettingsChangeCallback[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.settings = this.loadSettings();
    globalRenderSettingsInstance = this;
  }

  public onSettingsChange(callback: SettingsChangeCallback): void {
    this.changeListeners.push(callback);
  }

  private notifyListeners(): void {
    this.changeListeners.forEach(cb => cb(this.settings));
  }

  private loadSettings(): RenderSettingsConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch (error) {

    }
    return { ...DEFAULT_SETTINGS };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (error) {

    }
  }

  public getSettings(): RenderSettingsConfig {
    return { ...this.settings };
  }

  public renderToggleButton(): string {
    return `
      <button class="settings-toggle" id="settings-toggle" title="Graphics Settings">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      </button>
    `;
  }

  public renderPanel(): string {
    const isDetailed = this.settings.carRenderMode === 'detailed';
    const isLowPoly = this.settings.carRenderMode === 'lowpoly';

    return `
      <div class="settings-panel ${this.isOpen ? 'open' : ''}" id="settings-panel">
        <div class="settings-header">
          <h3>Graphics Settings</h3>
          <button class="settings-close" id="settings-close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="settings-content">
          <div class="settings-section">
            <div class="settings-section-title">Car Models</div>
            <div class="settings-option-group">
              <label class="settings-option ${isDetailed ? 'selected' : ''}" data-mode="detailed">
                <input type="radio" name="carRenderMode" value="detailed" ${isDetailed ? 'checked' : ''} />
                <div class="option-content">
                  <div class="option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M4 17h16M4 17l1-6h14l1 6M4 17l-2 2v1h20v-1l-2-2M7 11V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3M9 14h.01M15 14h.01"/>
                    </svg>
                  </div>
                  <div class="option-text">
                    <span class="option-label">Detailed 3D Models</span>
                    <span class="option-description">Full textured GLB car models</span>
                  </div>
                </div>
                <div class="option-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </label>
              <label class="settings-option ${isLowPoly ? 'selected' : ''}" data-mode="lowpoly">
                <input type="radio" name="carRenderMode" value="lowpoly" ${isLowPoly ? 'checked' : ''} />
                <div class="option-content">
                  <div class="option-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="12" r="6"/>
                    </svg>
                  </div>
                  <div class="option-text">
                    <span class="option-label">Low Poly</span>
                    <span class="option-description">Simple colored shapes for better performance</span>
                  </div>
                </div>
                <div class="option-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
      <div class="settings-overlay ${this.isOpen ? 'open' : ''}" id="settings-overlay"></div>
    `;
  }

  public attachEventListeners(): void {
    const toggleBtn = this.container.querySelector('#settings-toggle');
    const closeBtn = this.container.querySelector('#settings-close');
    const overlay = this.container.querySelector('#settings-overlay');
    const options = this.container.querySelectorAll('.settings-option');

    toggleBtn?.addEventListener('click', () => this.toggle());
    closeBtn?.addEventListener('click', () => this.close());
    overlay?.addEventListener('click', () => this.close());

    options.forEach((option) => {
      option.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const mode = target.dataset.mode as CarRenderMode;
        if (mode) {
          this.setCarRenderMode(mode);
        }
      });
    });
  }

  private setCarRenderMode(mode: CarRenderMode): void {
    this.settings.carRenderMode = mode;
    this.saveSettings();
    this.updateUI();
    this.notifyListeners();
  }

  private updateUI(): void {
    const options = this.container.querySelectorAll('.settings-option');
    options.forEach((option) => {
      const el = option as HTMLElement;
      const isSelected = el.dataset.mode === this.settings.carRenderMode;
      el.classList.toggle('selected', isSelected);
      const radio = el.querySelector('input[type="radio"]') as HTMLInputElement;
      if (radio) {
        radio.checked = isSelected;
      }
    });
  }

  public toggle(): void {
    this.isOpen = !this.isOpen;
    this.updatePanelVisibility();
  }

  public open(): void {
    this.isOpen = true;
    this.updatePanelVisibility();
  }

  public close(): void {
    this.isOpen = false;
    this.updatePanelVisibility();
  }

  private updatePanelVisibility(): void {
    const panel = this.container.querySelector('#settings-panel');
    const overlay = this.container.querySelector('#settings-overlay');
    
    if (panel) {
      panel.classList.toggle('open', this.isOpen);
    }
    if (overlay) {
      overlay.classList.toggle('open', this.isOpen);
    }
  }
}
