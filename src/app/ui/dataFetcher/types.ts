export interface Race {
  round: number;
  name: string;
  date?: string;
  country?: string;
  type?: string;
}

export interface Session {
  code: string;
  name: string;
}

export interface FetchResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CachedRaces {
  [round: number]: string[];
}

export interface DataFetcherState {
  years: number[];
  races: Race[];
  sessions: Session[];
  cachedRaces: CachedRaces;
  selectedYear: number;
  selectedRound: number;
  selectedSession: string;
  bearerToken: string;
  isLoadingRaces: boolean;
  isLoadingSessions: boolean;
}
