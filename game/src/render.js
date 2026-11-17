// Every visible pixel: the skimmer and its light-net, the falling seeds and shards, sparks, score
// text, the HUD and the four canvas screens (title, upgrade, game over, pause). Nothing is loaded
// from disk, so the whole look lives here.

import { COLORS, COMBO, FONT, NET, SKIMMER, VIEW } from './config.js';
import { cardTitle, choiceLayout } from './upgrades.js';

/** A rounded rectangle path (roundRect is not everywhere yet). */
function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Glowing text: the shadow is switched off again so it never leaks into later draws. */
function glowText(ctx, text, x, y, { size = 24, color = COLORS.hud, align = 'center', blur = 18, weight = '600', font = FONT.display, alpha = 1, letter = 0 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  if (letter && 'letterSpacing' in ctx) ctx.letterSpacing = `${letter}px`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A dim, thin rule used to break up the panels. */
function rule(ctx, x, y, w, color = 'rgba(92, 242, 218, 0.22)') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}

/** One heart, filled or hollow, at (x, y) with the given size. */
function heart(ctx, x, y, size, filled, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(0, 5);
  ctx.bezierCurveTo(-9, -3, -7, -11, 0, -6);
  ctx.bezierCurveTo(7, -11, 9, -3, 0, 5);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(255, 95, 125, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the skimmer

/**
 * The Keeper's hull: a low arrowhead with a glass canopy, two thruster plumes and the net arms.
 * `skimmer` carries x/y/tilt; `buffs` gives the net width; `time` drives the idle breathing.
 */
export function drawSkimmer(ctx, skimmer, buffs, time, hurtFlash = 0) {
  const { x } = skimmer;
  const y = skimmer.y + Math.sin(time * 1.7) * SKIMMER.hover + (skimmer.bob || 0);
  const tilt = skimmer.tilt || 0;

  // Thruster wash, under everything.
  const wash = ctx.createRadialGradient(x, y + 22, 2, x, y + 22, 74);
  wash.addColorStop(0, 'rgba(92, 242, 218, 0.30)');
  wash.addColorStop(1, 'rgba(92, 242, 218, 0)');
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.ellipse(x, y + 22, 74, 26, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt * 0.16);

  // Plumes first, so the hull sits on top of them.
  const flicker = 0.7 + Math.sin(time * 26) * 0.12 + Math.sin(time * 41) * 0.08;
  for (const side of [-1, 1]) {
    const px = side * 26;
    const len = 26 * flicker;
    const grad = ctx.createLinearGradient(px, 8, px, 12 + len);
    grad.addColorStop(0, 'rgba(160, 255, 240, 0.85)');
    grad.addColorStop(0.45, 'rgba(92, 242, 218, 0.35)');
    grad.addColorStop(1, 'rgba(92, 242, 218, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(px - 5, 8);
    ctx.lineTo(px + 5, 8);
    ctx.lineTo(px + 1.5, 12 + len);
    ctx.lineTo(px - 1.5, 12 + len);
    ctx.closePath();
    ctx.fill();
  }

  // Hull.
  ctx.beginPath();
  ctx.moveTo(-SKIMMER.halfWidth, 6);
  ctx.lineTo(-SKIMMER.halfWidth + 12, -10);
  ctx.lineTo(-14, -14);
  ctx.lineTo(0, -SKIMMER.height);
  ctx.lineTo(14, -14);
  ctx.lineTo(SKIMMER.halfWidth - 12, -10);
  ctx.lineTo(SKIMMER.halfWidth, 6);
  ctx.lineTo(20, 12);
  ctx.lineTo(-20, 12);
  ctx.closePath();

  const hullGrad = ctx.createLinearGradient(0, -SKIMMER.height, 0, 12);
  hullGrad.addColorStop(0, hurtFlash > 0 ? '#5a1a2a' : '#1d2c48');
  hullGrad.addColorStop(1, COLORS.hull);
  ctx.fillStyle = hullGrad;
  ctx.fill();

  ctx.strokeStyle = hurtFlash > 0 ? COLORS.danger : COLORS.hullEdge;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = hurtFlash > 0 ? COLORS.danger : COLORS.hullEdge;
  ctx.shadowBlur = 14;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Canopy.
  ctx.beginPath();
  ctx.moveTo(-13, -12);
  ctx.quadraticCurveTo(0, -SKIMMER.height - 3, 13, -12);
  ctx.quadraticCurveTo(0, -6, -13, -12);
  ctx.closePath();
  const glass = ctx.createLinearGradient(0, -SKIMMER.height, 0, -6);
  glass.addColorStop(0, 'rgba(220, 255, 250, 0.95)');
  glass.addColorStop(1, 'rgba(92, 242, 218, 0.35)');
  ctx.fillStyle = glass;
  ctx.fill();

  // Running lights.
  const blink = 0.55 + 0.45 * Math.sin(time * 3.4);
  ctx.fillStyle = `rgba(255, 212, 105, ${blink.toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 2, 2.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  drawNet(ctx, x, y, buffs.netWidth, time, hurtFlash);
}

/**
 * The light-net: a sagging line between the hull's arms, with a soft catch band above it and
 * little tension sparks at each arm.
 */
function drawNet(ctx, x, y, width, time, hurtFlash = 0) {
  const half = width / 2;
  const top = y + 14;
  // The net hangs a fixed distance below the hull, so it rises and falls with the skimmer.
  const bottom = y + (NET.y - SKIMMER.y);
  const arms = NET.arms;

  // The band that actually catches, drawn as a faint trapezoid.
  const band = ctx.createLinearGradient(0, bottom - 26, 0, bottom + 6);
  band.addColorStop(0, 'rgba(92, 242, 218, 0)');
  band.addColorStop(0.7, 'rgba(92, 242, 218, 0.10)');
  band.addColorStop(1, 'rgba(92, 242, 218, 0)');
  ctx.fillStyle = band;
  ctx.beginPath();
  ctx.moveTo(x - half * 0.72, bottom - 26);
  ctx.lineTo(x + half * 0.72, bottom - 26);
  ctx.lineTo(x + half, bottom + 4);
  ctx.lineTo(x - half, bottom + 4);
  ctx.closePath();
  ctx.fill();

  // Arms from hull to net edge.
  ctx.strokeStyle = hurtFlash > 0 ? 'rgba(255, 95, 125, 0.55)' : 'rgba(92, 242, 218, 0.42)';
  ctx.lineWidth = 1.4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + side * 22, top);
    ctx.quadraticCurveTo(x + side * (half * 0.7), top + 22, x + side * half, bottom);
    ctx.stroke();
  }

  // The net itself: segments between sagging vertices, so it reads as a woven line.
  ctx.beginPath();
  for (let i = 0; i <= arms; i++) {
    const t = i / arms;
    const px = x - half + width * t;
    const sag = Math.sin(t * Math.PI) * NET.sag;
    const py = bottom + sag;
    if (i === 0) ctx.moveTo(px, py);
    else {
      const prevT = (i - 1) / arms;
      const cpx = x - half + width * (prevT + t) / 2;
      const cpy = bottom + Math.sin(((prevT + t) / 2) * Math.PI) * NET.sag * 1.7;
      ctx.quadraticCurveTo(cpx, cpy, px, py);
    }
  }
  ctx.strokeStyle = hurtFlash > 0 ? COLORS.danger : COLORS.net;
  ctx.lineWidth = 2.2;
  ctx.shadowColor = hurtFlash > 0 ? COLORS.danger : COLORS.net;
  ctx.shadowBlur = 16;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Tension sparks crawling along the weave.
  for (let i = 0; i < 5; i++) {
    const t = ((time * 0.22 + i * 0.2) % 1);
    const px = x - half + width * t;
    const py = bottom + Math.sin(t * Math.PI) * NET.sag;
    ctx.globalAlpha = 0.35 + 0.45 * Math.sin(time * 4 + i);
    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- falling things

/** A star-seed: teardrop with a tail, mint for ordinary, gold with rays for a nova. */
export function drawSeed(ctx, seed, time) {
  const nova = seed.kind === 'nova';
  const color = nova ? COLORS.nova : COLORS.seed;
  const core = nova ? COLORS.novaCore : COLORS.seedCore;
  const tail = nova ? COLORS.novaTail : COLORS.seedTail;
  const r = seed.radius;
  const pulse = 1 + Math.sin(time * 5 + seed.wobble) * 0.07;

  ctx.save();
  ctx.translate(seed.x, seed.y);

  // Tail, up and to the side of travel.
  const tailGrad = ctx.createLinearGradient(0, -r, 0, -r - 40);
  tailGrad.addColorStop(0, tail);
  tailGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.moveTo(-r * 0.55, -r * 0.4);
  ctx.lineTo(r * 0.55, -r * 0.4);
  ctx.lineTo(r * 0.12, -r - 40);
  ctx.lineTo(-r * 0.12, -r - 40);
  ctx.closePath();
  ctx.fill();

  // Halo.
  const halo = ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.5);
  halo.addColorStop(0, nova ? 'rgba(255, 212, 105, 0.42)' : 'rgba(121, 255, 214, 0.34)');
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.5, 0, Math.PI * 2);
  ctx.fill();

  if (nova) {
    // Six slow rays.
    ctx.save();
    ctx.rotate(seed.angle * 0.6);
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.55)';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const len = r * (1.6 + Math.sin(time * 3 + i) * 0.22);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 1.05);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Body.
  ctx.scale(pulse, pulse);
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.bezierCurveTo(r * 1.05, -r * 0.35, r * 0.78, r * 0.95, 0, r);
  ctx.bezierCurveTo(-r * 0.78, r * 0.95, -r * 1.05, -r * 0.35, 0, -r * 1.15);
  ctx.closePath();
  const body = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.1, 0, 0, r * 1.25);
  body.addColorStop(0, core);
  body.addColorStop(0.55, color);
  body.addColorStop(1, nova ? 'rgba(255, 150, 60, 0.85)' : 'rgba(40, 200, 168, 0.9)');
  ctx.fillStyle = body;
  ctx.shadowColor = color;
  ctx.shadowBlur = nova ? 24 : 16;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Highlight.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.22, -r * 0.34, r * 0.24, r * 0.36, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** A void shard: a spinning jagged splinter with a dark core and a bright edge. */
export function drawShard(ctx, shard) {
  const r = shard.radius;
  const points = shard.jag || [1, 1, 1, 1, 1, 1, 1];

  ctx.save();
  ctx.translate(shard.x, shard.y);
  ctx.rotate(shard.angle);

  ctx.beginPath();
  for (let i = 0; i < points.length; i++) {
    const a = (i / points.length) * Math.PI * 2;
    const len = r * points[i];
    const px = Math.cos(a) * len;
    const py = Math.sin(a) * len;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();

  const body = ctx.createRadialGradient(0, 0, r * 0.15, 0, 0, r * 1.2);
  body.addColorStop(0, COLORS.shardCore);
  body.addColorStop(0.6, '#4d2277');
  body.addColorStop(1, 'rgba(154, 99, 255, 0.9)');
  ctx.fillStyle = body;
  ctx.fill();

  ctx.strokeStyle = COLORS.shardEdge;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = COLORS.shard;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // An inner fracture line for a bit of bite.
  ctx.strokeStyle = 'rgba(230, 216, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.2);
  ctx.lineTo(r * 0.1, r * 0.05);
  ctx.lineTo(-r * 0.05, r * 0.45);
  ctx.stroke();

  ctx.restore();
}

/** Sparks: additive squares that shrink as they age. */
export function drawParticles(ctx, particles) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of particles) {
    const t = 1 - p.age / p.life;
    const size = Math.max(0.6, p.size * t);
    ctx.globalAlpha = Math.max(0, t * t);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.restore();
}

/** Expanding rings where something was caught or broken. */
export function drawRipples(ctx, ripples) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const r of ripples) {
    const t = r.age / r.life;
    const radius = (18 + 52 * t) * r.size;
    ctx.globalAlpha = Math.max(0, (1 - t) * 0.75);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = Math.max(0.8, 3.2 * (1 - t));
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Floating score text. */
export function drawTexts(ctx, texts) {
  for (const t of texts) {
    const k = 1 - t.age / t.life;
    const pop = t.age < 0.12 ? 0.7 + (t.age / 0.12) * 0.45 : 1;
    glowText(ctx, t.label, t.x, t.y, {
      size: 22 * t.scale * pop,
      color: t.color,
      blur: 14,
      weight: '700',
      alpha: Math.max(0, Math.min(1, k * 1.6)),
    });
  }
}

// ---------------------------------------------------------------- the HUD

/**
 * Score, combo ladder, hearts, wave and catch count along the top; the pause hint bottom-left.
 * Values come straight off the game object.
 */
export function drawHud(ctx, game) {
  const pad = 26;

  // A soft bar so the numbers stay readable over the sky.
  const bar = ctx.createLinearGradient(0, 0, 0, 96);
  bar.addColorStop(0, 'rgba(4, 3, 14, 0.78)');
  bar.addColorStop(1, 'rgba(4, 3, 14, 0)');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, VIEW.width, 96);

  // Score.
  glowText(ctx, 'SCORE', pad, 30, { size: 12, color: COLORS.hudDim, align: 'left', blur: 0, letter: 3 });
  glowText(ctx, String(game.score).padStart(5, '0'), pad, 60, { size: 38, color: COLORS.hud, align: 'left', blur: 12, weight: '700' });

  // Best, under the score.
  glowText(ctx, `BEST ${Math.max(game.best, game.score)}`, pad, 88, { size: 12, color: COLORS.hudDim, align: 'left', blur: 0, letter: 2 });

  // Combo ladder, centred.
  const cx = VIEW.width / 2;
  const rung = Math.min(COMBO.max, game.combo);
  glowText(ctx, `x${rung}`, cx, 44, {
    size: 40,
    color: rung > 1 ? COLORS.gold : COLORS.hudDim,
    blur: rung > 1 ? 20 : 6,
    weight: '700',
  });
  const segW = 20;
  const segGap = 5;
  const totalW = COMBO.max * segW + (COMBO.max - 1) * segGap;
  const segLeft = cx - totalW / 2;
  for (let i = 0; i < COMBO.max; i++) {
    const filled = i < rung - 1;
    const partial = i === rung - 1 ? game.comboProgress : 0;
    const x = segLeft + i * (segW + segGap);
    ctx.fillStyle = 'rgba(200, 226, 255, 0.10)';
    roundRect(ctx, x, 70, segW, 5, 2.5);
    ctx.fill();
    if (filled || partial > 0) {
      const w = filled ? segW : segW * Math.max(0, Math.min(1, partial));
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, COLORS.seed);
      grad.addColorStop(1, COLORS.gold);
      ctx.fillStyle = grad;
      roundRect(ctx, x, 70, w, 5, 2.5);
      ctx.fill();
    }
  }
  glowText(ctx, 'COMBO', cx, 86, { size: 10, color: COLORS.hudDim, blur: 0, letter: 3 });

  // Hearts, right.
  const heartsRight = VIEW.width - pad;
  for (let i = 0; i < game.maxHearts; i++) {
    const hx = heartsRight - 18 - i * 34;
    heart(ctx, hx, 40, 24, i < game.hearts, COLORS.danger);
  }
  glowText(ctx, `WAVE ${game.wave}`, heartsRight, 84, { size: 14, color: COLORS.hudDim, align: 'right', blur: 0, letter: 2 });

  // Shields, under the hearts.
  if (game.shields > 0) {
    for (let i = 0; i < game.shields; i++) {
      const sx = heartsRight - 12 - i * 22;
      ctx.strokeStyle = COLORS.shardEdge;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(sx, 66, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Caught count, top-left of the net side.
  glowText(ctx, `CAUGHT ${game.caught}`, pad, VIEW.height - 28, {
    size: 13,
    color: COLORS.hudDim,
    align: 'left',
    blur: 0,
    letter: 2,
  });

  // Wave progress, a thin line along the bottom edge.
  const p = Math.max(0, Math.min(1, game.waveProgress));
  ctx.fillStyle = 'rgba(92, 242, 218, 0.14)';
  ctx.fillRect(pad, VIEW.height - 14, VIEW.width - pad * 2, 3);
  const grad = ctx.createLinearGradient(pad, 0, VIEW.width - pad, 0);
  grad.addColorStop(0, COLORS.seed);
  grad.addColorStop(1, COLORS.nova);
  ctx.fillStyle = grad;
  ctx.fillRect(pad, VIEW.height - 14, (VIEW.width - pad * 2) * p, 3);

  // Pause hint, bottom-right.
  glowText(ctx, 'P  PAUSE      M  MUTE', VIEW.width - pad, VIEW.height - 28, {
    size: 11,
    color: 'rgba(200, 226, 255, 0.34)',
    align: 'right',
    blur: 0,
    letter: 2,
  });

  // Bloom badge while time is stretched.
  if (game.bloom.active) {
    const a = Math.min(1, game.bloom.timer * 2);
    glowText(ctx, 'BLOOM', VIEW.width / 2, 118, {
      size: 13,
      color: COLORS.nova,
      blur: 16,
      alpha: 0.35 + 0.35 * a,
      letter: 4,
    });
  }
}

// ---------------------------------------------------------------- screens

/** The title card: name, story, controls, and the prompt. */
export function drawTitle(ctx, game) {
  const cx = VIEW.width / 2;

  // A dark well behind the text.
  const veil = ctx.createRadialGradient(cx, 330, 40, cx, 360, 620);
  veil.addColorStop(0, 'rgba(5, 3, 15, 0.82)');
  veil.addColorStop(1, 'rgba(5, 3, 15, 0.30)');
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const drift = Math.sin(game.time * 0.7) * 4;

  glowText(ctx, 'NOVA HARVEST', cx, 214 + drift, {
    size: 96,
    color: COLORS.white,
    blur: 34,
    weight: '700',
    letter: 6,
  });
  glowText(ctx, 'NOVA HARVEST', cx, 214 + drift, {
    size: 96,
    color: 'rgba(121, 255, 214, 0.35)',
    blur: 0,
    weight: '700',
    letter: 6,
    alpha: 0.9,
  });

  glowText(ctx, 'The sky is falling. Some of it is worth keeping.', cx, 292, {
    size: 21,
    color: 'rgba(220, 244, 255, 0.78)',
    blur: 8,
    weight: '400',
  });
  glowText(ctx, 'Pilot the skimmer. Open the light-net. Let the shards pass.', cx, 328, {
    size: 16,
    color: 'rgba(200, 226, 255, 0.45)',
    blur: 0,
    weight: '400',
  });

  // Controls, in two tidy columns.
  const panelW = 720;
  const panelX = cx - panelW / 2;
  ctx.fillStyle = 'rgba(9, 8, 30, 0.55)';
  roundRect(ctx, panelX, 384, panelW, 132, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92, 242, 218, 0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, panelX, 384, panelW, 132, 16);
  ctx.stroke();

  const rows = [
    ['MOVE', 'Arrows / WASD, or the mouse steers the hull'],
    ['CATCH', 'Star-seeds for score; golden novae pay 5x and slow time'],
    ['DODGE', 'Void shards cost a heart and reset the combo'],
    ['PAUSE / MUTE', 'P or Esc, and M'],
  ];
  rows.forEach(([key, text], i) => {
    const y = 414 + i * 29;
    glowText(ctx, key, panelX + 30, y, { size: 12, color: COLORS.net, align: 'left', blur: 0, letter: 2 });
    glowText(ctx, text, panelX + 190, y, { size: 15, color: 'rgba(220, 244, 255, 0.72)', align: 'left', blur: 0, weight: '400' });
  });

  // The prompt, breathing.
  const pulse = 0.55 + 0.45 * Math.sin(game.time * 2.4);
  glowText(ctx, 'Click or press Enter to start', cx, 596, {
    size: 27,
    color: COLORS.hud,
    blur: 22,
    weight: '600',
    alpha: pulse,
  });
  glowText(ctx, `BEST  ${String(game.best).padStart(5, '0')}`, cx, 646, {
    size: 13,
    color: COLORS.hudDim,
    blur: 0,
    letter: 4,
  });

  // A skimmer idling on the deck, so the title is not just type.
  const demo = { x: cx, y: SKIMMER.y + 24, tilt: Math.sin(game.time * 0.9) * 0.35, bob: 0 };
  drawSkimmer(ctx, demo, game.buffs, game.time, 0);
}

/** The between-wave offer: two cards, keys 1 and 2, click to choose. */
export function drawUpgrade(ctx, game) {
  ctx.fillStyle = 'rgba(4, 3, 14, 0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const cx = VIEW.width / 2;
  glowText(ctx, `WAVE ${game.wave} CLEARED`, cx, 128, {
    size: 34,
    color: COLORS.seed,
    blur: 26,
    weight: '700',
    letter: 5,
  });
  glowText(ctx, 'Choose one gift from the sky.', cx, 178, {
    size: 19,
    color: 'rgba(220, 244, 255, 0.66)',
    blur: 0,
    weight: '400',
  });
  glowText(ctx, `SCORE ${game.score}   ·   CAUGHT ${game.caught}   ·   ${game.hearts}/${game.maxHearts} HEARTS`, cx, 216, {
    size: 13,
    color: COLORS.hudDim,
    blur: 0,
    letter: 2,
  });

  const layout = choiceLayout(game.choices.length || 2);
  game.choices.forEach((upgrade, i) => {
    const box = layout.cardAt(i);
    const hovered = game.hoverChoice === i;
    const flash = game.choiceFlash && game.choiceFlash.id === upgrade.id ? game.choiceFlash.age : 0;

    ctx.save();
    if (hovered) ctx.translate(0, -6);

    // Card body.
    const body = ctx.createLinearGradient(box.x, box.y, box.x, box.y + box.h);
    body.addColorStop(0, hovered ? 'rgba(24, 40, 62, 0.96)' : COLORS.card);
    body.addColorStop(1, 'rgba(10, 9, 30, 0.96)');
    ctx.fillStyle = body;
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    ctx.fill();

    ctx.strokeStyle = hovered ? COLORS.net : 'rgba(92, 242, 218, 0.35)';
    ctx.lineWidth = hovered ? 2.4 : 1.2;
    ctx.shadowColor = COLORS.net;
    ctx.shadowBlur = hovered ? 26 : 10;
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Key badge.
    ctx.fillStyle = hovered ? COLORS.net : 'rgba(92, 242, 218, 0.16)';
    roundRect(ctx, box.x + 22, box.y + 20, 30, 30, 8);
    ctx.fill();
    glowText(ctx, String(i + 1), box.x + 37, box.y + 36, {
      size: 17,
      color: hovered ? COLORS.abyss : COLORS.net,
      blur: 0,
      weight: '700',
      font: FONT.mono,
    });

    // Tag.
    glowText(ctx, upgrade.tag, box.x + box.w - 22, box.y + 36, {
      size: 11,
      color: 'rgba(200, 226, 255, 0.42)',
      align: 'right',
      blur: 0,
      letter: 4,
    });

    // Name and rank.
    glowText(ctx, cardTitle(upgrade, game.buffs), box.x + 22, box.y + 106, {
      size: 30,
      color: COLORS.hud,
      align: 'left',
      blur: 12,
      weight: '700',
    });

    rule(ctx, box.x + 22, box.y + 132, box.w - 44);

    // Blurb.
    wrapText(ctx, upgrade.blurb, box.x + 22, box.y + 160, box.w - 44, 24, {
      size: 15,
      color: 'rgba(220, 244, 255, 0.66)',
    });

    // The concrete next step.
    glowText(ctx, `→ ${upgrade.detail(game.buffs)}`, box.x + 22, box.y + box.h - 58, {
      size: 16,
      color: COLORS.gold,
      align: 'left',
      blur: 8,
      weight: '600',
    });

    // Rank pips.
    for (let p = 0; p < upgrade.max; p++) {
      const filled = p < Math.min(upgrade.max, upgrade.level(game.buffs) + 1);
      ctx.fillStyle = filled ? COLORS.net : 'rgba(92, 242, 218, 0.16)';
      ctx.beginPath();
      ctx.arc(box.x + 26 + p * 15, box.y + box.h - 28, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (flash > 0) {
      ctx.globalAlpha = Math.max(0, 0.6 - flash);
      ctx.fillStyle = COLORS.net;
      roundRect(ctx, box.x, box.y, box.w, box.h, 18);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  });

  glowText(ctx, 'Click a card, or press 1 / 2', cx, layout.top + layout.h + 54, {
    size: 15,
    color: COLORS.hudDim,
    blur: 0,
    letter: 2,
  });
}

/** Game over: the numbers that matter, then the way back in. */
export function drawOver(ctx, game) {
  ctx.fillStyle = 'rgba(4, 3, 14, 0.76)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const cx = VIEW.width / 2;
  glowText(ctx, 'THE SKY WENT DARK', cx, 190, {
    size: 30,
    color: COLORS.danger,
    blur: 24,
    weight: '700',
    letter: 5,
  });
  glowText(ctx, 'GAME OVER', cx, 254, {
    size: 84,
    color: COLORS.white,
    blur: 34,
    weight: '700',
    letter: 8,
  });

  // A stat strip.
  const boxW = 640;
  const boxX = cx - boxW / 2;
  ctx.fillStyle = 'rgba(9, 8, 30, 0.72)';
  roundRect(ctx, boxX, 330, boxW, 150, 16);
  ctx.fill();
  ctx.strokeStyle = 'rgba(92, 242, 218, 0.24)';
  ctx.lineWidth = 1;
  roundRect(ctx, boxX, 330, boxW, 150, 16);
  ctx.stroke();

  const stats = [
    ['SCORE', String(game.score)],
    ['BEST', String(Math.max(game.best, game.score))],
    ['WAVE', String(game.wave)],
    ['CAUGHT', String(game.caught)],
  ];
  const colW = boxW / stats.length;
  stats.forEach(([label, value], i) => {
    const x = boxX + colW * i + colW / 2;
    glowText(ctx, label, x, 366, { size: 11, color: COLORS.hudDim, blur: 0, letter: 3 });
    glowText(ctx, value, x, 412, {
      size: 40,
      color: i === 0 ? COLORS.nova : COLORS.hud,
      blur: 14,
      weight: '700',
    });
  });

  if (game.newBest) {
    const t = (Math.sin(game.time * 4) + 1) / 2;
    glowText(ctx, 'NEW BEST', cx, 460, {
      size: 18,
      color: COLORS.gold,
      blur: 18,
      alpha: 0.55 + 0.45 * t,
      letter: 5,
    });
  }

  const pulse = 0.55 + 0.45 * Math.sin(game.time * 2.6);
  glowText(ctx, 'Press R or click to play again', cx, 556, {
    size: 26,
    color: COLORS.hud,
    blur: 20,
    alpha: pulse,
    weight: '600',
  });
  glowText(ctx, `Reached wave ${game.wave} · ${game.caught} seeds kept`, cx, 602, {
    size: 14,
    color: COLORS.hudDim,
    blur: 0,
  });
}

/** Pause: a thin veil, a big word, a reminder of the keys. */
export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(4, 3, 14, 0.62)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const cx = VIEW.width / 2;
  glowText(ctx, 'PAUSED', cx, 340, {
    size: 76,
    color: COLORS.hud,
    blur: 30,
    weight: '700',
    letter: 8,
  });
  glowText(ctx, 'The sky waits.', cx, 402, {
    size: 18,
    color: 'rgba(220, 244, 255, 0.55)',
    blur: 0,
    weight: '400',
  });
  glowText(ctx, 'P or Esc to resume   ·   M to mute', cx, 470, {
    size: 15,
    color: COLORS.net,
    blur: 8,
    letter: 2,
  });
}

/** Wrapping text helper: greedy by word, no measuring beyond advance widths. */
function wrapText(ctx, text, x, y, maxWidth, lineHeight, { size = 15, color = COLORS.hud, weight = '400', font = FONT.display } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const words = text.split(' ');
  let line = '';
  let row = 0;
  for (const word of words) {
    const test = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(test).width > maxWidth && line !== '') {
      ctx.fillText(line, x, y + row * lineHeight);
      line = word;
      row++;
    } else {
      line = test;
    }
  }
  if (line !== '') ctx.fillText(line, x, y + row * lineHeight);
  ctx.restore();
}

// ---------------------------------------------------------------- the frame

/**
 * The one entry point the loop calls: field, then whatever the scene asks for. Shake is applied
 * by main.js around this call, so nothing here has to know about it.
 */
export function render(ctx, game) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  game.field.draw(ctx);

  if (game.scene === 'title') {
    drawTitle(ctx, game);
    return;
  }

  // Falling world: shards behind, seeds in front of them, then creatures of light on top.
  for (const shard of game.entities.shards) drawShard(ctx, shard);
  for (const seed of game.entities.seeds) drawSeed(ctx, seed, game.time);

  drawSkimmer(ctx, game.skimmer, game.buffs, game.time, game.hurtFlash);

  drawRipples(ctx, game.entities.ripples);
  drawParticles(ctx, game.entities.particles);
  drawTexts(ctx, game.entities.texts);

  if (game.scene !== 'over') drawHud(ctx, game);

  if (game.scene === 'upgrade') drawUpgrade(ctx, game);
  else if (game.scene === 'paused') drawPause(ctx, game);
  else if (game.scene === 'over') drawOver(ctx, game);

  // The bloom wash: a golden edge glow while time is stretched.
  if (game.bloom.active && game.scene === 'play') {
    const t = Math.min(1, game.bloom.timer * 1.8);
    const halo = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.3, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
    halo.addColorStop(0, 'rgba(255, 212, 105, 0)');
    halo.addColorStop(1, `rgba(255, 212, 105, ${(0.16 * t).toFixed(3)})`);
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
