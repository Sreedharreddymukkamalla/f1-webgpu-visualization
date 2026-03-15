import type { RaceEvent } from '../types';
import { EVENT_TYPE_LABELS } from '../types';

/**
 * Draw all markers (lap markers and event markers) on the progress bar
 */
export function drawMarkers(
  container: HTMLElement,
  events: RaceEvent[],
  totalFrames: number,
  totalLaps: number,
  onMarkerHover: (tooltipText: string, x: number) => void,
  onMarkerLeave: () => void
): void {
  if (totalFrames <= 0) return;
  
  container.innerHTML = '';
  
  // Draw lap markers
  drawLapMarkers(container, totalLaps);
  
  // Draw event markers
  drawEventMarkers(container, events, totalFrames, onMarkerHover, onMarkerLeave);
}

/**
 * Draw lap markers on the timeline
 */
function drawLapMarkers(container: HTMLElement, totalLaps: number): void {
  if (totalLaps <= 1) return;
  
  for (let lap = 1; lap <= totalLaps; lap++) {
    const lapProgress = (lap / totalLaps) * 100;
    
    const line = document.createElement('div');
    line.className = 'lap-marker';
    line.style.left = `${lapProgress}%`;
    
    // Show lap numbers at intervals
    if (lap === 1 || lap === totalLaps || lap % 10 === 0) {
      const num = document.createElement('div');
      num.className = 'lap-number';
      num.textContent = lap.toString();
      num.style.left = `${lapProgress}%`;
      container.appendChild(num);
    }
    
    container.appendChild(line);
  }
}

/**
 * Draw event markers (DNF, flags, safety car, etc.)
 */
function drawEventMarkers(
  container: HTMLElement,
  events: RaceEvent[],
  totalFrames: number,
  onMarkerHover: (tooltipText: string, x: number) => void,
  onMarkerLeave: () => void
): void {
  const containerWidth = container.clientWidth || 1000;
  const minWidthPercent = (4 / containerWidth) * 100; // Minimum 4px width
  
  events.forEach((event) => {
    const startProgress = (event.frame / totalFrames) * 100;
    
    if (event.type === 'dnf') {
      // DNF markers are point markers
      const marker = document.createElement('div');
      marker.className = 'event-marker dnf';
      marker.style.left = `${startProgress}%`;
      marker.textContent = '×';
      attachMarkerTooltip(marker, event, onMarkerHover, onMarkerLeave);
      container.appendChild(marker);
    } else {
      // Flag/SC markers are segments
      const endFrame = event.endFrame || event.frame;
      const endProgress = (Math.min(endFrame, totalFrames) / totalFrames) * 100;
      const width = Math.max(minWidthPercent, endProgress - startProgress);
      
      const segment = document.createElement('div');
      segment.className = `flag-segment ${getFlagClass(event.type)}`;
      segment.style.left = `${startProgress}%`;
      segment.style.width = `${width}%`;
      attachMarkerTooltip(segment, event, onMarkerHover, onMarkerLeave);
      container.appendChild(segment);
    }
  });
}

/**
 * Get CSS class for flag type
 */
function getFlagClass(type: string): string {
  switch (type) {
    case 'yellow_flag': return 'yellow';
    case 'red_flag': return 'red';
    case 'safety_car': 
    case 'vsc': return 'sc';
    default: return '';
  }
}

/**
 * Attach tooltip behavior to a marker element
 */
function attachMarkerTooltip(
  element: HTMLElement,
  event: RaceEvent,
  onHover: (tooltipText: string, x: number) => void,
  onLeave: () => void
): void {
  let tooltipText = EVENT_TYPE_LABELS[event.type] || 'Event';
  if (event.label) tooltipText += `: ${event.label}`;
  if (event.lap) tooltipText += ` (Lap ${event.lap})`;

  element.addEventListener('mouseenter', (e) => {
    const rect = element.closest('.playback-progress-container')?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      onHover(tooltipText, x);
    }
  });

  element.addEventListener('mousemove', (e) => {
    const rect = element.closest('.playback-progress-container')?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      onHover(tooltipText, x);
    }
  });

  element.addEventListener('mouseleave', onLeave);
}

/**
 * Get tooltip text for a frame position near events
 */
export function getEventTooltipText(events: RaceEvent[], frame: number, totalFrames: number): string | null {
  const threshold = totalFrames * 0.02;
  const nearest = events.find(e => Math.abs(e.frame - frame) < threshold);
  
  if (!nearest) return null;
  
  let text = EVENT_TYPE_LABELS[nearest.type] || 'Event';
  if (nearest.label) text += `: ${nearest.label}`;
  if (nearest.lap) text += ` (Lap ${nearest.lap})`;
  
  return text;
}
