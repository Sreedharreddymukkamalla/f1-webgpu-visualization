import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import fastf1
import fastf1.plotting
from multiprocessing import Pool, cpu_count
import numpy as np
import json
from datetime import timedelta

from .tyres import get_tyre_compound_int
from .time import parse_time_string, format_time

import pandas as pd

FPS = 25
DT = 1 / FPS

def enable_cache():
    """Enable FastF1 caching (centralized in backend/python/.fastf1-cache)"""
    lib_dir = os.path.dirname(os.path.abspath(__file__))
    python_root = os.path.dirname(lib_dir)
    cache_dir = os.path.join(python_root, '.fastf1-cache')
    
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)

def _process_single_driver(args):
    """Process telemetry data for a single driver (must be top-level for multiprocessing)"""
    driver_no, session, driver_code = args
    
    try:
        laps_driver = session.laps.pick_drivers(driver_no)
        if laps_driver.empty:
            return None

        driver_max_lap = laps_driver.LapNumber.max() if not laps_driver.empty else 0
        driver_min_lap = laps_driver.LapNumber.min() if not laps_driver.empty else 0
        print(f"  {driver_code}: Lap range {driver_min_lap} to {driver_max_lap}")

        t_all = []
        x_all = []
        y_all = []
        dist_all = []
        rel_dist_all = []
        lap_numbers = []
        tyre_compounds = []
        speed_all = []
        gear_all = []
        drs_all = []
        throttle_all = []
        brake_all = []
        rpm_all = []

        # Iterate laps in order
        for _, lap in laps_driver.iterlaps():
            try:
                lap_tel = lap.get_telemetry()
                
                if lap_tel.empty:
                    continue

                t_lap = lap_tel["SessionTime"].dt.total_seconds().to_numpy()
                x_lap = lap_tel["X"].to_numpy()
                y_lap = lap_tel["Y"].to_numpy()
                dist_lap = lap_tel["Distance"].to_numpy()
                rel_dist_lap = lap_tel["RelativeDistance"].to_numpy()
                speed_lap = lap_tel["Speed"].to_numpy()
                gear_lap = lap_tel["nGear"].to_numpy()
                drs_lap = lap_tel["DRS"].to_numpy()
                throttle_lap = lap_tel["Throttle"].to_numpy()
                brake_lap = lap_tel["Brake"].to_numpy()
                rpm_lap = lap_tel["RPM"].to_numpy()
                
                lap_number = lap['LapNumber']
                tyre_compound = get_tyre_compound_int(lap['Compound'])
                
                t_all.append(t_lap)
                x_all.append(x_lap)
                y_all.append(y_lap)
                dist_all.append(dist_lap)
                rel_dist_all.append(rel_dist_lap)
                lap_numbers.append(np.full_like(t_lap, lap_number))
                tyre_compounds.append(np.full_like(t_lap, tyre_compound))
                speed_all.append(speed_lap)
                gear_all.append(gear_lap)
                drs_all.append(drs_lap)
                throttle_all.append(throttle_lap)
                brake_all.append(brake_lap)
                rpm_all.append(rpm_lap)
                
            except Exception as e:
                print(f"Error processing lap for {driver_code}: {e}")
                continue

        if not t_all:
            return None

        # Concatenate and sort
        all_arrays = [t_all, x_all, y_all, dist_all, rel_dist_all, lap_numbers, 
                      tyre_compounds, speed_all, gear_all, drs_all, throttle_all, brake_all, rpm_all]
        t_all, x_all, y_all, dist_all, rel_dist_all, lap_numbers, \
        tyre_compounds, speed_all, gear_all, drs_all, throttle_all, brake_all, rpm_all = [np.concatenate(arr) for arr in all_arrays]
        
        order = np.argsort(t_all)
        all_data = [t_all, x_all, y_all, dist_all, rel_dist_all, lap_numbers,
                    tyre_compounds, speed_all, gear_all, drs_all, throttle_all, brake_all, rpm_all]
        t_all, x_all, y_all, dist_all, rel_dist_all, lap_numbers, \
        tyre_compounds, speed_all, gear_all, drs_all, throttle_all, brake_all, rpm_all = [arr[order] for arr in all_data]

        return {
            "code": driver_code,
            "data": {
                "t": t_all,
                "x": x_all,
                "y": y_all,
                "dist": dist_all,
                "rel_dist": rel_dist_all,
                "lap": lap_numbers,
                "tyre": tyre_compounds,
                "speed": speed_all,
                "gear": gear_all,
                "drs": drs_all,
                "throttle": throttle_all,
                "brake": brake_all,
                "rpm": rpm_all,
            },
            "t_min": float(t_all.min()),
            "t_max": float(t_all.max()),
            "max_lap": int(driver_max_lap)
        }
        
    except Exception as e:
        # Silently return None on error (error handling in main process)
        return None

def load_session(year, round_number, session_type='R'):
    """Load an F1 session with error handling"""
    try:
        print(f"Loading session: {year} Round {round_number} ({session_type})")
        session = fastf1.get_session(year, round_number, session_type)
        session.load(telemetry=True, weather=True)
        print(f"✓ Session loaded: {session.event['EventName']}")
        return session
    except Exception as e:
        print(f"Error loading session: {e}")
        raise

def get_driver_colors(session):
    """Get driver colors with official F1 2024 team colors"""
    # Official F1 2024 team colors
    TEAM_COLORS = {
        'Mercedes': '#00D7B6',
        'Red Bull Racing': '#4781D7',
        'Ferrari': '#ED1131',
        'McLaren': '#F47600',
        'Alpine': '#00A1E8',
        'AlphaTauri': '#6C98FF',  # Racing Bulls (was AlphaTauri)
        'RB': '#6C98FF',  # Racing Bulls
        'Aston Martin': '#229971',
        'Williams': '#1868DB',
        'Sauber': '#01C00E',  # Kick Sauber
        'Kick Sauber': '#01C00E',
        'Haas F1 Team': '#9C9FA2',
    }
    
    # Map team names to normalized team keys for frontend
    TEAM_NAME_TO_KEY = {
        'Mercedes': 'mercedes',
        'Red Bull Racing': 'redbull',
        'Ferrari': 'ferrari',
        'McLaren': 'mclaren',
        'Alpine': 'alpine',
        'AlphaTauri': 'racingbulls',
        'RB': 'racingbulls',
        'Aston Martin': 'astonmartin',
        'Williams': 'williams',
        'Sauber': 'kicksauber',
        'Kick Sauber': 'kicksauber',
        'Haas F1 Team': 'haas',
    }
    
    try:
        drivers = session.drivers
        rgb_colors = {}
        team_info = {}
        
        for driver_no in drivers:
            driver_info = session.get_driver(driver_no)
            driver_code = driver_info['Abbreviation']
            team_name = driver_info['TeamName']
            
            # Get team color, fallback to FastF1 if team not found
            hex_color = TEAM_COLORS.get(team_name)
            
            if not hex_color:
                # Fallback to FastF1 colors
                try:
                    color_mapping = fastf1.plotting.get_driver_color_mapping(session)
                    hex_color = color_mapping.get(driver_code, '#FFFFFF')
                except:
                    hex_color = '#FFFFFF'
            
            # Convert hex to RGB tuple
            hex_color = hex_color.lstrip('#')
            rgb = tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
            rgb_colors[driver_code] = rgb
            
            # Store team info for frontend
            team_key = TEAM_NAME_TO_KEY.get(team_name, team_name.lower().replace(' ', ''))
            team_info[driver_code] = {
                'name': team_name,
                'key': team_key
            }
        
        return rgb_colors, team_info
    except Exception as e:
        print(f"Error getting driver colors: {e}")
        return {}, {}


def get_circuit_rotation(session):
    """Get circuit rotation from FastF1"""
    try:
        circuit = session.get_circuit_info()
        return circuit.rotation
    except Exception as e:
        print(f"Error getting circuit rotation: {e}")
        return 0

def get_qualifying_metadata(session, telemetry_start_offset_ms=0):
    """
    Extract qualifying-specific metadata (Q1/Q2/Q3 times, sectors, etc.)
    Returns qualifying data structure for TV-like display with frame-accurate timing
    
    Args:
        session: FastF1 session object
        telemetry_start_offset_ms: Offset in ms from session start to telemetry t=0
                                   All times will be adjusted relative to telemetry start
    """
    import pandas as pd
    
    try:
        results = session.results
        laps = session.laps
        session_status = session.session_status
        
        def format_time(td):
            if pd.isna(td):
                return None
            total_seconds = td.total_seconds()
            minutes = int(total_seconds // 60)
            seconds = total_seconds % 60
            return f"{minutes}:{seconds:06.3f}"
        
        def time_to_ms(td, is_timestamp=True):
            """Convert timedelta to milliseconds
            
            Args:
                td: timedelta to convert
                is_timestamp: If True, adjust for telemetry start offset (for event times)
                             If False, return raw duration (for lap times, sector times)
            """
            if pd.isna(td):
                return None
            raw_ms = int(td.total_seconds() * 1000)
            if is_timestamp:
                # Return time relative to telemetry start (t=0)
                return raw_ms - telemetry_start_offset_ms
            else:
                # Return raw duration (for lap times, sector times)
                return raw_ms
        
        # Extract Q1/Q2/Q3 phase timing from session status
        # Session status has 'Started' and 'Finished' for each phase
        # Note: Red flags cause 'Aborted' followed by 'Started' again, so there may be
        # multiple 'Started' events per phase. The clock accumulates across restarts.
        # 
        # We need to capture all "running" intervals (Started → Aborted/Finished) for each phase
        # so the frontend can calculate elapsed/remaining time correctly.
        phase_timing = []
        
        # Get all status events sorted by time
        status_events = session_status.sort_values('Time').to_dict('records')
        
        # Find all Finished events to identify phase boundaries
        finished_indices = [i for i, e in enumerate(status_events) if e['Status'] == 'Finished']
        
        phase_names = ['Q1', 'Q2', 'Q3']
        prev_finished_idx = -1
        
        for phase_idx, finished_idx in enumerate(finished_indices):
            if phase_idx >= len(phase_names):
                break
            
            name = phase_names[phase_idx]
            
            # Get events between previous Finished (exclusive) and this Finished (inclusive)
            phase_events = status_events[prev_finished_idx + 1 : finished_idx + 1]
            
            # Build list of running intervals (Started → Aborted or Started → Finished)
            running_intervals = []
            current_start = None
            
            for event in phase_events:
                status = event['Status']
                time = event['Time']
                
                if status == 'Started':
                    current_start = time
                elif status in ('Aborted', 'Finished') and current_start is not None:
                    running_intervals.append({
                        "start_ms": time_to_ms(current_start),
                        "end_ms": time_to_ms(time)
                    })
                    current_start = None
            
            # Calculate total duration and overall start/end times
            if running_intervals:
                total_duration_ms = sum(
                    interval["end_ms"] - interval["start_ms"] 
                    for interval in running_intervals
                )
                overall_start_ms = running_intervals[0]["start_ms"]
                overall_end_ms = running_intervals[-1]["end_ms"]
                
                phase_timing.append({
                    "name": name,
                    "start_ms": overall_start_ms,  # When the phase first started
                    "end_ms": overall_end_ms,      # When the phase finally finished
                    "total_duration_ms": total_duration_ms,  # Accumulated clock time
                    "running_intervals": running_intervals,  # All Started→Aborted/Finished periods
                    "elimination_positions": [16, 17, 18, 19, 20] if name == 'Q1' else ([11, 12, 13, 14, 15] if name == 'Q2' else [])
                })
            
            prev_finished_idx = finished_idx
        
        # Build results with Q1/Q2/Q3 times
        quali_results = []
        for _, row in results.sort_values('Position').iterrows():
            driver_data = {
                "position": int(row['Position']) if pd.notna(row['Position']) else 99,
                "driver_number": int(row['DriverNumber']) if pd.notna(row['DriverNumber']) else 0,
                "abbreviation": row['Abbreviation'],
                "full_name": row['BroadcastName'] if pd.notna(row['BroadcastName']) else row['Abbreviation'],
                "team_name": row['TeamName'],
                "team_color": row['TeamColor'] if pd.notna(row['TeamColor']) else 'FFFFFF',
                "q1_time": format_time(row['Q1']),
                "q1_time_ms": time_to_ms(row['Q1'], is_timestamp=False),  # Duration, not timestamp
                "q2_time": format_time(row['Q2']),
                "q2_time_ms": time_to_ms(row['Q2'], is_timestamp=False),  # Duration, not timestamp
                "q3_time": format_time(row['Q3']),
                "q3_time_ms": time_to_ms(row['Q3'], is_timestamp=False),  # Duration, not timestamp
                "eliminated_in": "Q1" if row['Position'] > 15 else ("Q2" if row['Position'] > 10 else None)
            }
            quali_results.append(driver_data)
        
        # Find best sectors across all drivers
        valid_laps = laps[laps['Deleted'] == False] if 'Deleted' in laps.columns else laps
        sector_bests = {}
        
        for sector_col, sector_name in [('Sector1Time', 'sector1'), ('Sector2Time', 'sector2'), ('Sector3Time', 'sector3')]:
            if sector_col in valid_laps.columns:
                sector_times = valid_laps[valid_laps[sector_col].notna()]
                if not sector_times.empty:
                    best_idx = sector_times[sector_col].idxmin()
                    best_lap = sector_times.loc[best_idx]
                    sector_bests[sector_name] = {
                        "time": format_time(best_lap[sector_col]),
                        "driver": best_lap['Driver']
                    }
        
        # Build lap timeline with frame timing for live updates
        lap_events = []
        for _, lap in laps.sort_values('Time').iterrows():
            if pd.notna(lap['LapTime']):
                lap_event = {
                    "driver": lap['Driver'],
                    "lap_number": int(lap['LapNumber']),
                    "time_ms": time_to_ms(lap['Time']),  # When this lap was completed (timestamp)
                    "lap_time": format_time(lap['LapTime']),
                    "lap_time_ms": time_to_ms(lap['LapTime'], is_timestamp=False),  # Duration, not timestamp
                    "sector1": format_time(lap['Sector1Time']) if pd.notna(lap.get('Sector1Time')) else None,
                    "sector2": format_time(lap['Sector2Time']) if pd.notna(lap.get('Sector2Time')) else None,
                    "sector3": format_time(lap['Sector3Time']) if pd.notna(lap.get('Sector3Time')) else None,
                    "is_personal_best": bool(lap['IsPersonalBest']) if pd.notna(lap.get('IsPersonalBest')) else False,
                    "deleted": bool(lap['Deleted']) if pd.notna(lap.get('Deleted')) else False,
                    "compound": lap['Compound'] if pd.notna(lap.get('Compound')) else 'UNKNOWN',
                }
                lap_events.append(lap_event)
        
        return {
            "session_type": "qualifying",
            "session_phases": phase_timing,
            "results": quali_results,
            "sector_bests": sector_bests,
            "lap_events": lap_events,
        }
        
    except Exception as e:
        print(f"Error extracting qualifying metadata: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_race_telemetry(session, session_type='R', use_cache=True):
    """
    Get telemetry for all drivers
    Returns data structure ready for JSON export
    """
    event_name = str(session).replace(' ', '_')
    cache_suffix = 'qualifying' if session_type == 'Q' else ('sprint_qualifying' if session_type == 'SQ' else ('sprint' if session_type == 'S' else 'race'))
    
    # Check cache (JSON instead of pickle)
    lib_dir = os.path.dirname(os.path.abspath(__file__))
    python_root = os.path.dirname(lib_dir)
    cache_dir = os.path.join(python_root, 'computed_data')
    cache_file = f"{cache_dir}/{event_name}_{cache_suffix}_telemetry.json"
    
    if use_cache and os.path.exists(cache_file):
        try:
            print(f"Loading cached data from {cache_file}")
            with open(cache_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Cache load failed: {e}")
    
    # Process data
    print(f"Processing telemetry for {event_name}...")
    
    drivers = session.drivers
    driver_codes = {
        num: session.get_driver(num)["Abbreviation"]
        for num in drivers
    }
    
    driver_data = {}
    global_t_min = None
    global_t_max = None
    max_lap_number = 0
    
    # Multiprocessing with full CPU power (Railway paid tier has enough RAM)
    print(f"Processing {len(drivers)} drivers in parallel...")
    driver_args = [(driver_no, session, driver_codes[driver_no]) for driver_no in drivers]
    num_processes = min(cpu_count(), len(drivers))  # Use all available CPUs
    
    print(f"Using {num_processes} parallel workers...")
    
    # Print driver list before processing
    for driver_no, _, driver_code in driver_args:
        print(f"  → Driver queued: {driver_code}")
    
    with Pool(processes=num_processes) as pool:
        results = pool.map(_process_single_driver, driver_args)
    
    # Process results and print completion
    print(f"\nProcessing results from {len(results)} drivers...")
    for i, result in enumerate(results):
        if result is None:
            continue
        
        code = result["code"]
        driver_data[code] = result["data"]
        
        print(f"  ✓ Processed driver {i+1}/{len(results)}: {code}")
        
        t_min = result["t_min"]
        t_max = result["t_max"]
        max_lap_number = max(max_lap_number, result["max_lap"])
        
        global_t_min = t_min if global_t_min is None else min(global_t_min, t_min)
        global_t_max = t_max if global_t_max is None else max(global_t_max, t_max)
    
    if not driver_data:
        raise ValueError("No valid telemetry data found")
    
    # For qualifying sessions, extend time range to cover full session
    # The lap telemetry might end before the session actually ends
    # For qualifying sessions (Q and SQ), extend time range to cover full session
    # The lap telemetry might end before the session actually ends
    if session_type in ('Q', 'SQ'):
        try:
            # Get the actual session end time from position data (more reliable)
            pos_data = session.pos_data
            if pos_data:
                session_end_times = []
                for driver_no, driver_df in pos_data.items():
                    if 'SessionTime' in driver_df.columns:
                        session_end_times.append(driver_df['SessionTime'].max().total_seconds())
                
                if session_end_times:
                    actual_session_end = max(session_end_times)
                    if actual_session_end > global_t_max:
                        print(f"✓ Extending {'sprint ' if session_type == 'SQ' else ''}qualifying time range: {global_t_max:.1f}s → {actual_session_end:.1f}s")
                        global_t_max = actual_session_end
        except Exception as e:
            print(f"Warning: Could not extend qualifying time range: {e}")
    
    # Create timeline
    timeline = np.arange(global_t_min, global_t_max, DT) - global_t_min
    
    # Debug: Check what lap number frame 0 corresponds to
    frame_0_laps = {}
    for code, data in driver_data.items():
        t = data["t"] - global_t_min
        lap = data["lap"]
        # Find the lap number at t=0 (closest to global_t_min)
        idx_at_t0 = np.argmin(np.abs(t))
        frame_0_laps[code] = int(lap[idx_at_t0])
    
    print(f"\n🔍 DEBUG: Frame 0 lap numbers: {frame_0_laps}")
    print(f"   Min lap at frame 0: {min(frame_0_laps.values())}")
    print(f"   All drivers at lap 1+ at frame 0? {all(lap >= 1 for lap in frame_0_laps.values())}\n")
    
    # Resample weather data onto the timeline
    weather_resampled = None
    weather_df = getattr(session, "weather_data", None)
    if weather_df is not None and not weather_df.empty:
        try:
            weather_times = weather_df["Time"].dt.total_seconds().to_numpy() - global_t_min
            if len(weather_times) > 0:
                order_w = np.argsort(weather_times)
                weather_times = weather_times[order_w]
                
                def _maybe_get(name):
                    return weather_df[name].to_numpy()[order_w] if name in weather_df else None
                
                def _resample_weather(series):
                    if series is None:
                        return None
                    return np.interp(timeline, weather_times, series)
                
                track_temp = _resample_weather(_maybe_get("TrackTemp"))
                air_temp = _resample_weather(_maybe_get("AirTemp"))
                humidity = _resample_weather(_maybe_get("Humidity"))
                wind_speed = _resample_weather(_maybe_get("WindSpeed"))
                wind_direction = _resample_weather(_maybe_get("WindDirection"))
                rainfall_raw = _maybe_get("Rainfall")
                rainfall = _resample_weather(rainfall_raw.astype(float)) if rainfall_raw is not None else None
                
                weather_resampled = {
                    "track_temp": track_temp,
                    "air_temp": air_temp,
                    "humidity": humidity,
                    "wind_speed": wind_speed,
                    "wind_direction": wind_direction,
                    "rainfall": rainfall,
                }
                print("✓ Weather data resampled")
        except Exception as e:
            print(f"Weather data could not be processed: {e}")
    
    # Extract track status data (for flags: yellow, red, safety car, VSC)
    track_status_intervals = []
    track_status_df = getattr(session, "track_status", None)
    if track_status_df is not None and not track_status_df.empty:
        try:
            for status in track_status_df.to_dict('records'):
                start_time = status['Time'].total_seconds() - global_t_min
                track_status_intervals.append({
                    'status': str(status['Status']),
                    'message': status.get('Message', ''),
                    'start_time': start_time,
                    'end_time': None,  # Will be set by next interval
                })
                # Set end_time of previous interval
                if len(track_status_intervals) > 1:
                    track_status_intervals[-2]['end_time'] = start_time
            print(f"✓ Track status data extracted: {len(track_status_intervals)} intervals")
        except Exception as e:
            print(f"Track status could not be processed: {e}")
    
    # Resample driver data
    resampled_data = {}
    for code, data in driver_data.items():
        t = data["t"] - global_t_min
        order = np.argsort(t)
        
        # Sort all arrays
        arrays_to_resample = [
            data["x"], data["y"], data["dist"], data["rel_dist"], data["lap"],
            data["tyre"], data["speed"], data["gear"], data["drs"],
            data["throttle"], data["brake"], data["rpm"]
        ]
        sorted_arrays = [arr[order] for arr in arrays_to_resample]
        t_sorted = t[order]
        
        # Interpolate numerical values
        resampled = [np.interp(timeline, t_sorted, arr) for arr in sorted_arrays]
        x_resampled, y_resampled, dist_resampled, rel_dist_resampled, lap_resampled, \
        tyre_resampled, speed_resampled, gear_resampled, drs_resampled, \
        throttle_resampled, brake_resampled, rpm_resampled = resampled
        
        resampled_data[code] = {
            "t": timeline,
            "x": x_resampled,
            "y": y_resampled,
            "dist": dist_resampled,
            "rel_dist": rel_dist_resampled,
            "lap": lap_resampled,
            "tyre": tyre_resampled,
            "speed": speed_resampled,
            "gear": gear_resampled,
            "drs": drs_resampled,
            "throttle": throttle_resampled,
            "brake": brake_resampled,
            "rpm": rpm_resampled,
        }
    
    # Build frames with position calculation
    print(f"\nBuilding {len(timeline)} telemetry frames...")
    frames = []
    progress_step = max(1, len(timeline) // 10)  # Print progress every 10%
    for i in range(len(timeline)):
        t = timeline[i]
        
        # Calculate positions based on distance
        driver_positions = []
        for code, d in resampled_data.items():
            driver_positions.append((code, float(d["dist"][i])))
        
        # Sort by distance (descending) to get positions
        driver_positions.sort(key=lambda x: x[1], reverse=True)
        position_map = {code: pos + 1 for pos, (code, _) in enumerate(driver_positions)}
        
        frame_data = {}
        for code, d in resampled_data.items():
            frame_data[code] = {
                "x": round(float(d["x"][i]), 2),
                "y": round(float(d["y"][i]), 2),
                "dist": round(float(d["dist"][i]), 2),
                "rel_dist": round(float(d["rel_dist"][i]), 4),
                "lap": int(round(d["lap"][i])),
                "tyre": int(round(d["tyre"][i])),
                "speed": round(float(d["speed"][i]), 1),
                "gear": int(round(d["gear"][i])),
                "drs": int(round(d["drs"][i])),
                "throttle": round(float(d["throttle"][i]), 1),
                "brake": round(float(d["brake"][i]), 1),
                "rpm": int(round(d["rpm"][i])),
                "position": position_map[code],
            }
        
        # Calculate leader's lap for the frame
        leader_lap = max(int(round(d["lap"][i])) for d in resampled_data.values())
        
        # Build weather snapshot for this frame
        weather_snapshot = None
        if weather_resampled:
            try:
                wt = weather_resampled
                rain_val = wt["rainfall"][i] if wt.get("rainfall") is not None else 0.0
                weather_snapshot = {
                    "track_temp": round(float(wt["track_temp"][i]), 1) if wt.get("track_temp") is not None else None,
                    "air_temp": round(float(wt["air_temp"][i]), 1) if wt.get("air_temp") is not None else None,
                    "humidity": round(float(wt["humidity"][i]), 0) if wt.get("humidity") is not None else None,
                    "wind_speed": round(float(wt["wind_speed"][i]), 1) if wt.get("wind_speed") is not None else None,
                    "wind_direction": round(float(wt["wind_direction"][i]), 0) if wt.get("wind_direction") is not None else None,
                    "rain_state": "RAINING" if rain_val and rain_val >= 0.5 else "DRY",
                }
            except Exception as e:
                pass  # Skip weather for this frame on error
        
        frame_payload = {
            "t": round(float(t), 3),
            "lap": leader_lap,
            "drivers": frame_data
        }
        if weather_snapshot:
            frame_payload["weather"] = weather_snapshot
        
        # Determine current track status for this frame time
        current_status = "1"  # Default: All Clear
        for interval in track_status_intervals:
            if interval['start_time'] <= t:
                if interval['end_time'] is None or t < interval['end_time']:
                    current_status = interval['status']
                    break
        
        # Only include track_status if not "1" (All Clear) to reduce payload size
        if current_status != "1":
            frame_payload["track_status"] = current_status
        
        frames.append(frame_payload)
        
        # Print progress every 10%
        if i > 0 and i % progress_step == 0:
            progress_pct = int((i / len(timeline)) * 100)
            print(f"  → Building frames: {progress_pct}% ({i}/{len(timeline)})")
    
    print(f"Completed telemetry extraction: {len(frames)} frames")
    
    # Get driver colors and team info
    driver_colors, team_info = get_driver_colors(session)
    
    # Prepare output
    result = {
        "telemetry": {
            "frames": frames
        },
        "driver_colors": driver_colors,
        "driver_teams": team_info,
        "total_laps": int(max_lap_number),
        "session_type": session_type,
    }
    
    # Add qualifying-specific metadata for Q sessions
    # Add qualifying-specific metadata for Q and SQ sessions
    if session_type in ('Q', 'SQ'):
        # Calculate telemetry start offset - the SessionTime at which telemetry t=0 occurs
        # This is the global_t_min from lap telemetry, NOT from position data
        # The offset is needed to align lap events and phase times with telemetry frames
        telemetry_start_offset_ms = int(global_t_min * 1000)
        print(f"✓ Telemetry start offset: {telemetry_start_offset_ms}ms ({global_t_min:.1f}s)")
        
        quali_metadata = get_qualifying_metadata(session, telemetry_start_offset_ms)
        if quali_metadata:
            result["qualifying"] = quali_metadata
            result["telemetry_start_offset_ms"] = telemetry_start_offset_ms
            print(f"✓ {'Sprint ' if session_type == 'SQ' else ''}Qualifying metadata extracted")
    
    # Save cache
    if use_cache:
        try:
            os.makedirs(cache_dir, exist_ok=True)
            print(f"Saving cache to {cache_file}...")
            with open(cache_file, 'w') as f:
                json.dump(result, f, separators=(',', ':'))
            print("✓ Cache saved")
        except Exception as e:
            print(f"Cache save failed: {e}")
    
    return result

def get_race_weekends_by_year(year):
    """Get list of race weekends for a year"""
    try:
        enable_cache()
        schedule = fastf1.get_event_schedule(year)
        weekends = []
        
        for _, event in schedule.iterrows():
            if event.is_testing():
                continue
            
            weekends.append({
                "round_number": int(event['RoundNumber']),
                "event_name": event['EventName'],
                "date": str(event['EventDate'].date()),
                "country": event['Country'],
                "type": event['EventFormat'],
            })
        
        return weekends
    except Exception as e:
        print(f"Error getting race weekends: {e}")
        return []
