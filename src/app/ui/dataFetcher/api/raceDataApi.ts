import type { Race, Session, FetchResponse, CachedRaces } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * API client for fetching F1 race data
 */
export class RaceDataApi {
  /**
   * Fetch available years
   */
  async getYears(): Promise<number[]> {
    try {
      const response = await fetch(`${API_URL}/years`);
      const data = await response.json();
      if (data.success) {
        return data.years;
      }
      return [2024, 2023, 2022]; // Fallback
    } catch (error) {

      return [2024, 2023, 2022];
    }
  }

  /**
   * Fetch races for a specific year
   */
  async getRaces(year: number): Promise<Race[]> {
    try {
      const response = await fetch(`${API_URL}/races?year=${year}`);
      const data = await response.json();
      if (data.success) {
        return data.races;
      }
      return [];
    } catch (error) {

      return [];
    }
  }

  /**
   * Fetch sessions for a specific race
   */
  async getSessions(year: number, round: number): Promise<Session[]> {
    try {
      const response = await fetch(`${API_URL}/sessions?year=${year}&round=${round}`);
      const data = await response.json();
      if (data.success) {
        return data.sessions;
      }
      return this.getDefaultSessions();
    } catch (error) {

      return this.getDefaultSessions();
    }
  }

  /**
   * Fetch cached status for a year
   */
  async getCachedStatus(year: number): Promise<CachedRaces> {
    try {
      const response = await fetch(`${API_URL}/cached/${year}`);
      const data = await response.json();
      if (data.success) {
        return data.cached;
      }
      return {};
    } catch (error) {

      return {};
    }
  }

  /**
   * Check if data exists for a session
   */
  async checkDataExists(year: number, round: number, sessionType: string): Promise<boolean> {
    const response = await fetch(`${API_URL}/check/${year}/${round}/${sessionType}`);
    const data = await response.json();
    return data.exists;
  }

  /**
   * Fetch data from FastF1
   */
  async fetchData(year: number, round: number, sessionType: string, bearerToken: string): Promise<FetchResponse> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }
    
    const response = await fetch(`${API_URL}/fetch`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ year, round, sessionType }),
    });

    return response.json();
  }

  /**
   * Load telemetry data
   */
  async loadTelemetry(year: number, round: number, sessionType: string, bearerToken: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }
    
    const response = await fetch(`${API_URL}/load`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ year, round, sessionType }),
    });

    return response.json();
  }

  private getDefaultSessions(): Session[] {
    return [
      { code: 'Q', name: 'Qualifying' },
      { code: 'R', name: 'Race' },
    ];
  }
}

// Singleton instance
export const raceDataApi = new RaceDataApi();
