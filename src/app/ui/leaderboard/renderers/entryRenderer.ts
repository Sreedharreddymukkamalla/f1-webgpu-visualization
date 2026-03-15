import type { LeaderboardEntry, PitState, LiveQualifyingState } from '../types';
import { getTeamLogoPath, getTeamColorClass } from '../../TeamMapping.js';
import { getTyreCompound, getTyreImagePath } from '../utils/tyreUtils';

/**
 * Render a qualifying mode leaderboard entry
 */
export function renderQualifyingEntry(
  entry: LeaderboardEntry,
  displayPosition: number,
  liveState: LiveQualifyingState | undefined
): string {
  const teamLogoPath = getTeamLogoPath(entry.code);
  const teamColorClass = getTeamColorClass(entry.code);
  const tyreName = getTyreCompound(entry.tyre);
  const tyreImagePath = getTyreImagePath(entry.tyre);
  const isEliminated = liveState?.eliminated || false;
  const bestTime = liveState?.bestTimeStr || '-';

  return `
    <div class="driver-left">
      <div class="position">${displayPosition}</div>
      <span class="team-color-line ${teamColorClass}"></span>
      ${teamLogoPath ? `<img src="${teamLogoPath}" alt="${entry.code} team" class="team-logo" />` : ''}
      <div class="driver-code">${entry.code}</div>
    </div>
    <div class="driver-right quali-times">
      ${isEliminated ? `<span class="eliminated-label">Out</span>` : `
        <span class="quali-time best-time">${bestTime}</span>
        <img src="${tyreImagePath}" 
             alt="${tyreName}"
             class="tyre-indicator"
             title="${tyreName}" />
      `}
    </div>
  `;
}

/**
 * Render a race mode leaderboard entry
 */
export function renderRaceEntry(
  entry: LeaderboardEntry,
  displayPosition: number
): string {
  const teamLogoPath = getTeamLogoPath(entry.code);
  const teamColorClass = getTeamColorClass(entry.code);
  const tyreName = getTyreCompound(entry.tyre);
  const tyreImagePath = getTyreImagePath(entry.tyre);
  const isDrsActive = entry.drs >= 10;

  return `
    <div class="driver-left">
      <div class="position">${displayPosition}</div>
      <span class="team-color-line ${teamColorClass}"></span>
      ${teamLogoPath ? `<img src="${teamLogoPath}" alt="${entry.code} team" class="team-logo" />` : ''}
      <div class="driver-code">
        ${entry.code}
      </div>
    </div>
    <div class="driver-right">
      ${entry.isOut ? `<span class="eliminated-label">Out</span>` : `
        <span class="pit-label" 
              data-state="${entry.pitState}"
              style="color: rgb(${entry.color[0]}, ${entry.color[1]}, ${entry.color[2]})">
        </span>
        <div class="indicators">
          <div class="drs-indicator ${isDrsActive ? 'active' : ''}" 
               title="DRS ${isDrsActive ? 'Active' : 'Inactive'}">
          </div>
          <img src="${tyreImagePath}" 
               alt="${tyreName}"
               class="tyre-indicator"
               title="${tyreName}" />
        </div>
      `}
    </div>
  `;
}

/**
 * Update pit label with fade transitions
 */
export function updatePitLabel(
  pitLabel: HTMLElement,
  previousState: PitState,
  currentState: PitState,
  color: [number, number, number]
): void {
  // Update color
  pitLabel.style.color = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  
  // Handle state transitions with fade effects
  if (previousState !== currentState) {
    if (currentState === 'NONE') {
      // Fading out
      pitLabel.classList.remove('visible');
      setTimeout(() => {
        if (pitLabel.dataset.state === 'NONE') {
          pitLabel.textContent = '';
        }
      }, 300);
    } else if (previousState === 'NONE') {
      // Fading in
      const newText = currentState === 'IN_PIT' ? 'IN PIT' : 'PIT EXIT';
      pitLabel.textContent = newText;
      pitLabel.offsetHeight; // Trigger reflow
      pitLabel.classList.add('visible');
    } else {
      // Text is changing
      pitLabel.classList.remove('visible');
      setTimeout(() => {
        const newText = currentState === 'IN_PIT' ? 'IN PIT' : 'PIT EXIT';
        pitLabel.textContent = newText;
        pitLabel.dataset.state = currentState;
        pitLabel.offsetHeight;
        pitLabel.classList.add('visible');
      }, 300);
    }
  }
  
  pitLabel.dataset.state = currentState;
}

/**
 * Update DRS indicator
 */
export function updateDrsIndicator(element: Element | null, isActive: boolean): void {
  if (!element) return;
  
  if (isActive) {
    element.classList.add('active');
  } else {
    element.classList.remove('active');
  }
}

/**
 * Update tyre indicator image
 */
export function updateTyreIndicator(element: HTMLImageElement | null, tyreCode: number): void {
  if (!element) return;
  
  const tyreImagePath = getTyreImagePath(tyreCode);
  const tyreName = getTyreCompound(tyreCode);
  
  if (element.src !== tyreImagePath) {
    element.src = tyreImagePath;
    element.alt = tyreName;
    element.title = tyreName;
  }
}

/**
 * Build CSS class string for entry element
 */
export function buildEntryClassName(options: {
  isOut: boolean;
  isSelected: boolean;
  isLeader: boolean;
  isInDangerZone: boolean;
  isEliminated: boolean;
}): string {
  const classes = ['leaderboard-entry'];
  
  if (options.isOut) classes.push('out');
  if (options.isSelected) classes.push('selected');
  if (options.isLeader) classes.push('leader');
  if (options.isInDangerZone) classes.push('danger-zone');
  if (options.isEliminated) classes.push('eliminated');
  
  return classes.join(' ');
}
