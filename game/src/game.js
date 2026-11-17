// The run itself: a small state machine over title → play → upgrade ⇄ play → … → over, with a
// pause toggle that never forgets where it came from. Collisions, combo, waves and scoring live
// here; drawing is render.js' job and motion is entities.js'.

import { BLOOM, COMBO, NET, SCORE, SKIMMER, STORAGE, TIMING, VIEW, WAVES } from './config.js';
import { createEntities, pointsFor } from './entities.js';
import { createField } from './field.js';
import { makeRng } from './random.js';
import { applyUpgrade, defaultBuffs, hitChoice, offerChoices } from './upgrades.js';

/** How far the net hangs below the hull's resting y (the tuning's rest offset). */
export const NET_DROP = NET.y - SKIMMER.y;

/** Vertical room the hull may use: up for reach, down toward the deck. */
const Y_MIN = SKIMMER.y - 64;
const Y_MAX = SKIMMER.y + 26;

const C_DANGER = '#ff5f7d';
const C_SHARD_EDGE = '#e6d8ff';
const C_NOVA = '#ffd469';

/** Read the stored best score, tolerating a locked-down browser. */
export function loadBest() {
  try {
    const raw = window.localStorage.getItem(STORAGE.best);
    const n = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Persist the best score, best effort. */
function saveBest(value) {
  try {
    window.localStorage.setItem(STORAGE.best, String(value));
  } catch {
    /* storage is optional */
  }
}

/**
 * A whole game. `sfx` is the audio module's function bag, passed in so the game can be run headless
 * with silent stubs (shots.js does exactly that when it freezes a scene).
 */
export function createGame({ seed = Date.now(), sfx }) {
  const rng = makeRng(seed);
  const entities = createEntities(rng);
  const field = createField(rng);

  const game = {
    seed,
    rng,
    sfx,
    scene: 'title',
    time: 0,
    /** Seconds the current scene has been up, for fades and card flashes. */
    sceneTime: 0,

    score: 0,
    best: loadBest(),
    newBest: false,
    caught: 0,
    hearts: 3,
    maxHearts: 3,
    shields: 0,
    combo: 1,
    comboCount: 0,
    comboProgress: 0,
    wave: 1,

    /** Wave clock in simulated seconds and the catch quota, either of which ends a wave. */
    waveTimer: 0,
    waveCatches: 0,
    waveProgress: 0,

    bloom: { active: false, timer: 0 },
    shake: 0,
    hurtFlash: 0,

    choices: [],
    hoverChoice: -1,
    choiceFlash: null,

    buffs: defaultBuffs(),
    entities,
    field,
    skimmer: { x: VIEW.width / 2, y: SKIMMER.y, tilt: 0, bob: 0 },
  };

  // ------------------------------------------------------------ run setup

  /** One fresh run, leaving the best score and the RNG stream alone. */
  game.beginRun = function beginRun() {
    game.score = 0;
    game.caught = 0;
    game.buffs = defaultBuffs();
    game.maxHearts = game.buffs.maxHearts;
    game.hearts = game.maxHearts;
    game.shields = game.buffs.shieldPerWave;
    game.combo = 1;
    game.comboCount = 0;
    game.comboProgress = 0;
    game.wave = 1;
    game.waveTimer = 0;
    game.waveCatches = 0;
    game.waveProgress = 0;
    game.bloom.active = false;
    game.bloom.timer = 0;
    game.shake = 0;
    game.hurtFlash = 0;
    game.newBest = false;
    game.choices = [];
    game.choiceFlash = null;
    game.hoverChoice = -1;
    game.skimmer.x = VIEW.width / 2;
    game.skimmer.y = SKIMMER.y;
    game.skimmer.tilt = 0;
    game.entities.reset();
    game.entities.setWave(1);
    game.scene = 'play';
    game.sceneTime = 0;
  };

  /** Start from the title: a brand new run. */
  game.start = function start() {
    game.beginRun();
    game.sfx.wave();
  };

  /** Back to the title, sky cleared. */
  game.toTitle = function toTitle() {
    game.scene = 'title';
    game.sceneTime = 0;
    game.entities.reset();
    game.skimmer.x = VIEW.width / 2;
    game.skimmer.y = SKIMMER.y;
    game.choices = [];
  };

  /** End the run: commit the best, play the sting. */
  game.end = function end() {
    game.scene = 'over';
    game.sceneTime = 0;
    if (game.score > game.best) {
      game.best = game.score;
      game.newBest = true;
      saveBest(game.best);
    }
    game.entities.texts.length = 0;
    game.sfx.gameOver();
  };

  /** The wave budget is spent: bank the clear bonus and offer two upgrades. */
  game.openUpgrade = function openUpgrade() {
    game.score += SCORE.waveBonus + SCORE.heartBonus * game.hearts;
    game.choices = offerChoices(game.buffs, rng, 2);
    game.choiceFlash = null;
    game.hoverChoice = -1;
    game.scene = 'upgrade';
    game.sceneTime = 0;
    game.sfx.wave();
  };

  /** Take offer `index` (0 or 1), then dive into the next wave. Returns a small report or null. */
  game.chooseUpgrade = function chooseUpgrade(index) {
    const upgrade = game.choices[index];
    if (!upgrade) return null;
    const report = applyUpgrade(upgrade, game.buffs);
    game.choiceFlash = { id: upgrade.id, age: 0 };
    game.sfx.upgrade();
    game.maxHearts = game.buffs.maxHearts;
    if (upgrade.id === 'heart') game.hearts = Math.min(game.maxHearts, game.hearts + 1);
    game.hearts = Math.min(game.hearts, game.maxHearts);
    game.startWave(game.wave + 1);
    return report;
  };

  /** Set up wave `n`: repair the shields, re-arm the clock, tighten the spawns. */
  game.startWave = function startWave(n) {
    game.wave = n;
    game.waveTimer = 0;
    game.waveCatches = 0;
    game.waveProgress = 0;
    game.shields = game.buffs.shieldPerWave;
    game.entities.setWave(n);
    game.scene = 'play';
    game.sceneTime = 0;
    game.sfx.wave();
  };

  // ------------------------------------------------------------ events

  /** A catch. Climbs the combo ladder, pays out, and blooms on a nova. */
  function catchSeed(seed) {
    game.comboCount += 1;
    if (game.comboCount >= COMBO.step) {
      game.comboCount = 0;
      game.combo = Math.min(COMBO.max, game.combo + 1);
    }
    game.comboProgress = game.comboCount / COMBO.step;

    const points = pointsFor(seed.kind) * game.combo;
    game.score += points;
    game.caught += 1;
    game.waveCatches += 1;

    game.entities.celebrate(seed, game.combo, points);
    game.entities.kill(game.entities.seeds, seed);

    if (seed.kind === 'nova') {
      game.bloom.active = true;
      game.bloom.timer = game.buffs.bloomSeconds;
      game.score += BLOOM.pulseScore;
      game.entities.float(seed.x, seed.y - 66, 'BLOOM', C_NOVA, 1.1);
      game.sfx.nova();
    } else {
      game.sfx.catch(game.combo);
    }
  }

  /** A seed slipped past the net: the ladder snaps back to x1. */
  function missSeed(seed) {
    game.entities.fizzle(seed);
    game.entities.kill(game.entities.seeds, seed);
    if (game.combo > 1 || game.comboCount > 0) {
      game.combo = 1;
      game.comboCount = 0;
      game.comboProgress = 0;
      game.entities.float(seed.x, NET_DROP + SKIMMER.y - 6, 'COMBO LOST', C_DANGER, 0.8);
    }
  }

  /** A shard reached the hull: shield first, then a heart. Either way the ladder resets. */
  function takeHit(shard) {
    game.entities.shatter(shard);
    game.entities.kill(game.entities.shards, shard);
    game.combo = 1;
    game.comboCount = 0;
    game.comboProgress = 0;
    game.shake = 1;
    game.hurtFlash = 1;

    if (game.shields > 0) {
      game.shields -= 1;
      game.sfx.shield();
      game.entities.float(game.skimmer.x, game.skimmer.y - 74, 'SHIELD HELD', C_SHARD_EDGE, 0.95);
      return;
    }

    game.hearts -= 1;
    game.sfx.hurt();
    game.entities.burst(game.skimmer.x, game.skimmer.y, C_DANGER, 1.2);
    game.entities.float(game.skimmer.x, game.skimmer.y - 74, 'HULL BREACH', C_DANGER, 0.95);
    if (game.hearts <= 0) {
      game.hearts = 0;
      game.end();
    }
  }

  // ------------------------------------------------------------ the step

  /**
   * One fixed step. `dt` is the time the world advances, already scaled for bloom by the caller;
   * `input` is the polled keyboard/mouse state. Scenes that are not 'play' ignore the world.
   */
  game.step = function step(dt, input) {
    game.time += dt;
    game.sceneTime += dt;

    if (game.scene === 'title') {
      game.field.update(dt, 90);
      if (input.tapped('Enter', 'Space', 'KeyR', 'Pointer')) game.start();
      return;
    }

    if (game.scene === 'over') {
      game.field.update(dt, 60);
      for (const seed of game.entities.seeds) seed.y += seed.vy * dt * 0.25;
      if (input.tapped('KeyR', 'Enter', 'Space')) game.start();
      return;
    }

    if (game.scene === 'paused') {
      if (input.tapped('KeyP', 'Escape')) game.scene = 'play';
      return;
    }

    if (game.scene === 'upgrade') {
      game.field.update(dt, 40);
      game.updateHover(input);
      if (input.tapped('Digit1', 'Numpad1')) game.chooseUpgrade(0);
      else if (input.tapped('Digit2', 'Numpad2')) game.chooseUpgrade(1);
      else if (input.tapped('Pointer')) {
        const at = game.hitTest(input.pointer.x, input.pointer.y);
        if (at >= 0) game.chooseUpgrade(at);
      }
      if (game.choiceFlash) game.choiceFlash.age += dt * 2.4;
      return;
    }

    // ---- play
    if (input.tapped('KeyP', 'Escape')) {
      game.scene = 'paused';
      game.sceneTime = 0;
      return;
    }

    game.steer(dt, input);
    game.field.update(dt, WAVES.fallSpeed(game.wave) * 0.6);
    game.entities.step(dt);
    game.collide(dt);

    if (game.shake > 0) game.shake = Math.max(0, game.shake - TIMING.shakeDecay * dt);
    if (game.hurtFlash > 0) game.hurtFlash = Math.max(0, game.hurtFlash - dt * 3.2);

    if (game.bloom.active) {
      game.bloom.timer -= dt / BLOOM.factor;
      if (game.bloom.timer <= 0) {
        game.bloom.active = false;
        game.bloom.timer = 0;
      }
    }

    // Wave budget: the clock or the catch quota, whichever fills first.
    game.waveTimer += dt;
    const timeFrac = Math.min(1, game.waveTimer / WAVES.seconds);
    const catchFrac = Math.min(1, game.waveCatches / WAVES.catches);
    game.waveProgress = Math.max(timeFrac, catchFrac);
    if (game.waveProgress >= 1) game.openUpgrade();
  };

  /** Steering: keys win while held, the mouse takes over when it is recent and the keys are idle. */
  game.steer = function steer(dt, input) {
    const ax = input.axisX();
    const ay = input.axisY();
    const skimmer = game.skimmer;

    if (ax !== 0) {
      skimmer.x += ax * game.buffs.moveSpeed * dt;
      skimmer.tilt += (ax - skimmer.tilt) * Math.min(1, 10 * dt);
    } else if (input.pointer.inside && input.pointer.idle < 0.45) {
      const k = 1 - Math.exp(-SKIMMER.mouseLerp * dt);
      const dx = (input.pointer.x - skimmer.x) * k;
      skimmer.x += dx;
      const want = Math.max(-1, Math.min(1, dx * 0.07));
      skimmer.tilt += (want - skimmer.tilt) * Math.min(1, 12 * dt);
    } else {
      skimmer.tilt += (0 - skimmer.tilt) * Math.min(1, 6 * dt);
    }

    if (ay !== 0) skimmer.y += ay * game.buffs.moveSpeed * 0.42 * dt;

    const pad = SKIMMER.edgePad;
    skimmer.x = Math.max(pad, Math.min(VIEW.width - pad, skimmer.x));
    skimmer.y = Math.max(Y_MIN, Math.min(Y_MAX, skimmer.y));
    skimmer.bob = Math.sin(game.time * 2.1) * 1.5;
  };

  /** Catches, shard hits, seeds lost below the net — and the magnet that bends them. */
  game.collide = function collide(dt) {
    const skimmer = game.skimmer;
    const netY = skimmer.y + NET_DROP;
    const half = game.buffs.netWidth / 2;
    const magnet = game.buffs.magnetRadius;

    // The aura leans seeds toward the net before the catch test runs. Bounded by dt, so the pull
    // is the same strength on a slow frame as on a fast one.
    if (magnet > 0) {
      const step = Math.min(0.05, dt || 0);
      for (const seed of game.entities.seeds) {
        const dx = skimmer.x - seed.x;
        const dy = netY - seed.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < magnet) {
          const strength = (1 - dist / magnet) * 150 * step;
          seed.x += (dx / dist) * strength;
          seed.y += (dy / dist) * strength * 0.35;
        }
      }
    }

    for (let i = game.entities.seeds.length - 1; i >= 0; i--) {
      const seed = game.entities.seeds[i];
      const withinNet = Math.abs(seed.x - skimmer.x) <= half + seed.radius * 0.6;
      const atNet = seed.y + seed.radius >= netY - 6;
      if (atNet && withinNet) {
        catchSeed(seed);
        continue;
      }
      if (seed.y - seed.radius > netY + 34) missSeed(seed);
    }

    for (let i = game.entities.shards.length - 1; i >= 0; i--) {
      const shard = game.entities.shards[i];
      const dx = shard.x - skimmer.x;
      const dy = shard.y - (skimmer.y - 2);
      const reach = shard.radius + 24;
      if (dx * dx + dy * dy <= reach * reach) {
        takeHit(shard);
        if (game.scene === 'over') return;
      }
    }
  };

  // ------------------------------------------------------------ upgrade screen helpers

  /** Highlight the offer under the cursor. */
  game.updateHover = function updateHover(input) {
    game.hoverChoice = input.pointer.inside ? game.hitTest(input.pointer.x, input.pointer.y) : -1;
  };

  /** Which offer, if any, is under (x, y). Delegates to the shared card layout. */
  game.hitTest = function hitTest(x, y) {
    return hitChoice(game.choices, x, y);
  };

  return game;
}

/** The scale the world runs at this instant: slowed during a nova bloom, otherwise real time. */
export function timeScale(game) {
  return game.bloom.active ? BLOOM.factor : 1;
}
