#!/usr/bin/env node
import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream, existsSync, readdirSync, readFileSync } from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
import { decode } from '@msgpack/msgpack';

const execPromise = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PYTHON_CMD = process.platform === 'win32' ? 'python' : 'python3';

// ============================================================================
// Streaming Modes (for research: simulating different data sources)
// ============================================================================
const STREAMING_MODES = {
  replay: {
    name: 'Replay (25 FPS)',
    interval: 40,      // 1000/25 = 40ms
  },
  live: {
    name: 'Live Sim (270ms)',
    interval: 270,     // OpenF1 WebSocket update rate
  },
  polling: {
    name: 'REST Polling (500ms)',
    interval: 500,     // OpenF1 REST API update rate
  }
};

let currentStreamingMode = 'replay'; // Default mode

// ============================================================================
// REST API Endpoints (Unified - No Flask dependency required)
// ============================================================================

// Static years list - no Python needed
app.get('/api/years', (req, res) => {
  const years = [];
  for (let y = 2025; y >= 2018; y--) {
    years.push(y);
  }
  res.json({ success: true, years });
});

// Get races for a year - spawns Python on-demand
app.get('/api/races', async (req, res) => {
  const year = req.query.year;
  
  if (!year) {
    return res.status(400).json({
      success: false,
      error: 'Year parameter is required'
    });
  }

  try {
    console.log(`Fetching races for ${year}...`);
    
    const pythonScript = path.join(__dirname, '../python/get_races.py');
    const command = `${PYTHON_CMD} "${pythonScript}" ${year}`;
    
    const { stdout, stderr } = await execPromise(command, {
      timeout: 30000, // 30 second timeout
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    
    const result = JSON.parse(stdout);
    
    if (result.success) {
      console.log(`✓ Found ${result.races.length} races for ${year}`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching races:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sessions for a race - spawns Python on-demand
app.get('/api/sessions', async (req, res) => {
  const { year, round } = req.query;
  
  if (!year || !round) {
    return res.status(400).json({
      success: false,
      error: 'Year and round parameters are required'
    });
  }

  try {
    const pythonScript = path.join(__dirname, '../python/get_sessions.py');
    const command = `${PYTHON_CMD} "${pythonScript}" ${year} ${round}`;
    
    const { stdout } = await execPromise(command, {
      timeout: 30000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    
    const result = JSON.parse(stdout);
    res.json(result);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'F1 Unified Server',
    pythonMode: 'on-demand'
  });
});

// Serve telemetry files (so Vercel frontend can fetch from Railway backend)
app.get('/data/telemetry/:year/:filename', (req, res) => {
  const { year, filename } = req.params;
  
  // Security: Only allow .msgpack and .json files
  if (!filename.endsWith('.msgpack') && !filename.endsWith('.json')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid file type. Only .msgpack and .json allowed.'
    });
  }
  
  const filePath = path.join(__dirname, '../../public/data/telemetry', year, filename);
  
  if (!existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }
  
  console.log(`Serving telemetry file: ${filename}`);
  res.sendFile(filePath);
});

app.get('/api/check/:year/:round/:sessionType', async (req, res) => {
  const { year, round, sessionType } = req.params;

  try {
    // Try to find the file by scanning the directory
    const telemetryDir = path.join(__dirname, '../../public/data/telemetry', String(year));

    if (!existsSync(telemetryDir)) {
      return res.json({
        success: true,
        exists: false,
        path: null,
      });
    }

    const files = readdirSync(telemetryDir);
    const sessionSuffix = sessionType === 'Q' ? 'qualifying' : 
                         sessionType === 'SQ' ? 'sprint-qualifying' :
                         sessionType === 'S' ? 'sprint' : 'race';
    const roundPrefix = String(round).padStart(2, '0');

    // Find file matching pattern: 01-*_race.msgpack or 01-*_race.json
    let matchingFile = files.find((f) => f.startsWith(roundPrefix) && f.endsWith(`_${sessionSuffix}.msgpack`));
    if (!matchingFile) {
      matchingFile = files.find((f) => f.startsWith(roundPrefix) && f.endsWith(`_${sessionSuffix}.json`));
    }

    if (matchingFile) {
      const fullPath = path.join(telemetryDir, matchingFile);
      res.json({
        success: true,
        exists: true,
        path: fullPath,
      });
    } else {
      res.json({
        success: true,
        exists: false,
        path: null,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get('/api/cached/:year', async (req, res) => {
  const { year } = req.params;

  try {
    const telemetryDir = path.join(__dirname, '../../public/data/telemetry', String(year));
    const cached = {};

    if (existsSync(telemetryDir)) {
      const files = readdirSync(telemetryDir);
      
      files.forEach(file => {
        // Match both .msgpack and .json files
        const match = file.match(/^(\d+)-.*_(race|qualifying|sprint-qualifying|sprint)\.(msgpack|json)$/);
        if (match) {
          const round = parseInt(match[1], 10);
          const session = match[2] === 'race' ? 'R' : 
                         match[2] === 'qualifying' ? 'Q' : 
                         match[2] === 'sprint-qualifying' ? 'SQ' :
                         'S';
          
          if (!cached[round]) cached[round] = [];
          if (!cached[round].includes(session)) {
            cached[round].push(session);
          }
        }
      });
    }

    res.json({ success: true, cached });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/fetch', async (req, res) => {
  const { year, round, sessionType = 'R' } = req.body;

  if (!year || !round) {
    return res.status(400).json({
      success: false,
      error: 'Year and round are required',
    });
  }

  try {
    console.log(`\nFetching F1 data: ${year} Round ${round} (${sessionType})`);

    const pythonScript = path.join(__dirname, '../python/fetch_race_data.py');
    
    // Use spawn for real-time output streaming
    // -u flag makes Python unbuffered for real-time output
    const pythonProcess = spawn(PYTHON_CMD, ['-u', pythonScript, year.toString(), round.toString(), sessionType], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    
    let stdoutData = '';
    let stderrData = '';
    
    // Stream stdout to all WebSocket clients
    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutData += output;
      
      // Broadcast to all connected WebSocket clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({
            type: 'log',
            message: output.trim(),
            level: 'info'
          }));
        }
      });
      
      // Also log to console
      process.stdout.write(output);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderrData += output;
      
      // Broadcast stderr to WebSocket clients (warnings, etc)
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          // Don't send FastF1 cache INFO/WARNING messages
          if (!output.includes('INFO:') && !output.includes('WARNING:')) {
            client.send(JSON.stringify({
              type: 'log',
              message: output.trim(),
              level: 'error'
            }));
          }
        }
      });
    });
    
    // Wait for process to complete
    await new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderrData}`));
        } else {
          resolve();
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(error);
      });
    });

    console.log('✓ Data fetched successfully');

    // Parse the JSON output from Python script
    let fileInfo = null;
    const jsonMatch = stdoutData.match(/__OUTPUT_JSON__:(.*)/);
    if (jsonMatch) {
      fileInfo = JSON.parse(jsonMatch[1]);
      console.log(`File created: ${fileInfo.file}`);
      console.log(`Frames: ${fileInfo.frames}, Size: ${fileInfo.size_mb} MB`);
    }

    res.json({
      success: true,
      message: `Data fetched for ${year} Round ${round} - ${sessionType}`,
      fileInfo,
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post('/api/load', async (req, res) => {
  const { year, round, sessionType = 'R' } = req.body;

  if (!year || !round) {
    return res.status(400).json({
      success: false,
      error: 'Year and round are required',
    });
  }

  try {
    // Find the telemetry file by scanning directory
    const telemetryDir = path.join(__dirname, '../../public/data/telemetry', String(year));

    if (!existsSync(telemetryDir)) {
      return res.status(404).json({
        success: false,
        error: 'Telemetry directory not found. Please fetch the data first.',
      });
    }

    const files = readdirSync(telemetryDir);
    const sessionSuffix = sessionType === 'Q' ? 'qualifying' : 
                         sessionType === 'SQ' ? 'sprint-qualifying' :
                         sessionType === 'S' ? 'sprint' : 'race';
    const roundPrefix = String(round).padStart(2, '0');

    // Look for MessagePack file first, fallback to JSON for backwards compatibility
    let matchingFile = files.find((f) => f.startsWith(roundPrefix) && f.endsWith(`_${sessionSuffix}.msgpack`));
    const isMsgPack = !!matchingFile;
    
    if (!matchingFile) {
      matchingFile = files.find((f) => f.startsWith(roundPrefix) && f.endsWith(`_${sessionSuffix}.json`));
    }

    if (!matchingFile) {
      return res.status(404).json({
        success: false,
        error: 'Telemetry file not found. Please fetch the data first.',
      });
    }

    const filePath = path.join(telemetryDir, matchingFile);
    console.log(`Loading telemetry: ${filePath}`);

    let data;
    if (isMsgPack) {
      // MessagePack: Read binary file and decode (10-100x faster than JSON)
      console.log('Using MessagePack decoder (fast path)');
      const buffer = readFileSync(filePath);
      data = decode(buffer);
    } else {
      // Fallback: JSON streaming for legacy files
      console.log('Using JSON streaming parser (legacy)');
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const { parser } = require('stream-json');
      const { streamObject } = require('stream-json/streamers/StreamObject');
      const { chain } = require('stream-chain');
      
      data = await new Promise((resolve, reject) => {
        const result = {
          telemetry: { frames: [] },
          driver_colors: {},
          driver_teams: {},
          total_laps: 0,
          track: null,
        };

        const pipeline = chain([
          createReadStream(filePath),
          parser(),
          streamObject(),
        ]);

        pipeline.on('data', ({ key, value }) => {
          if (key === 'telemetry') result.telemetry = value;
          else if (key === 'driver_colors') result.driver_colors = value;
          else if (key === 'driver_teams') result.driver_teams = value;
          else if (key === 'total_laps') result.total_laps = value;
          else if (key === 'track') result.track = value;
        });

        pipeline.on('end', () => resolve(result));
        pipeline.on('error', (err) => reject(err));
      });
    }

    // Validate structure
    if (!data.telemetry || !data.telemetry.frames) {
      throw new Error('Invalid telemetry data structure');
    }

    const frames = data.telemetry.frames;
    const driverColors = data.driver_colors || {};
    const driverTeams = data.driver_teams || {};
    const totalLaps = data.total_laps || 0;
    const track = data.track || null;

    console.log(`✓ Loaded ${frames.length} frames into memory`);
    if (track) {
      console.log(`✓ Track data loaded: ${track.centerline?.x?.length || 0} points`);
    }

    // Store in global state for WebSocket streaming
    const extractedEvents = extractRaceEvents(frames);
    console.log(`📍 Extracted ${extractedEvents.length} events for WebSocket streaming`);
    
    // Extract qualifying metadata if present
    const qualifying = data.qualifying || null;
    if (qualifying) {
      console.log(`✓ Qualifying metadata: ${qualifying.results?.length || 0} drivers`);
    }
    
    global.currentTelemetry = {
      frames,
      driverColors,
      driverTeams,
      totalLaps,
      track,
      metadata: { year, round, sessionType },
      events: extractedEvents,
      sessionType: data.session_type || sessionType,
      qualifying
    };

    res.json({
      success: true,
      totalFrames: frames.length,
      drivers: Object.keys(driverColors),
      totalLaps,
      track,
      eventsCount: extractedEvents.length,  // Debug: show event count in response
    });
  } catch (error) {
    console.error('Load error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ============================================================================
// WebSocket Streaming
// ============================================================================

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Playback state
let playbackState = {
  isPlaying: false,
  currentFrame: 0,
  speed: 1.0,
  interval: null,
};

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send initial state
  if (global.currentTelemetry) {
    // Ensure events are extracted even if data was loaded by an older server version
    if (!global.currentTelemetry.events) {
      global.currentTelemetry.events = extractRaceEvents(global.currentTelemetry.frames);
    }
    
    ws.send(
      JSON.stringify({
        type: 'metadata',
        data: {
          totalFrames: global.currentTelemetry.frames.length,
          driverColors: global.currentTelemetry.driverColors,
          driverTeams: global.currentTelemetry.driverTeams,
          totalLaps: global.currentTelemetry.totalLaps,
          events: global.currentTelemetry.events,
          sessionType: global.currentTelemetry.sessionType || 'R',
          qualifying: global.currentTelemetry.qualifying
        }
      })
    );

    // Send first frame immediately to position cars on starting grid
    if (global.currentTelemetry.frames.length > 0) {
      const firstFrame = global.currentTelemetry.frames[0];
      ws.send(
        JSON.stringify({
          type: 'frame',
          frameNumber: 0,
          data: firstFrame,
        })
      );
      console.log('✓ Sent initial frame (0) for car positioning');
    }
  } else {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'No telemetry loaded. Please load data first.',
      })
    );
  }

  // Handle client messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleCommand(data.command, data.value, ws);
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: error.message,
        })
      );
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

/**
/**
 * Playback controls
 */
function handleCommand(command, value, ws) {
  if (!global.currentTelemetry) {
    ws.send(
      JSON.stringify({
        type: 'error',
        message: 'No telemetry loaded',
      })
    );
    return;
  }

  switch (command) {
    case 'start':
      startPlayback();
      break;

    case 'pause':
      pausePlayback();
      break;

    case 'stop':
      stopPlayback();
      break;

    case 'seek':
      if (typeof value === 'number') {
        seekToFrame(value);
      }
      break;

    case 'speed':
      if (typeof value === 'number') {
        setPlaybackSpeed(value);
      }
      break;

    case 'mode':
      if (value && STREAMING_MODES[value]) {
        setStreamingMode(value, ws);
      } else {
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown mode: ${value}. Available: ${Object.keys(STREAMING_MODES).join(', ')}`
        }));
      }
      break;

    case 'getModes':
      ws.send(JSON.stringify({
        type: 'modes',
        modes: STREAMING_MODES,
        current: currentStreamingMode
      }));
      break;

    default:
      ws.send(
        JSON.stringify({
          type: 'error',
          message: `Unknown command: ${command}`,
        })
      );
  }
}

function startPlayback() {
  if (playbackState.isPlaying) return;

  playbackState.isPlaying = true;
  
  const modeConfig = STREAMING_MODES[currentStreamingMode];
  const sendInterval = modeConfig.interval / playbackState.speed;
  const FPS = 25;
  const tickInterval = 1000 / FPS; // 40ms for 25 FPS
  
  console.log(`Playback started [Mode: ${modeConfig.name}]`);
  console.log(`  └── Background ticker: ${tickInterval}ms (25 FPS real-time)`);
  console.log(`  └── Send interval: ${sendInterval}ms`);

  // BACKGROUND TICKER: Always runs at 25 FPS (real-time simulation)
  // This keeps the "race clock" ticking regardless of send mode
  playbackState.tickerInterval = setInterval(() => {
    if (!global.currentTelemetry) return;
    
    playbackState.currentFrame++;
    
    // Loop back to start
    if (playbackState.currentFrame >= global.currentTelemetry.frames.length) {
      playbackState.currentFrame = 0;
    }
  }, tickInterval / playbackState.speed);

  // SEND INTERVAL: How often we push data to clients (mode-dependent)
  // Just sends whatever the current frame is at that moment
  playbackState.interval = setInterval(() => {
    if (!global.currentTelemetry) {
      stopPlayback();
      return;
    }

    const frame = global.currentTelemetry.frames[playbackState.currentFrame];

    // Broadcast current frame to all connected clients
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(
          JSON.stringify({
            type: 'frame',
            frameNumber: playbackState.currentFrame,
            data: frame,
            mode: currentStreamingMode,
            interval: modeConfig.interval,
          })
        );
      }
    });
  }, sendInterval);
}

function pausePlayback() {
  playbackState.isPlaying = false;
  
  // Clear both intervals
  if (playbackState.interval) {
    clearInterval(playbackState.interval);
    playbackState.interval = null;
  }
  if (playbackState.tickerInterval) {
    clearInterval(playbackState.tickerInterval);
    playbackState.tickerInterval = null;
  }
  
  console.log('Playback paused');
}

function stopPlayback() {
  pausePlayback();
  playbackState.currentFrame = 0;
  console.log('Playback stopped');
}

function seekToFrame(frameNumber) {
  playbackState.currentFrame = Math.max(0, Math.min(frameNumber, global.currentTelemetry.frames.length - 1));
  console.log(`Seeked to frame ${playbackState.currentFrame}`);
}

function setPlaybackSpeed(speed) {
  playbackState.speed = Math.max(0.1, Math.min(speed, 16.0)); // Support up to 16x
  console.log(`Playback speed set to ${playbackState.speed}x`);

  // Restart playback with new speed if playing
  if (playbackState.isPlaying) {
    pausePlayback();
    startPlayback();
  }
}

function setStreamingMode(mode, ws) {
  const wasPlaying = playbackState.isPlaying;
  
  // Pause if playing
  if (wasPlaying) {
    pausePlayback();
  }
  
  currentStreamingMode = mode;
  const modeConfig = STREAMING_MODES[mode];
  
  console.log(`Streaming mode changed to: ${modeConfig.name}`);
  
  // Notify all clients of mode change
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        type: 'modeChanged',
        mode: mode,
        config: modeConfig
      }));
    }
  });
  
  // Resume if was playing
  if (wasPlaying) {
    startPlayback();
  }
}
function extractRaceEvents(frames) {
  const events = [];
  if (!frames || frames.length === 0) return events;

  let prevDrivers = new Set();
  let currentStatus = null;
  let activeFlagEvent = null;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const drivers = frame.drivers || {};
    const currentDrivers = new Set(Object.keys(drivers));

    // DNFs
    if (prevDrivers.size > 0) {
      for (const code of prevDrivers) {
        if (!currentDrivers.has(code)) {
          events.push({
            type: 'dnf',
            frame: i,
            label: code,
            lap: frames[Math.max(0, i - 1)].drivers?.[code]?.lap || frame.lap
          });
        }
      }
    }
    prevDrivers = currentDrivers;

    // Track Status
    // Treat undefined or null as "1" (Clear) to handle transitions back to normal
    const status = frame.track_status || "1";
    
    if (status !== currentStatus) {
      if (activeFlagEvent) {
        activeFlagEvent.endFrame = i;
      }
      
      const eventType = mapStatusToEventType(status);
      if (eventType) {
        activeFlagEvent = { type: eventType, frame: i, label: '', lap: frame.lap };
        events.push(activeFlagEvent);
      } else {
        // Transition to clear status (e.g. "1")
        activeFlagEvent = null;
      }
      currentStatus = status;
    }
  }
  
  // Close last flag if still active
  if (activeFlagEvent) {
    activeFlagEvent.endFrame = frames.length - 1;
  }

  return events;
}

function mapStatusToEventType(status) {
  switch (String(status)) {
    case '2': return 'yellow_flag';
    case '4': return 'safety_car';
    case '5': return 'red_flag';
    case '6':
    case '7': return 'vsc';
    default: return null;
  }
}

// ============================================================================
// Utility Functions (removed - now using directory scanning)
// ============================================================================

// ============================================================================
// Server Startup
// ============================================================================

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🏎️  F1 Unified Server');
  console.log('='.repeat(60));
  console.log(`HTTP Server: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log('\nREST Endpoints:');
  console.log('  GET  /api/years');
  console.log('  GET  /api/races?year=2024');
  console.log('  GET  /api/sessions?year=2024&round=1');
  console.log('  GET  /api/cached/:year');
  console.log('  GET  /api/check/:year/:round/:sessionType');
  console.log('  POST /api/fetch (body: {year, round, sessionType})');
  console.log('  POST /api/load (body: {year, round, sessionType})');
  console.log('  GET  /health');
  console.log('\nWebSocket Commands:');
  console.log('  start, pause, stop, seek, speed, mode, getModes');
  console.log('\nStreaming Modes:');
  console.log('  replay  - 25 FPS (smooth playback)');
  console.log('  live    - 270ms (simulates OpenF1 WebSocket feed)');
  console.log('  polling - 500ms (simulates OpenF1 REST API)');
  console.log('\n💡 Python is spawned on-demand');
  console.log('='.repeat(60) + '\n');
});

