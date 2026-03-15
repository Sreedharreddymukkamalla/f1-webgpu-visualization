import type { TelemetryFrame } from '../playback/websocketClient';

export interface WeatherData {
  track_temp: number | null;
  air_temp: number | null;
  humidity: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  rain_state: 'DRY' | 'RAINING';
}

export class WeatherWidget {
  private container: HTMLElement;
  private currentWeather: WeatherData | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  /**
   * Convert wind direction in degrees to compass direction
   */
  private formatWindDirection(degrees: number | null): string {
    if (degrees === null) return 'N/A';
    
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round((degrees % 360) / 22.5) % dirs.length;
    return dirs[idx];
  }

  /**
   * Format a numeric value with suffix
   */
  private format(val: number | null, suffix: string = '', precision: number = 1): string {
    if (val === null) return 'N/A';
    return `${val.toFixed(precision)}${suffix}`;
  }

  /**
   * Update weather display from a telemetry frame
   */
  updateFromFrame(frame: TelemetryFrame): void {
    if (!frame.weather) {
      return;
    }
    
    this.currentWeather = frame.weather as WeatherData;
    this.updateDOM();
  }

  /**
   * Directly set weather data
   */
  setWeather(weather: WeatherData): void {
    this.currentWeather = weather;
    this.updateDOM();
  }

  private updateDOM(): void {
    if (!this.currentWeather) return;

    const w = this.currentWeather;

    // Update each value element
    const trackTempEl = this.container.querySelector('.weather-track-temp .weather-value');
    const airTempEl = this.container.querySelector('.weather-air-temp .weather-value');
    const humidityEl = this.container.querySelector('.weather-humidity .weather-value');
    const windEl = this.container.querySelector('.weather-wind .weather-value');
    const rainEl = this.container.querySelector('.weather-rain .weather-value');

    if (trackTempEl) trackTempEl.textContent = this.format(w.track_temp, '°C');
    if (airTempEl) airTempEl.textContent = this.format(w.air_temp, '°C');
    if (humidityEl) humidityEl.textContent = this.format(w.humidity, '%', 0);
    
    if (windEl) {
      const windSpeed = this.format(w.wind_speed, ' km/h');
      const windDir = this.formatWindDirection(w.wind_direction);
      windEl.textContent = `${windSpeed} ${windDir}`;
    }
    
    if (rainEl) {
      rainEl.textContent = w.rain_state || 'DRY';
      rainEl.className = `weather-value ${w.rain_state === 'RAINING' ? 'raining' : 'dry'}`;
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="weather-widget">
        <div class="weather-header">
          <svg class="weather-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>WEATHER</span>
        </div>
        <div class="weather-content">
          <div class="weather-row weather-track-temp">
            <span class="weather-label">Track</span>
            <span class="weather-value">--</span>
          </div>
          <div class="weather-row weather-air-temp">
            <span class="weather-label">Air</span>
            <span class="weather-value">--</span>
          </div>
          <div class="weather-row weather-humidity">
            <span class="weather-label">Humidity</span>
            <span class="weather-value">--</span>
          </div>
          <div class="weather-row weather-wind">
            <span class="weather-label">Wind</span>
            <span class="weather-value">--</span>
          </div>
          <div class="weather-row weather-rain">
            <span class="weather-label">Conditions</span>
            <span class="weather-value dry">DRY</span>
          </div>
        </div>
      </div>
    `;
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
