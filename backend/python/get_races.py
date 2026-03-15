#!/usr/bin/env python3
"""
On-demand script to get race weekends for a year.
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

def get_races(year):
    """Get list of race weekends for a year"""
    enable_cache()
    schedule = fastf1.get_event_schedule(year)
    weekends = []
    
    for _, event in schedule.iterrows():
        if event.is_testing():
            continue
        
        weekends.append({
            "round": int(event['RoundNumber']),
            "name": event['EventName'],
            "date": str(event['EventDate'].date()),
            "country": event['Country'],
            "type": event['EventFormat'],
        })
    
    return weekends

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Year parameter required"}))
        sys.exit(1)
    
    try:
        year = int(sys.argv[1])
        races = get_races(year)
        print(json.dumps({"success": True, "races": races}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
