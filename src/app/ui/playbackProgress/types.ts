import type { PlaybackState } from '../../playback/playbackController';
import type { RaceEvent } from '../../playback/websocketClient';

export type { PlaybackState, RaceEvent };

export interface PlaybackProgressConfig {
  onSeek: (frame: number) => void;
  onAction: (action: string, value?: any) => void;
}

export type ActionType = 'togglePlay' | 'seekRelative' | 'changeSpeed' | 'changeStreamingMode';

export interface EventTypeLabels {
  [key: string]: string;
}

export const EVENT_TYPE_LABELS: EventTypeLabels = {
  dnf: 'DNF',
  yellow_flag: 'Yellow Flag',
  red_flag: 'Red Flag',
  safety_car: 'Safety Car',
  vsc: 'Virtual Safety Car'
};
