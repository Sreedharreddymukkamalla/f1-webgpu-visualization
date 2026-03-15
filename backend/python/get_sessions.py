#!/usr/bin/env python3
"""
On-demand script to get available sessions for a race.
Outputs JSON to stdout for Node.js to parse.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import json
import os

# Add lib to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fastf1
from lib.f1_data import enable_cache

def get_sessions(year, round_number):
    """Get available session types for a race"""
    enable_cache()
    schedule = fastf1.get_event_schedule(year)
    
    # Find the event
    event = None
    for _, e in schedule.iterrows():
        if e['RoundNumber'] == round_number:
            event = e
            break
    
    if event is None:
        return {"success": False, "error": f"Round {round_number} not found for {year}"}
    
    sessions = [
        {"code": "Q", "name": "Qualifying"},
        {"code": "R", "name": "Race"}
    ]
    
    event_type = (event['EventFormat'] or '').lower()
    is_sprint = 'sprint' in event_type
    
    if is_sprint:
        sessions.insert(0, {"code": "SQ", "name": "Sprint Qualifying"})
        sessions.insert(2, {"code": "S", "name": "Sprint"})
    
    return {"success": True, "sessions": sessions, "is_sprint": is_sprint}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Year and round parameters required"}))
        sys.exit(1)
    
    try:
        year = int(sys.argv[1])
        round_number = int(sys.argv[2])
        result = get_sessions(year, round_number)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
