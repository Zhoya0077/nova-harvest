// ?shot= scenes. A screenshot has to look like the game at its best and be identical every run,
// so each scene is built by hand from a seeded RNG rather than by simulating until something
// interesting happens. `?seed=N` picks the seed; `?shot=` with no seed uses 1.

import { NET, SKIMMER, VIEW } from './config.js';
import { makeRng } from './random.js';
import { UPGRADES, defaultBuffs } from './upgrades.js';
import { createField } from './field.js';

/** The scenes shots.json asks for, in the order a reader should see them. */
export const SHOT_SCENES = ['start', 'play', 'upgrade', 'end'];

/** Read ?shot= and ?seed= from a URL search string. Null when there is no usable shot. */
export function readShotParams(search) {
  const params = new URLSearchParams(search);
  const shot = (params.get('shot') ?? '').toLowerCase().trim();
  if (!SHOT_SCENES.includes(shot)) return null;
  const seedRaw = params.get('seed');
  const seed = seedRaw !== null && Number.isFinite(Number(seedRaw)) ? Math.trunc(Number(seedRaw)) : 1;
  return { shot, seed };
}

/**
 * Freeze `game` into the requested scene. Returns true when a shot was set up. The game's own
 * arrays are filled directly, so nothing in the normal loop needs to know this exists.
 */
export function applyShot(game, shot, seed) {
  const rng = makeRng(`shot:${shot}:${seed}`);
  game.seed = seed;

  // Every scene gets a fresh, seeded backdrop; the field is rebuilt so its stars match the seed.
  game.field = createField(rng);
  game.entities.reset();
  game.time = 2.4;
  game.best = Math.max(game.best, 1840);

  if (shot === 'start') {
    game.scene = 'title';
    game.score = 0;
    game.caught = 0;
    game.wave = 1;
    game.buffs = defaultBuffs();
    game.maxHearts = 3;
    game.hearts = 3;
    game.skimmer.x = VIEW.width / 2;
    game.skimmer.y = SKIMMER.y;
    return true;
  }

  // The three in-run scenes share a mid-game state, then diverge.
  game.scene = 'play';
  game.score = 1230 + rng.int(0, 60);
  game.caught = 47;
  game.wave = 4;
  game.buffs = defaultBuffs();
  game.buffs.netWidth = NET.widthBase + NET.widthStep * 2;
  game.buffs.magnetRadius = 90;
  game.buffs.maxHearts = 4;
  game.maxHearts = 4;
  game.hearts = 3;
  game.shields = 1;
  game.combo = 5;
  game.comboCount = 1;
  game.comboProgress = 0.5;
  game.waveTimer = 22.5;
  game.waveCatches = 11;
  game.waveProgress = 0.44;
  game.skimmer.x = VIEW.width / 2 - 40;
  game.skimmer.y = SKIMMER.y;
  game.skimmer.tilt = 0.35;

  // A hand-placed sky: seeds spread across the lanes, shards between them, one nova high up.
  const seedSpots = [
    [-430, 210], [-250, 330], [-90, 150], [120, 268], [300, 190],
    [430, 360], [40, 400], [-330, 470], [250, 430], [-150, 560],
  ];
  seedSpots.forEach(([dx, y], i) => {
    const seed2 = game.entities.spawn('seed', VIEW.width / 2 + dx + rng.range(-8, 8));
    seed2.y = y + rng.range(-10, 10);
    seed2.vy = 120 + i * 4;
  });

  const nova = game.entities.spawn('nova', VIEW.width / 2 + 150);
  nova.y = 250;
  nova.vy = 130;

  const shardSpots = [[-180, 260], [200, 340], [-20, 480], [360, 520]];
  shardSpots.forEach(([dx, y]) => {
    const shard = game.entities.spawn('shard', VIEW.width / 2 + dx + rng.range(-14, 14));
    shard.y = y;
    shard.vy = 150;
  });

  // A catch mid-flight, so particles, a ripple and floating score text are all on screen.
  game.entities.burst(VIEW.width / 2 + 96, 610, '#79ffd6', 1.2);
  game.entities.ripple(VIEW.width / 2 + 96, 610, '#5cf2da', 1.2);
  game.entities.float(VIEW.width / 2 + 96, 588, '+50', '#ffd469', 1.25);
  game.entities.float(VIEW.width / 2 + 96, 556, 'x5', '#ffcf5c', 0.9);

  if (shot === 'upgrade') {
    game.scene = 'upgrade';
    game.choices = [UPGRADES[0], UPGRADES[4]];
    game.hoverChoice = 0;
    game.wave = 4;
    game.score = 1480;
    game.caught = 52;
    game.hearts = 3;
    game.maxHearts = 4;
  }

  if (shot === 'end') {
    game.scene = 'over';
    game.score = 2635;
    game.best = 2635;
    game.newBest = true;
    game.wave = 6;
    game.caught = 88;
    game.hearts = 0;
    game.combo = 1;
    game.comboProgress = 0;
    // Fewer falling things behind the panel: the run is over, the sky is emptying.
    game.entities.seeds.splice(3);
    game.entities.shards.splice(2);
  }

  return true;
}
