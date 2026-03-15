/**
 * Configuration for F1 Visualization Backend
 */
export const CONFIG = {
  // Ports
  PORTS: {
    PYTHON_API: 3002,
    NODE_SERVER: 3001,
    VITE_DEV: 5173,
  },

  // Telemetry Settings
  TELEMETRY: {
    FPS: 25, // Frames per second
    DT: 1 / 25, // Delta time
    FRAME_INTERVAL: 100, // MS between frames (at 1x speed)
    BUFFER_SIZE: 500, // Frames to buffer
  },

  // File Paths (relative to project root)
  PATHS: {
    TELEMETRY_DATA: 'public/data/telemetry',
    // CIRCUITS_DATA removed - tracks now built from telemetry
    COMPUTED_CACHE: 'backend/python/computed_data',
    FASTF1_CACHE: '.fastf1-cache',
    LOGS: 'logs',
  },

  // WebSocket Settings
  WEBSOCKET: {
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 2000, // 2 seconds
  },

  // API Settings
  API: {
    MAX_BUFFER_SIZE: 10 * 1024 * 1024, // 10MB for exec buffer
    REQUEST_TIMEOUT: 300000, // 5 minutes for data fetch
  },

  // Data Settings
  DATA: {
    MIN_YEAR: 2018, // Reliable FastF1 data from 2018
    MAX_DRIVERS: 20, // Max F1 drivers
    MIN_FRAMES: 100, // Minimum frames for valid race
  },
};

export default CONFIG;
