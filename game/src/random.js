// Deterministic randomness. The shipping game seeds from the clock, but ?shot= scenes
// seed from the URL so a screenshot is byte-for-byte reproducible.

/** Hash any string into a 32-bit integer (xfnv1a). */
export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, good enough for arcade scatter. Returns floats in [0, 1). */
export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small RNG bundle: float, range, int, pick, chance and a shuffle. */
export function makeRng(seed) {
  const next = mulberry32(typeof seed === 'number' ? seed : hashSeed(seed));
  const api = {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
    sign() {
      return next() < 0.5 ? -1 : 1;
    },
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
  };
  return api;
}

/** Pick one item per entry of `counts`, without repeating an item within the run. */
export function drawDistinct(rng, list, count) {
  return rng.shuffle(list).slice(0, count);
}
