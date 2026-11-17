// The sky the Keeper harvests under: three parallax star layers, a drifting nebula painted once
// into an offscreen canvas, and a few slow comets. Nothing here changes on a fixed step beyond
// scroll offsets, so it is cheap to draw every frame.

import { COLORS, VIEW } from './config.js';

const LAYERS = [
  { count: 130, depth: 0.18, size: 1.0, alpha: 0.42, color: COLORS.starFar, twinkle: 0.10 },
  { count: 90, depth: 0.42, size: 1.5, alpha: 0.66, color: COLORS.starMid, twinkle: 0.22 },
  { count: 46, depth: 0.78, size: 2.1, alpha: 0.95, color: COLORS.starNear, twinkle: 0.38 },
];

const NEBULA_BLOBS = [
  { x: 0.24, y: 0.18, r: 0.46, color: COLORS.nebulaA },
  { x: 0.78, y: 0.30, r: 0.40, color: COLORS.nebulaB },
  { x: 0.52, y: 0.72, r: 0.52, color: COLORS.nebulaC },
  { x: 0.10, y: 0.82, r: 0.34, color: COLORS.nebulaD },
  { x: 0.92, y: 0.88, r: 0.30, color: COLORS.nebulaB },
];

/**
 * Build the background. `rng` seeds the star scatter so screenshots are reproducible; the nebula
 * lives in its own canvas at half resolution, which is all a soft gradient needs.
 */
export function createField(rng) {
  const stars = [];

  for (const layer of LAYERS) {
    for (let i = 0; i < layer.count; i++) {
      stars.push({
        x: rng.next() * VIEW.width,
        y: rng.next() * VIEW.height,
        depth: layer.depth,
        size: layer.size * rng.range(0.6, 1.5),
        alpha: layer.alpha * rng.range(0.55, 1),
        color: layer.color,
        twinkle: layer.twinkle,
        phase: rng.next() * Math.PI * 2,
        speed: rng.range(0.5, 1.5),
      });
    }
  }

  // A few brighter pins with a cross-glint, to give the field some landmark stars.
  const beacons = [];
  for (let i = 0; i < 12; i++) {
    beacons.push({
      x: rng.next() * VIEW.width,
      y: rng.next() * VIEW.height,
      depth: 0.62,
      size: rng.range(2.2, 3.4),
      phase: rng.next() * Math.PI * 2,
    });
  }

  const nebula = paintNebula(rng);

  const comets = [];
  for (let i = 0; i < 3; i++) {
    comets.push({
      x: rng.next() * VIEW.width,
      y: rng.range(0, VIEW.height * 0.6),
      vx: rng.range(40, 130) * rng.sign(),
      vy: rng.range(60, 150),
      life: rng.range(4, 11),
      age: rng.next() * 6,
    });
  }

  const state = {
    stars,
    beacons,
    nebula,
    comets,
    /** How far the field has scrolled: driven by game speed for a sense of descent. */
    scroll: 0,
    time: 0,

    /** Advance the parallax and the comets. `speed` is the current fall rate in px/s. */
    update(dt, speed) {
      state.time += dt;
      state.scroll += speed * dt;
      if (state.scroll > VIEW.height * 4) state.scroll -= VIEW.height * 4;

      for (const comet of state.comets) {
        comet.age += dt;
        comet.x += comet.vx * dt;
        comet.y += comet.vy * dt;
        if (comet.age > comet.life || comet.y > VIEW.height + 80 || comet.x < -120 || comet.x > VIEW.width + 120) {
          comet.age = 0;
          comet.life = rng.range(4, 11);
          comet.x = rng.range(-80, VIEW.width + 80);
          comet.y = rng.range(-160, VIEW.height * 0.45);
          comet.vx = rng.range(40, 130) * rng.sign();
          comet.vy = rng.range(60, 150);
        }
      }
    },

    /** The nebula wash, then stars by depth, then comets and beacons on top. */
    draw(ctx) {
      ctx.fillStyle = COLORS.night;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);

      if (nebula) {
        ctx.globalAlpha = 0.92;
        ctx.drawImage(nebula, 0, 0, VIEW.width, VIEW.height);
        ctx.globalAlpha = 1;
      }

      for (const star of stars) {
        const y = wrap(star.y + state.scroll * star.depth, VIEW.height);
        const flicker = 1 + Math.sin(state.time * star.speed + star.phase) * star.twinkle;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, star.alpha * flicker));
        ctx.fillStyle = star.color;
        const size = star.size;
        ctx.fillRect(star.x - size / 2, y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      drawComets(ctx, state.comets);
      drawBeacons(ctx, beacons, state.time);
    },
  };

  return state;
}

/** Paint the soft nebula clouds once, additively, at half resolution. */
function paintNebula(rng) {
  if (typeof document === 'undefined') return null;
  const w = Math.round(VIEW.width / 2);
  const h = Math.round(VIEW.height / 2);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = COLORS.abyss;
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'lighter';
  for (const blob of NEBULA_BLOBS) {
    const cx = blob.x * w;
    const cy = blob.y * h;
    const radius = blob.r * w;
    const grad = ctx.createRadialGradient(cx, cy, radius * 0.05, cx, cy, radius);
    grad.addColorStop(0, blob.color);
    grad.addColorStop(0.55, blob.color.replace(/[\d.]+\)$/, '0.06)'));
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dust: a scatter of faint puffs so the wash is not a perfect blur.
  for (let i = 0; i < 90; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h;
    const r = rng.range(8, 46);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, `rgba(180, 150, 255, ${rng.range(0.010, 0.035).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  return off;
}

function drawComets(ctx, comets) {
  ctx.lineCap = 'round';
  for (const comet of comets) {
    const fade = Math.sin(Math.min(1, comet.age / comet.life) * Math.PI);
    if (fade <= 0.02) continue;
    const len = 0.16;
    const tx = comet.x - comet.vx * len;
    const ty = comet.y - comet.vy * len;
    const grad = ctx.createLinearGradient(comet.x, comet.y, tx, ty);
    grad.addColorStop(0, `rgba(220, 244, 255, ${(0.5 * fade).toFixed(3)})`);
    grad.addColorStop(1, 'rgba(120, 190, 255, 0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(comet.x, comet.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
}

function drawBeacons(ctx, beacons, time) {
  for (const star of beacons) {
    const pulse = 0.55 + 0.45 * Math.sin(time * 1.3 + star.phase);
    const y = wrap(star.y, VIEW.height);
    ctx.globalAlpha = 0.55 * pulse;
    ctx.strokeStyle = COLORS.starNear;
    ctx.lineWidth = 1;
    const arm = star.size * 2.6;
    ctx.beginPath();
    ctx.moveTo(star.x - arm, y);
    ctx.lineTo(star.x + arm, y);
    ctx.moveTo(star.x, y - arm);
    ctx.lineTo(star.x, y + arm);
    ctx.stroke();
    ctx.globalAlpha = 0.85 * pulse;
    ctx.fillStyle = COLORS.starNear;
    ctx.beginPath();
    ctx.arc(star.x, y, star.size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Wrap a y coordinate into [0, height). */
function wrap(y, height) {
  const span = height + 4;
  let out = y % span;
  if (out < 0) out += span;
  return out - 2;
}
