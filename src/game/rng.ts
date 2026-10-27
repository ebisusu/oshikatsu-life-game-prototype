// seeded RNG (mulberry32)。状態は number 1個なのでセーブに含められる。

export interface RngBox {
  rng: number;
}

export function seedFrom(input: number | string): number {
  if (typeof input === 'number' && Number.isFinite(input)) return (Math.floor(input) >>> 0) || 1;
  let h = 2166136261;
  const s = String(input);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

/** 0 <= x < 1。box.rng を前進させる。 */
export function rand(box: RngBox): number {
  const t = (box.rng + 0x6d2b79f5) >>> 0;
  box.rng = t;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
}

export function randInt(box: RngBox, n: number): number {
  return Math.floor(rand(box) * n);
}

export function shuffle<T>(box: RngBox, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(box, i + 1);
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/** weights に比例して添字を選ぶ。全て0なら一様。 */
export function pickWeighted(box: RngBox, weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (total <= 0) return randInt(box, weights.length);
  let x = rand(box) * total;
  for (let i = 0; i < weights.length; i++) {
    x -= Math.max(0, weights[i] as number);
    if (x < 0) return i;
  }
  return weights.length - 1;
}
