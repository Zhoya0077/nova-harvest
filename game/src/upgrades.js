// The upgrade pool. Six lanes of growth, each with a cap and a level read off the live buff sheet,
// so there is one source of truth: what the buffs say is what the cards show. Between waves the
// game offers two open lanes; the Keeper picks one by click or by key 1 / 2.

import { BLOOM, LIMITS, NET, SKIMMER, VIEW } from './config.js';

/** The buff sheet a run starts with: mutable, copied fresh per run. */
const BASE_HEARTS = 3;

export function defaultBuffs() {
  return {
    netWidth: NET.widthBase,
    magnetRadius: 0,
    maxHearts: BASE_HEARTS,
    bloomSeconds: BLOOM.secondsBase,
    shieldPerWave: 0,
    moveSpeed: SKIMMER.speedBase,
  };
}

/**
 * The pool, in display order. Each lane knows how to read its level off the buffs (`level`), how
 * to take one step (`take`) and what the next step says on its card (`detail`). Levels are
 * integers from 0 (untouched); `max` is the most a lane may be taken.
 */
export const UPGRADES = [
  {
    id: 'net',
    name: 'Wider Net',
    tag: 'NET',
    max: 4,
    step: NET.widthStep,
    blurb: 'The light-net stretches wider. Same arms, more sky.',
    level: (buffs) => Math.round((buffs.netWidth - NET.widthBase) / NET.widthStep),
    take(buffs) {
      buffs.netWidth = Math.min(LIMITS.maxNet, buffs.netWidth + NET.widthStep);
    },
    detail: (buffs) => `net ${Math.round(buffs.netWidth + NET.widthStep)}px wide`,
  },
  {
    id: 'magnet',
    name: 'Magnet Aura',
    tag: 'PULL',
    max: 3,
    step: 45,
    blurb: 'Seeds lean toward the hull from a handspan away.',
    level: (buffs) => Math.round(buffs.magnetRadius / 45),
    take(buffs) {
      buffs.magnetRadius = Math.min(LIMITS.maxMagnet, buffs.magnetRadius + 45);
    },
    detail: (buffs) => `${Math.round(buffs.magnetRadius + 45)}px reach`,
  },
  {
    id: 'heart',
    name: 'Extra Heart',
    tag: 'HULL',
    max: LIMITS.maxHearts - BASE_HEARTS,
    step: 1,
    blurb: 'A spare pressure cell, and the hull patched around it.',
    level: (buffs) => Math.max(0, buffs.maxHearts - BASE_HEARTS),
    take(buffs) {
      buffs.maxHearts = Math.min(LIMITS.maxHearts, buffs.maxHearts + 1);
    },
    detail: (buffs) => `${Math.min(LIMITS.maxHearts, buffs.maxHearts + 1)} hearts, refilled`,
  },
  {
    id: 'bloom',
    name: 'Longer Bloom',
    tag: 'TIME',
    max: 3,
    step: 0.55,
    blurb: 'The nova slow-motion lingers while the sky breathes out.',
    level: (buffs) => Math.round((buffs.bloomSeconds - BLOOM.secondsBase) / 0.55),
    take(buffs) {
      buffs.bloomSeconds = Math.min(LIMITS.maxBloom, buffs.bloomSeconds + 0.55);
    },
    detail: (buffs) => `${(Math.min(LIMITS.maxBloom, buffs.bloomSeconds + 0.55)).toFixed(2)}s bloom`,
  },
  {
    id: 'shield',
    name: 'Shard Shield',
    tag: 'WARD',
    max: LIMITS.maxShields,
    step: 1,
    blurb: 'Woven light that eats one shard per wave, then reweaves.',
    level: (buffs) => buffs.shieldPerWave,
    take(buffs) {
      buffs.shieldPerWave = Math.min(LIMITS.maxShields, buffs.shieldPerWave + 1);
    },
    detail: (buffs) => `${Math.min(LIMITS.maxShields, buffs.shieldPerWave + 1)} charge${buffs.shieldPerWave + 1 === 1 ? '' : 's'} per wave`,
  },
  {
    id: 'swift',
    name: 'Swift Skimmer',
    tag: 'DRIVE',
    max: 4,
    step: 150,
    blurb: 'Hotter thrusters: the hull answers before you ask.',
    level: (buffs) => Math.round((buffs.moveSpeed - SKIMMER.speedBase) / 150),
    take(buffs) {
      buffs.moveSpeed = Math.min(LIMITS.maxSpeed, buffs.moveSpeed + 150);
    },
    detail: (buffs) => `${Math.round(Math.min(LIMITS.maxSpeed, buffs.moveSpeed + 150))} u/s`,
  },
];

/** The lane with this id, or undefined. */
export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id);
}

/** How many times a lane has been taken (0 when never). */
export function levelOf(upgrade, buffs) {
  return Math.max(0, Math.min(upgrade.max, upgrade.level(buffs)));
}

/** True when the lane still has room. */
export function isOpen(upgrade, buffs) {
  return levelOf(upgrade, buffs) < upgrade.max;
}

/** The lanes still open, in pool order. */
export function openUpgrades(buffs) {
  return UPGRADES.filter((u) => isOpen(u, buffs));
}

/**
 * Two distinct offers from the open lanes, new lanes first so a run samples the whole pool before
 * deepening one. `rng` is the run's generator: a seeded run offers the same pair every time.
 */
export function offerChoices(buffs, rng, count = 2) {
  const open = openUpgrades(buffs);
  if (open.length === 0) return [];
  const fresh = open.filter((u) => levelOf(u, buffs) === 0);
  const pool = fresh.length >= count ? fresh : open;
  return rng.shuffle(pool).slice(0, count);
}

/**
 * Take a lane. Returns a short report the game can flash on screen; `changed` is false when the
 * lane was already at its cap, so the caller can skip the fanfare.
 */
export function applyUpgrade(upgrade, buffs) {
  const before = levelOf(upgrade, buffs);
  upgrade.take(buffs);
  const after = levelOf(upgrade, buffs);
  return {
    id: upgrade.id,
    name: upgrade.name,
    detail: upgrade.detail(buffs),
    level: after,
    changed: after !== before,
  };
}

/** A roman numeral for a card's rank, falling back to digits past V. */
const NUMERALS = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];

/** The offer's headline: the lane's name with the rank it would reach, e.g. "Wider Net II". */
export function cardTitle(upgrade, buffs) {
  const next = Math.min(upgrade.max, levelOf(upgrade, buffs) + 1);
  return `${upgrade.name} ${NUMERALS[next] ?? next}`;
}

/**
 * The screen geometry of the two offer cards, shared by render.js (drawing) and game.js (hit
 * testing) so a click lands where the eye says it should.
 */
export function choiceLayout(count = 2) {
  const w = 380;
  const h = 300;
  const gap = 46;
  const totalW = w * count + gap * (count - 1);
  const left = (VIEW.width - totalW) / 2;
  const top = 296;
  return {
    w,
    h,
    top,
    cardAt(i) {
      return { x: left + i * (w + gap), y: top, w, h };
    },
  };
}

/** Which offer a click at (x, y) landed on, or -1. */
export function hitChoice(choices, x, y) {
  const layout = choiceLayout(choices.length || 2);
  for (let i = 0; i < choices.length; i++) {
    const box = layout.cardAt(i);
    if (x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) return i;
  }
  return -1;
}
