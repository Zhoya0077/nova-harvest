// NOVA HARVEST — tuning sheet. Everything a designer would want to twist lives here:
// the internal canvas, the neon palette, the wave curve, scoring and buff defaults.

export const VIEW = { width: 1280, height: 800 };

export const COLORS = {
  night: '#05030f',
  abyss: '#0a0722',
  nebulaA: 'rgba(96, 46, 178, 0.34)',
  nebulaB: 'rgba(18, 118, 172, 0.26)',
  nebulaC: 'rgba(206, 58, 142, 0.18)',
  nebulaD: 'rgba(40, 190, 160, 0.12)',
  starFar: 'rgba(168, 188, 255, 0.42)',
  starMid: 'rgba(214, 228, 255, 0.68)',
  starNear: '#ffffff',
  seed: '#79ffd6',
  seedCore: '#f2fffb',
  seedTail: 'rgba(121, 255, 214, 0.30)',
  nova: '#ffd469',
  novaCore: '#fff8de',
  novaTail: 'rgba(255, 212, 105, 0.34)',
  shard: '#9a63ff',
  shardEdge: '#e6d8ff',
  shardCore: '#2a1248',
  hull: '#152139',
  hullEdge: '#3ce3c2',
  hullGlass: '#9ff6e6',
  net: '#5cf2da',
  netDim: 'rgba(92, 242, 218, 0.20)',
  hud: '#dcf4ff',
  hudDim: 'rgba(200, 226, 255, 0.52)',
  danger: '#ff5f7d',
  gold: '#ffcf5c',
  panel: 'rgba(9, 8, 30, 0.86)',
  panelEdge: 'rgba(92, 242, 218, 0.55)',
  card: 'rgba(16, 14, 44, 0.92)',
  white: '#ffffff',
};

export const FONT = {
  display: '"Trebuchet MS", "Segoe UI", Verdana, sans-serif',
  mono: '"SF Mono", "Consolas", "Menlo", monospace',
};

// The Keeper's skimmer: a hover hull with the light-net slung beneath it.
export const SKIMMER = {
  y: 690,
  hover: 5,
  halfWidth: 44,
  height: 26,
  breathe: 2.4,
  speedBase: 820,
  speedRamp: 120,
  maxSpeed: 1500,
  mouseLerp: 14,
  edgePad: 56,
};

export const NET = {
  y: 748,
  widthBase: 216,
  widthStep: 58,
  widthMax: 430,
  sag: 16,
  arms: 7,
};

export const PULSE = {
  cooldown: 0.30,
  speed: 1480,
  radius: 9,
  damageScore: 15,
  muzzle: 26,
};

export const SCORE = {
  seed: 10,
  nova: 50,
  heartBonus: 120,
  waveBonus: 60,
};

export const COMBO = {
  step: 2,        // catches per multiplier rung
  max: 8,         // x1 .. x8
  seedOnGroundPenalty: 0,  // combo resets; no score taken
};

export const WAVES = {
  seconds: 60,
  catches: 25,
  fallSpeed: (wave) => Math.min(560, 168 + 44 * (wave - 1)),
  fallSpread: (wave) => Math.min(150, 40 + 9 * (wave - 1)),
  spawnInterval: (wave) => Math.max(0.30, 0.94 - 0.072 * (wave - 1)),
  shardChance: (wave) => Math.min(0.36, 0.11 + 0.036 * (wave - 1)),
  novaChance: 0.055,
  doubleChance: (wave) => Math.min(0.42, 0.08 * (wave - 2)),
  drift: (wave) => Math.min(90, 14 + 7 * (wave - 1)),
};

export const BLOOM = {
  factor: 0.36,      // sim time is multiplied by this during a bloom
  secondsBase: 1.35,
  pulseScore: 60,
};

export const BUFFS = {
  netWidth: NET.widthBase,
  magnetRadius: 0,
  magnetPull: 210,
  maxHearts: 5,
  bloomSeconds: BLOOM.secondsBase,
  shieldPerWave: 0,
  moveSpeed: SKIMMER.speedBase,
};

export const LIMITS = {
  maxHearts: 5,
  maxNet: NET.widthMax,
  maxMagnet: 190,
  maxShields: 3,
  maxSpeed: SKIMMER.maxSpeed,
  maxBloom: 4.4,
};

export const STORAGE = {
  best: 'nova-harvest.best',
  mute: 'nova-harvest.mute',
};

export const TIMING = {
  fixedStep: 1 / 60,
  maxSteps: 5,
  shakeDecay: 30,
  hurtInvuln: 0.9,
};
