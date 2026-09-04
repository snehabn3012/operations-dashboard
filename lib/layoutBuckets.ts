const WIDTH_BUCKETS = [3, 4, 6, 8, 12];

/** Snaps an arbitrary configured width (1-12) to the nearest supported grid-span bucket. */
export function nearestWidthBucket(width: number): number {
  return WIDTH_BUCKETS.reduce((closest, candidate) =>
    Math.abs(candidate - width) < Math.abs(closest - width) ? candidate : closest,
  );
}

/** Clamps an arbitrary configured height to the supported row-span range. */
export function clampHeightBucket(height: number): number {
  return Math.min(4, Math.max(1, Math.round(height)));
}
