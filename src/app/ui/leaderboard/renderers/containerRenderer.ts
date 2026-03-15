import type { SessionMode } from '../types';

/**
 * Render the main leaderboard container HTML
 */
export function renderLeaderboardContainer(sessionMode: SessionMode): string {
  if (sessionMode === 'qualifying') {
    return `
      <div class="leaderboard-header">
        <img src="/images/logos/F1.svg" alt="F1" class="f1-logo" />
      </div>
      <div class="quali-header">
        <span class="quali-phase q1">Q1</span>
        <span class="quali-timer">--:--</span>
      </div>
      <div class="race-flag-banner"></div>
      <div class="leaderboard-entries"></div>
    `;
  }
  
  // Race mode
  return `
    <div class="leaderboard-header">
      <img src="/images/logos/F1.svg" alt="F1" class="f1-logo" />
    </div>
    <div class="lap-counter">
      <span class="lap-label">LAP </span>
      <span class="lap-current">0</span>
      <span class="lap-total">/ 0</span>
    </div>
    <div class="race-flag-banner"></div>
    <div class="leaderboard-entries"></div>
  `;
}

/**
 * Update the lap counter display
 */
export function updateLapCounter(container: HTMLElement, currentLap: number, totalLaps: number): void {
  const lapCurrentEl = container.querySelector('.lap-current');
  const lapTotalEl = container.querySelector('.lap-total');
  
  if (lapCurrentEl) {
    lapCurrentEl.textContent = `${currentLap}`;
  }
  if (lapTotalEl) {
    lapTotalEl.textContent = `/ ${totalLaps}`;
  }
}

/**
 * Update the qualifying phase indicator
 */
export function updatePhaseIndicator(container: HTMLElement, phase: 'Q1' | 'Q2' | 'Q3', isSprint: boolean): void {
  const phaseEl = container.querySelector('.quali-phase');
  if (phaseEl) {
    const displayPhase = isSprint ? `S${phase}` : phase;
    phaseEl.textContent = displayPhase;
    phaseEl.className = `quali-phase ${phase.toLowerCase()}`;
  }
}

/**
 * Update the qualifying timer display
 */
export function updateQualiTimer(
  container: HTMLElement,
  remainingMs: number,
  isClockRunning: boolean,
  isPhaseStarted: boolean,
  isPhaseEnded: boolean
): void {
  const timerEl = container.querySelector('.quali-timer');
  if (!timerEl) return;

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  
  // Add styling classes based on time remaining and clock state
  timerEl.classList.remove('warning', 'ended', 'paused');
  if (totalSeconds === 0) {
    timerEl.classList.add('ended');
  } else if (!isClockRunning && isPhaseStarted && !isPhaseEnded) {
    timerEl.classList.add('paused');
  } else if (totalSeconds <= 60) {
    timerEl.classList.add('warning');
  }
}

/**
 * Update the flag banner display
 */
export function updateFlagBanner(container: HTMLElement, trackStatus: string | undefined): void {
  const banner = container.querySelector('.race-flag-banner') as HTMLElement;
  if (!banner) return;
  
  const status = trackStatus || '1';
  
  if (status === '1') {
    banner.classList.remove('visible');
    return;
  }
  
  let flagHtml = '';
  let flagClass = '';
  
  switch (status) {
    case '2':
      flagHtml = 'YELLOW FLAG';
      flagClass = 'yellow';
      break;
    case '4':
      flagHtml = '<img src="/images/logos/FIA.svg" alt="FIA" class="flag-logo" />SAFETY CAR';
      flagClass = 'safety-car';
      break;
    case '5':
      flagHtml = 'RED FLAG';
      flagClass = 'red';
      break;
    case '6':
    case '7':
      flagHtml = 'VIRTUAL SAFETY CAR';
      flagClass = 'vsc';
      break;
    default:
      banner.classList.remove('visible');
      return;
  }
  
  banner.innerHTML = flagHtml;
  banner.className = `race-flag-banner ${flagClass} visible`;
}
