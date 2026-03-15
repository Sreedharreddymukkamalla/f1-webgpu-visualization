import type { Race, Session, CachedRaces } from '../types';

const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

/**
 * Render year selector cards
 */
export function renderYearSelector(years: number[], selectedYear: number): string {
  return `
    <div class="section">
      <div class="section-title">Select Year</div>
      <div class="option-grid years">
        ${years.map(year => `
          <div class="option-card ${year === selectedYear ? 'selected' : ''}" data-type="year" data-value="${year}">
            <div class="check-icon">${CHECK_ICON}</div>
            <div class="option-text">${year}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render race selector cards
 */
export function renderRaceSelector(
  races: Race[], 
  selectedRound: number, 
  cachedRaces: CachedRaces,
  isLoading: boolean
): string {
  return `
    <div class="section">
      <div class="section-title">Select Grand Prix</div>
      <div class="option-grid races">
        ${isLoading ? renderRaceSkeletons() : 
          races.length === 0 ? renderRacePlaceholder() :
          races.map(race => {
          const cached = cachedRaces[race.round] || [];
          const hasCached = cached.length > 0;
          return `
          <div class="option-card ${race.round === selectedRound ? 'selected' : ''} ${hasCached ? 'cached' : ''}" data-type="race" data-value="${race.round}">
            <div class="check-icon">${CHECK_ICON}</div>
            ${hasCached ? '<div class="cached-badge">CACHED</div>' : ''}
            <div class="round-label">ROUND ${race.round}</div>
            <div class="option-text">${race.name}</div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

/**
 * Render session selector cards
 */
export function renderSessionSelector(
  sessions: Session[], 
  selectedSession: string, 
  selectedRound: number,
  cachedRaces: CachedRaces,
  isLoading: boolean
): string {
  return `
    <div class="section">
      <div class="section-title">Select Session</div>
      <div class="option-grid sessions">
        ${isLoading ? renderSessionSkeletons() : 
          selectedRound === 0 ? renderSessionPlaceholder() :
          sessions.map(session => {
          const cachedSessions = cachedRaces[selectedRound] || [];
          const isSessionCached = cachedSessions.includes(session.code);
          return `
          <div class="option-card ${session.code === selectedSession ? 'selected' : ''} ${isSessionCached ? 'cached' : ''}" data-type="session" data-value="${session.code}">
            <div class="check-icon">${CHECK_ICON}</div>
            ${isSessionCached ? '<div class="cached-badge">CACHED</div>' : ''}
            <div class="option-text">${session.name}</div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;
}

/**
 * Render authentication section
 */
export function renderAuthSection(bearerToken: string): string {
  return `
    <div class="section token-section">
      <div class="section-title">Authentication <span class="required-badge">REQUIRED</span></div>
      <div class="token-input-container">
        <input 
          type="password" 
          id="bearer-token-input" 
          class="token-input" 
          placeholder="Enter Bearer Token"
          value="${bearerToken}"
        />
      </div>
    </div>
  `;
}

/**
 * Render placeholder when no year is selected
 */
function renderRacePlaceholder(): string {
  return `
    <div class="placeholder-message">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <p>Please select a year to view Grand Prix</p>
    </div>
  `;
}

/**
 * Render placeholder when no Grand Prix is selected
 */
function renderSessionPlaceholder(): string {
  return `
    <div class="placeholder-message compact">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      <p>Please select a Grand Prix to view sessions</p>
    </div>
  `;
}

/**
 * Render skeleton loaders for races
 */
function renderRaceSkeletons(): string {
  const skeletons = [];
  for (let i = 0; i < 24; i++) {
    skeletons.push(`
      <div class="option-card skeleton">
        <div class="skeleton-round"></div>
        <div class="skeleton-text"></div>
      </div>
    `);
  }
  return skeletons.join('');
}

/**
 * Render skeleton loaders for sessions
 */
function renderSessionSkeletons(): string {
  const skeletons = [];
  for (let i = 0; i < 4; i++) {
    skeletons.push(`
      <div class="option-card skeleton">
        <div class="skeleton-text"></div>
      </div>
    `);
  }
  return skeletons.join('');
}
