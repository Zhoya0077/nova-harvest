// Everything that falls, sparkles or drifts: star-seeds (and their golden nova cousins), void
// shards, the catch particles and the floating score text. Pure data plus motion — the drawing
// lives in render.js and the collisions in game.js.

import { COLORS, NET, SCORE, VIEW, WAVES } from './config.js';

/** A seed's radius; the net catches on overlap with this, generously padded. */
export const SEED_RADIUS = { seed: 13, nova: 16 };
/** A shard's collision radius, smaller than it looks: fairness over realism. */
export const SHARD_RADIUS = 15;

const MAX_PARTICLES = 420;
const MAX_TEXTS = 24;

/**
 * A falling object. Seeds and novae share one shape; shards use the same fields with `kind:
 * 'shard'` so motion and culling stay in one loop.
 */
function makeFalling(kind, x, y, rng, wave) {
  const base = WAVES.fallSpeed(wave);
  const spread = WAVES.fallSpread(wave);
  const drift = WAVES.drift(wave);
  const speed = base + rng.range(-spread * 0.35, spread * 0.65);
  return {
    kind,
    x,
    y,
    vx: rng.range(-drift, drift) * 0.35,
    vy: speed * (kind === 'nova' ? 1.22 : kind === 'shard' ? 1.12 : 1),
    spin: rng.range(-1.6, 1.6),
    angle: rng.next() * Math.PI * 2,
    radius: kind === 'shard' ? SHARD_RADIUS : SEED_RADIUS[kind] ?? SEED_RADIUS.seed,
    wobble: rng.next() * Math.PI * 2,
    wobbleRate: rng.range(1.6, 3.4),
    /** Shards get a second, jagged outline seeded per instance. */
    jag: kind === 'shard' ? Array.from({ length: 7 }, () => rng.range(0.62, 1.28)) : null,
    alive: true,
    age: 0,
    /** Set the frame it is caught or shattered, so the renderer can fade it out. */
    dying: 0,
  };
}

/** Where a falling thing may enter: inside the playfield with a margin. */
function spawnX(rng, margin = 70) {
  return rng.range(margin, VIEW.width - margin);
}

/**
 * The fall manager. It owns the arrays, the spawn clock and the caps that keep a long run bounded;
 * `step` advances every entity by dt seconds of simulation time.
 */
export function createEntities(rng) {
  const seeds = [];
  const shards = [];
  const particles = [];
  const texts = [];
  const ripples = [];

  let clock = 0;
  let nextSpawn = 0.5;

  /** A burst of sparks. `tint` picks the palette; `power` scales count and speed. */
  function burst(x, y, tint = COLORS.seed, power = 1) {
    const count = Math.round(10 + 10 * power);
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAX_PARTICLES) break;
      const angle = rng.next() * Math.PI * 2;
      const speed = rng.range(50, 290) * power;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - rng.range(20, 90),
        life: rng.range(0.32, 0.82),
        age: 0,
        size: rng.range(1.4, 3.6),
        color: tint,
        drag: rng.range(2.2, 4.4),
        gravity: rng.range(120, 320),
      });
    }
  }

  /** A ring that expands and fades where something was caught or broken. */
  function ripple(x, y, color = COLORS.net, size = 1) {
    ripples.push({ x, y, age: 0, life: 0.42 + 0.1 * size, size, color });
  }

  /** Drifting score text. `label` may be a number or a short string such as "x3". */
  function float(x, y, label, color = COLORS.hud, scale = 1) {
    if (texts.length >= MAX_TEXTS) texts.shift();
    texts.push({
      x,
      y,
      vy: -62,
      age: 0,
      life: 0.95,
      label: String(label),
      color,
      scale,
    });
  }

  /** Spawn one falling object of `kind` at a given x (defaults to a random lane). */
  function spawn(kind, x = spawnX(rng)) {
    const thing = makeFalling(kind, x, -40, rng, waveRef.current);
    if (kind === 'shard') shards.push(thing);
    else seeds.push(thing);
    return thing;
  }

  // The wave number only matters at spawn time; the game sets it as waves advance.
  const waveRef = { current: 1 };

  /** How often to drop something, this wave. */
  function interval() {
    return WAVES.spawnInterval(waveRef.current);
  }

  /**
   * Roll one spawn event: a shard, a nova, or a seed (sometimes a pair). Called on the spawn clock
   * with the wave's current odds.
   */
  function rollSpawn() {
    const wave = waveRef.current;
    if (rng.chance(WAVES.shardChance(wave))) {
      spawn('shard');
      // Early waves never send two shards at once; later ones occasionally flank.
      if (wave >= 4 && rng.chance(0.18)) spawn('shard');
      return;
    }
    if (rng.chance(WAVES.novaChance)) {
      spawn('nova');
      return;
    }
    const x = spawnX(rng);
    spawn('seed', x);
    if (rng.chance(WAVES.doubleChance(wave))) {
      const gap = rng.range(70, 150) * rng.sign();
      const partner = x + gap;
      spawn('seed', Math.max(60, Math.min(VIEW.width - 60, partner)));
    }
  }

  const api = {
    seeds,
    shards,
    particles,
    texts,
    ripples,
    waveRef,

    /** Catch bookkeeping: sparks, a ripple and the score text, tinted by what was caught. */
    celebrate(seed, combo, points) {
      const nova = seed.kind === 'nova';
      burst(seed.x, seed.y, nova ? COLORS.nova : COLORS.seed, nova ? 1.7 : 1);
      ripple(seed.x, seed.y, nova ? COLORS.nova : COLORS.net, nova ? 1.8 : 1);
      float(seed.x, seed.y - 8, `+${points}`, nova ? COLORS.nova : COLORS.hud, nova ? 1.35 : 1);
      if (combo > 1) float(seed.x, seed.y - 38, `x${combo}`, COLORS.gold, 0.9);
    },

    /** A shard hit the hull: violet shrapnel and a red ripple. */
    shatter(shard) {
      burst(shard.x, shard.y, COLORS.shard, 1.5);
      burst(shard.x, shard.y, COLORS.shardEdge, 0.8);
      ripple(shard.x, shard.y, COLORS.danger, 1.5);
    },

    /** A seed reached the deck: a small dim puff, no score. */
    fizzle(seed) {
      burst(seed.x, seed.y, COLORS.seedTail, 0.45);
    },

    burst,
    ripple,
    float,
    spawn,
    spawnX: () => spawnX(rng),

    /** Mark an object caught/broken; it fades for a moment then leaves the array. */
    kill(list, item) {
      item.alive = false;
      item.dying = 1;
      const at = list.indexOf(item);
      if (at >= 0) list.splice(at, 1);
    },

    /** The wave changed: tighten the spawn clock so the new density lands immediately. */
    setWave(wave) {
      waveRef.current = wave;
      nextSpawn = Math.min(nextSpawn, interval() * 0.6);
    },

    /** Fresh run: clear everything and start the clock over. */
    reset() {
      seeds.length = 0;
      shards.length = 0;
      particles.length = 0;
      texts.length = 0;
      ripples.length = 0;
      clock = 0;
      nextSpawn = 0.45;
    },

    /**
     * Advance a dt of simulation. Returns nothing; the game reads the arrays. `speed` is the
     * parallax rate the field wants, which this returns for convenience.
     */
    step(dt) {
      clock += dt;
      if (clock >= nextSpawn) {
        clock = 0;
        nextSpawn = interval() * rng.range(0.78, 1.22);
        rollSpawn();
      }

      const bottom = VIEW.height + 60;
      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i];
        s.age += dt;
        s.wobble += s.wobbleRate * dt;
        s.angle += s.spin * dt;
        s.x += (s.vx + Math.cos(s.wobble) * 26) * dt;
        s.y += s.vy * dt;
        if (s.x < 34 || s.x > VIEW.width - 34) s.vx *= -1;
        if (s.y > bottom) seeds.splice(i, 1);
      }

      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.age += dt;
        s.angle += s.spin * 1.6 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.x < 30 || s.x > VIEW.width - 30) s.vx *= -1;
        if (s.y > bottom) shards.splice(i, 1);
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        const damp = Math.max(0, 1 - p.drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.age += dt;
        if (t.age >= t.life) {
          texts.splice(i, 1);
          continue;
        }
        t.y += t.vy * dt;
        t.vy *= Math.max(0, 1 - 1.8 * dt);
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.age += dt;
        if (r.age >= r.life) ripples.splice(i, 1);
      }
    },
  };

  return api;
}

/** Points a catch is worth, before the combo multiplier. */
export function pointsFor(kind) {
  return kind === 'nova' ? SCORE.nova : SCORE.seed;
}

/** The net's catch line and half-width, from the buff values; shared by game and render. */
export function netLine(netWidth) {
  return {
    y: NET.y,
    half: netWidth / 2,
    sag: NET.sag,
  };
}
