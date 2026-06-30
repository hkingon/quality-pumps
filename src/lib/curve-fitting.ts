/**
 * Curve fitting utilities for pump performance curves.
 *
 * PCHIP: Monotone Cubic Hermite Interpolation (Fritsch-Carlson method).
 *   Used for Head, Power, and NPSHr vs Flow curves.
 *   Preserves monotonicity and avoids overshoot at local extrema.
 *
 * polyRegress2Sample: Least-squares 2nd-degree polynomial regression.
 *   Used for Efficiency vs Flow curves.
 *   Produces a smooth parabolic fit that captures the bowl-shaped efficiency curve.
 */

export interface Point {
  x: number;
  y: number;
}

function linspace(start: number, end: number, n: number): number[] {
  if (n <= 1) return [start];
  const step = (end - start) / (n - 1);
  return Array.from({ length: n }, (_, i) => start + i * step);
}

/**
 * PCHIP — Monotone Cubic Hermite Interpolation (Fritsch-Carlson).
 * Interpolates the input points and evaluates at `numSamples` linearly
 * spaced x values spanning the input x range.
 *
 * Properties:
 * - Exact at the input data points
 * - Monotone between data points (no spurious oscillations)
 * - C¹ continuous (smooth first derivative everywhere)
 */
export function pchipSample(points: Point[], numSamples = 300): Point[] {
  const sorted = [...points]
    .sort((a, b) => a.x - b.x)
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x);

  const n = sorted.length;
  if (n === 0) return [];
  if (n === 1) return sorted;

  const x = sorted.map(p => p.x);
  const y = sorted.map(p => p.y);

  if (n === 2) {
    const xs = linspace(x[0], x[1], numSamples);
    const slope = (y[1] - y[0]) / (x[1] - x[0]);
    return xs.map(xi => ({ x: xi, y: y[0] + slope * (xi - x[0]) }));
  }

  // Interval widths and divided differences
  const h = Array.from({ length: n - 1 }, (_, i) => x[i + 1] - x[i]);
  const delta = Array.from({ length: n - 1 }, (_, i) => (y[i + 1] - y[i]) / h[i]);

  // Tangent slopes at each node
  const m = new Array<number>(n).fill(0);

  // Interior slopes: Fritsch-Carlson weighted harmonic mean
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      m[i] = 0; // local extremum → zero slope (preserves monotonicity)
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }

  // Boundary slopes (Bessel end conditions — one-sided 3-point formula)
  m[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
  m[n - 1] =
    ((2 * h[n - 2] + h[n - 3]) * delta[n - 2] - h[n - 2] * delta[n - 3]) /
    (h[n - 2] + h[n - 3]);

  // Clamp boundary slopes to preserve monotonicity
  const clamp = (mi: number, di: number) => {
    if (Math.abs(di) < 1e-10) return 0;
    const a = mi / di;
    if (a < 0) return 0;
    if (a > 3) return 3 * di;
    return mi;
  };
  m[0] = clamp(m[0], delta[0]);
  m[n - 1] = clamp(m[n - 1], delta[n - 2]);

  // Evaluate at numSamples evenly-spaced x values
  const xs = linspace(x[0], x[n - 1], numSamples);

  return xs.map(xi => {
    // Binary search: find largest i with x[i] <= xi
    let lo = 0, hi = n - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (x[mid] <= xi) lo = mid; else hi = mid - 1;
    }
    const i = lo;
    const hi_i = h[i];
    const t = (xi - x[i]) / hi_i;
    const t2 = t * t;
    const t3 = t2 * t;

    // Cubic Hermite basis functions
    return {
      x: xi,
      y:
        (2 * t3 - 3 * t2 + 1) * y[i] +
        (t3 - 2 * t2 + t) * hi_i * m[i] +
        (-2 * t3 + 3 * t2) * y[i + 1] +
        (t3 - t2) * hi_i * m[i + 1]
    };
  });
}

/**
 * Least-squares 2nd-degree polynomial regression.
 * Fits y = a + b·x + c·x² to the input points via Cramer's rule, then
 * evaluates at `numSamples` linearly spaced x values.
 *
 * Falls back to PCHIP when fewer than 3 distinct points are supplied or
 * the normal-equation matrix is singular.
 */
export function polyRegress2Sample(points: Point[], numSamples = 300): Point[] {
  const valid = points.filter(p => isFinite(p.x) && isFinite(p.y));
  if (valid.length < 3) return pchipSample(valid, numSamples);

  const x = valid.map(p => p.x);
  const y = valid.map(p => p.y);
  const nPts = valid.length;

  // Accumulate sums for the normal equations
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < nPts; i++) {
    const xi = x[i], yi = y[i], xi2 = xi * xi;
    s1 += xi;
    s2 += xi2;
    s3 += xi2 * xi;
    s4 += xi2 * xi2;
    t0 += yi;
    t1 += xi * yi;
    t2 += xi2 * yi;
  }
  const s0 = nPts;

  // Solve 3×3 normal system via Cramer's rule
  const det =
    s0 * (s2 * s4 - s3 * s3) -
    s1 * (s1 * s4 - s3 * s2) +
    s2 * (s1 * s3 - s2 * s2);

  if (Math.abs(det) < 1e-12) return pchipSample(valid, numSamples);

  const a =
    (t0 * (s2 * s4 - s3 * s3) -
      s1 * (t1 * s4 - s3 * t2) +
      s2 * (t1 * s3 - s2 * t2)) /
    det;
  const b =
    (s0 * (t1 * s4 - s3 * t2) -
      t0 * (s1 * s4 - s3 * s2) +
      s2 * (s1 * t2 - t1 * s2)) /
    det;
  const c =
    (s0 * (s2 * t2 - t1 * s3) -
      s1 * (s1 * t2 - t1 * s2) +
      t0 * (s1 * s3 - s2 * s2)) /
    det;

  const xMin = Math.min(...x);
  const xMax = Math.max(...x);
  return linspace(xMin, xMax, numSamples).map(xi => ({
    x: xi,
    y: a + b * xi + c * xi * xi
  }));
}
