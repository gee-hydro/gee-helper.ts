export interface CacheBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

function roundedBounds(bounds: CacheBounds): CacheBounds {
  return Object.fromEntries(
    Object.entries(bounds).map(([key, value]) => [key, Number(value.toFixed(4))]),
  ) as unknown as CacheBounds;
}

/** 校验缓存/导出区域：-180≤west<east≤180、-85≤south<north≤85，跨度 ≤120°/80° */
export function validateCacheBounds(bounds: CacheBounds): CacheBounds {
  const b = roundedBounds(bounds);
  const values = [b.west, b.south, b.east, b.north];
  if (!values.every(Number.isFinite)
      || b.west < -180 || b.east > 180 || b.south < -85 || b.north > 85
      || b.west >= b.east || b.south >= b.north) {
    throw new Error('缓存边界须满足 -180≤west<east≤180、-85≤south<north≤85');
  }
  if (b.east - b.west > 120 || b.north - b.south > 80) {
    throw new Error('单次缓存范围过大（经度跨度≤120°、纬度跨度≤80°）');
  }
  return b;
}
