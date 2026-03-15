import type { ProjectionResult, TrackCenterline } from '../types';

/**
 * TrackProjection handles the projection of car positions onto the track centerline.
 * This is used to calculate accurate race positions based on distance traveled.
 */
export class TrackProjection {
  private _ref_xs: Float32Array = new Float32Array(0);
  private _ref_ys: Float32Array = new Float32Array(0);
  private _ref_cumdist: Float32Array = new Float32Array(0);
  private _ref_total_length: number = 0.0;

  /**
   * Get the total track length in meters
   */
  get totalLength(): number {
    return this._ref_total_length;
  }

  /**
   * Check if the track centerline has been loaded
   */
  get isLoaded(): boolean {
    return this._ref_total_length > 0;
  }

  /**
   * Set the track centerline for position projection
   */
  setCenterline(centerline: TrackCenterline): void {
    const ref_points = this._interpolatePoints(centerline.x, centerline.y, 4000);

    this._ref_xs = new Float32Array(ref_points.map((p) => p[0]));
    this._ref_ys = new Float32Array(ref_points.map((p) => p[1]));

    // Calculate cumulative distances
    const diffs: number[] = [];
    for (let i = 0; i < this._ref_xs.length - 1; i++) {
      const dx = this._ref_xs[i + 1] - this._ref_xs[i];
      const dy = this._ref_ys[i + 1] - this._ref_ys[i];
      diffs.push(Math.sqrt(dx * dx + dy * dy));
    }

    const cumdist = [0.0];
    let sum = 0.0;
    for (const diff of diffs) {
      sum += diff;
      cumdist.push(sum);
    }

    this._ref_cumdist = new Float32Array(cumdist);
    this._ref_total_length = this._ref_cumdist.length > 0 ? this._ref_cumdist[this._ref_cumdist.length - 1] : 0.0;

    console.log(`✓ Leaderboard reference track loaded: ${this._ref_total_length.toFixed(2)}m`);
  }

  /**
   * Project a point onto the reference track
   * @returns The distance along the track and distance from the centerline
   */
  projectToReference(x: number, y: number): ProjectionResult {
    if (this._ref_total_length === 0.0) {
      return { distanceAlong: 0.0, distanceFrom: 0.0 };
    }

    // Find nearest point on track
    let min_d2 = Infinity;
    let idx = 0;
    for (let i = 0; i < this._ref_xs.length; i++) {
      const dx = this._ref_xs[i] - x;
      const dy = this._ref_ys[i] - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < min_d2) {
        min_d2 = d2;
        idx = i;
      }
    }

    // Project onto adjacent segment for better accuracy
    let distanceAlong = this._ref_cumdist[idx];
    let distanceFrom = Math.sqrt(min_d2);

    if (idx < this._ref_xs.length - 1) {
      const x1 = this._ref_xs[idx];
      const y1 = this._ref_ys[idx];
      const x2 = this._ref_xs[idx + 1];
      const y2 = this._ref_ys[idx + 1];
      const vx = x2 - x1;
      const vy = y2 - y1;
      const seg_len2 = vx * vx + vy * vy;

      if (seg_len2 > 0) {
        let t = ((x - x1) * vx + (y - y1) * vy) / seg_len2;
        t = Math.max(0.0, Math.min(1.0, t));
        const proj_x = x1 + t * vx;
        const proj_y = y1 + t * vy;
        
        // Calculate distance along track
        const seg_dist = Math.sqrt((proj_x - x1) ** 2 + (proj_y - y1) ** 2);
        distanceAlong = this._ref_cumdist[idx] + seg_dist;
        
        // Calculate perpendicular distance from track centerline
        distanceFrom = Math.sqrt((x - proj_x) ** 2 + (y - proj_y) ** 2);
      }
    }

    return { distanceAlong, distanceFrom };
  }

  /**
   * Interpolate points along the track for smoother projection
   */
  private _interpolatePoints(xs: number[], ys: number[], interp_points: number = 2000): [number, number][] {
    const n = xs.length;
    const t_old = Array.from({ length: n }, (_, i) => i / (n - 1));
    const t_new = Array.from({ length: interp_points }, (_, i) => i / (interp_points - 1));

    const xs_i = t_new.map((t) => this._interp(t, t_old, xs));
    const ys_i = t_new.map((t) => this._interp(t, t_old, ys));

    return xs_i.map((x, i) => [x, ys_i[i]]);
  }

  /**
   * Linear interpolation helper
   */
  private _interp(x: number, xp: number[], fp: number[]): number {
    if (x <= xp[0]) return fp[0];
    if (x >= xp[xp.length - 1]) return fp[fp.length - 1];

    for (let i = 0; i < xp.length - 1; i++) {
      if (x >= xp[i] && x <= xp[i + 1]) {
        const t = (x - xp[i]) / (xp[i + 1] - xp[i]);
        return fp[i] + t * (fp[i + 1] - fp[i]);
      }
    }
    return fp[fp.length - 1];
  }
}
