import { Visualizer } from './app/core/Visualizer';
import { DataFetcher } from './app/ui/dataFetcher/index.js';
import type { TrackData } from './app/circuit/trackRenderer.js';
import './styles/dataFetcher.css';
import './styles/playbackUI.css';
import './styles/leaderboard.css';
import './styles/weather.css';
import './styles/qualifying.css';

/**
 * Initialize the F1 visualization application.
 * 
 * Shows the DataFetcher UI first, which allows the user to select
 * a race/session. Once data is fetched, the Visualizer is initialized.
 */
function init(): void {
  const uiContainer = document.getElementById('app') || document.body;
  const fetcherContainer = document.createElement('div');
  uiContainer.appendChild(fetcherContainer);

  new DataFetcher(fetcherContainer, async (year: number, round: number, sessionType: string, trackData: TrackData) => {
    console.log(`✅ Data fetched for ${year} Round ${round} - ${sessionType}`);

    if (!trackData) {
      console.error('❌ No track data received from backend');
      return;
    }

    try {
      const visualizer = new Visualizer();
      await visualizer.init(trackData);
    } catch (error) {
      console.error('Failed to initialize visualization:', error);
      document.body.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h2>❌ Failed to initialize visualization</h2>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      `;
    }
  });
}

init();
