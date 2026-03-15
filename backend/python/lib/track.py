import numpy as np

def build_track_from_telemetry(telemetry_data, grid_telemetry=None, track_width=240):
    """
    Build track geometry from telemetry data.
    Track width of 240 = 12m real width × 20x scale factor for visualization.
    """
    try:
        plot_x_ref = telemetry_data["X"].to_numpy()
        plot_y_ref = telemetry_data["Y"].to_numpy()
        
        dx = np.gradient(plot_x_ref)
        dy = np.gradient(plot_y_ref)
        
        norm = np.sqrt(dx**2 + dy**2)
        norm[norm == 0] = 1.0
        dx /= norm
        dy /= norm
        
        # Compute perpendicular normals
        nx = -dy
        ny = dx
        
        x_outer = plot_x_ref + nx * (track_width / 2)
        y_outer = plot_y_ref + ny * (track_width / 2)
        x_inner = plot_x_ref - nx * (track_width / 2)
        y_inner = plot_y_ref - ny * (track_width / 2)
        
        # Extract DRS zones from telemetry
        drs_zones = extract_drs_zones(telemetry_data)
        print(f"  DRS zones found: {len(drs_zones)}")
        
        x_min = float(min(plot_x_ref.min(), x_inner.min(), x_outer.min()))
        x_max = float(max(plot_x_ref.max(), x_inner.max(), x_outer.max()))
        y_min = float(min(plot_y_ref.min(), y_inner.min(), y_outer.min()))
        y_max = float(max(plot_y_ref.max(), y_inner.max(), y_outer.max()))
        
        # Finish line is the very first point of the lap telemetry (Timing Line)
        # Use simple point-to-point vector for more stable orientation at the start
        tx = float(plot_x_ref[1] - plot_x_ref[0])
        ty = float(plot_y_ref[1] - plot_y_ref[0])
        t_norm = np.sqrt(tx**2 + ty**2) or 1.0
        tx /= t_norm
        ty /= t_norm
        
        # Position at the center of the track (between inner and outer boundaries)
        # instead of on the racing line which may be offset
        center_x = float((x_inner[0] + x_outer[0]) / 2)
        center_y = float((y_inner[0] + y_outer[0]) / 2)
        
        finish_line = {
            "x": center_x,
            "y": center_y,
            "tangent": {"x": tx, "y": ty},
            "normal": {"x": -ty, "y": tx}
        }

        # Grid line is the start of the race (Starting Grid)
        grid_line = None
        if grid_telemetry is not None and not grid_telemetry.empty:
            grid_x = float(grid_telemetry["X"].iloc[0])
            grid_y = float(grid_telemetry["Y"].iloc[0])
            
            # Find closest point on track to get tangent and center position
            dists = np.sqrt((plot_x_ref - grid_x)**2 + (plot_y_ref - grid_y)**2)
            idx = np.argmin(dists)
            
            # Use next point to compute tangent
            next_idx = (idx + 1) % len(plot_x_ref)
            gtx = float(plot_x_ref[next_idx] - plot_x_ref[idx])
            gty = float(plot_y_ref[next_idx] - plot_y_ref[idx])
            gt_norm = np.sqrt(gtx**2 + gty**2) or 1.0
            gtx /= gt_norm
            gty /= gt_norm
            
            # Position at the center of the track (between inner and outer boundaries)
            grid_center_x = float((x_inner[idx] + x_outer[idx]) / 2)
            grid_center_y = float((y_inner[idx] + y_outer[idx]) / 2)
            
            grid_line = {
                "x": grid_center_x,
                "y": grid_center_y,
                "tangent": {"x": gtx, "y": gty},
                "normal": {"x": -gty, "y": gtx}
            }
        
        return {
            "centerline": {
                "x": plot_x_ref.tolist(),
                "y": plot_y_ref.tolist()
            },
            "boundaries": {
                "inner": {
                    "x": x_inner.tolist(),
                    "y": y_inner.tolist()
                },
                "outer": {
                    "x": x_outer.tolist(),
                    "y": y_outer.tolist()
                }
            },
            "bounds": {
                "x_min": x_min,
                "x_max": x_max,
                "y_min": y_min,
                "y_max": y_max
            },
            "drs_zones": drs_zones,
            "track_width": track_width,
            "finish_line": finish_line,
            "grid_line": grid_line
        }
    except Exception as e:
        print(f"Error building track: {e}")
        return None

def extract_drs_zones(telemetry_data):
    """
    Extract DRS zones from telemetry.
    DRS values: 10, 12, 14 indicate DRS active/available.
    """
    try:
        x_val = telemetry_data["X"]
        y_val = telemetry_data["Y"]
        drs_column = telemetry_data["DRS"]
        
        drs_zones = []
        drs_start = None
        
        for i, val in enumerate(drs_column):
            if val in [10, 12, 14]:
                if drs_start is None:
                    drs_start = i
            else:
                if drs_start is not None:
                    drs_end = i - 1
                    zone = {
                        "start": {
                            "x": float(x_val.iloc[drs_start]),
                            "y": float(y_val.iloc[drs_start]),
                            "index": int(drs_start)
                        },
                        "end": {
                            "x": float(x_val.iloc[drs_end]),
                            "y": float(y_val.iloc[drs_end]),
                            "index": int(drs_end)
                        }
                    }
                    drs_zones.append(zone)
                    drs_start = None
        
        if drs_start is not None:
            drs_end = len(drs_column) - 1
            zone = {
                "start": {
                    "x": float(x_val.iloc[drs_start]),
                    "y": float(y_val.iloc[drs_start]),
                    "index": int(drs_start)
                },
                "end": {
                    "x": float(x_val.iloc[drs_end]),
                    "y": float(y_val.iloc[drs_end]),
                    "index": int(drs_end)
                }
            }
            drs_zones.append(zone)
        
        return drs_zones
    except Exception as e:
        print(f"Error extracting DRS zones: {e}")
        return []
