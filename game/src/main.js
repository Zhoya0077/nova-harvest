// Boot and the loop. Creates the canvas context, wires input and sound, drives a fixed-timestep
// simulation with a variable-rate render, and applies the screen shake. In ?shot= mode it builds
// one frozen scene and draws it exactly once, so a screenshot is deterministic.

import { TIMING, VIEW } from './config.js';
import { createInput } from './input.js';
import * as audio from './audio.js';
import { createGame, loadBest, timeScale } from './game.js';
import { render } from './render.js';
import { applyShot, readShotParams } from './shots.js';

/** The audio module's exports, bundled into the shape game.js expects. */
const sfx = {
  catch: audio.sfxCatch,
  nova: audio.sfxNova,
  hurt: audio.sfxHurt,
  shard: audio.sfxShard,
  upgrade: audio.sfxUpgrade,
  wave: audio.sfxWave,
  shield: audio.sfxShield,
  gameOver: audio.sfxGameOver,
  pulse: audio.sfxPulse,
};

/** A silent sfx bag, used while a frozen scene is being drawn. */
const silent = Object.fromEntries(Object.keys(sfx).map((k) => [k, () => {}]));

function boot() {
  const canvas = document.getElementById('stage');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;

  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  ctx.imageSmoothingEnabled = true;

  const input = createInput(canvas);
  audio.loadMute();

  const shot = readShotParams(window.location.search);
  const seed = shot ? shot.seed : Date.now();
  const game = createGame({ seed, sfx: shot ? silent : sfx });

  // The best score is read from storage by createGame; fall back to it if the run resets it.
  game.best = Math.max(game.best, shot ? 0 : loadBest());

  // A sound needs a gesture: unlock on the first key or click, once.
  const unlock = () => {
    audio.unlock();
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  if (shot) {
    applyShot(game, shot.shot, shot.seed);
    // Draw a handful of frames so particles settle into a natural-looking spread, then stop.
    for (let i = 0; i < 3; i++) drawWorld(ctx, game, game.rng);
    document.documentElement.dataset.shot = shot.shot;
    document.documentElement.dataset.seed = String(shot.seed);
    return;
  }

  let last = performance.now();
  let acc = 0;

  /** One rendered frame: simulation steps, then the world, with the shake wrapped around it. */
  function frame(now) {
    const elapsed = Math.min(0.25, (now - last) / 1000);
    last = now;

    const scale = timeScale(game);
    acc += elapsed * scale;

    let steps = 0;
    while (acc >= TIMING.fixedStep && steps < TIMING.maxSteps) {
      stepOnce(game, input, TIMING.fixedStep);
      acc -= TIMING.fixedStep;
      steps++;
    }
    // Dropping frames is better than spiralling: if we fell far behind, discard the backlog.
    if (acc > TIMING.fixedStep * TIMING.maxSteps) acc = 0;

    drawWorld(ctx, game, game.rng);
    input.endFrame(elapsed);
    requestAnimationFrame(frame);
  }

  // A clear pause when the tab goes away, so the Keeper does not come back to a dead hull.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.scene === 'play') {
      game.scene = 'paused';
      game.sceneTime = 0;
    }
    last = performance.now();
    acc = 0;
  });

  requestAnimationFrame(frame);
}

/** A single simulation tick, plus the two global keys that are not the game's business. */
function stepOnce(game, input, dt) {
  if (input.consume('KeyM')) audio.toggleMute();
  game.step(dt, input);
}

/** Draw the world, applying the shake offset and then putting the canvas back how it was. */
function drawWorld(ctx, game, rng) {
  const shake = game.shake || 0;
  if (shake <= 0.001) {
    render(ctx, game);
    return;
  }
  const power = shake * shake * 16;
  const ox = Math.sin(game.time * 61.3) * power + (rng.next() - 0.5) * power * 0.6;
  const oy = Math.cos(game.time * 47.7) * power + (rng.next() - 0.5) * power * 0.6;
  ctx.save();
  ctx.translate(ox, oy);
  render(ctx, game);
  ctx.restore();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
