// NOVA HARVEST — hand-in program for the make.fun "best-game-01" bounty.
//
// The game itself is game/: an original neon arcade catcher called NOVA HARVEST, where the Keeper
// pilots a hover skimmer under a light-net, harvesting falling star-seeds while dodging void
// shards. Everything it draws or plays is generated in code, so the entry is a handful of plain
// source files a desktop browser can open offline.
//
// This program stages that entry and writes its dossier:
//   1. copy game/ and screenshots/ from beside this file into the output directory
//      (process.env.MAKEFUN_OUTPUT_DIR, else /output), replacing what was there;
//   2. run make.fun's own buildDossier over the staged copy, so the dossier the scorer recomputes
//      matches byte for byte;
//   3. write dossier.json into the output directory.
//
// Node 22 runs this as-is: no build, no flags, no dependencies beyond vendor/makefun-game.ts.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildDossier } from './vendor/makefun-game.ts';

/** The entry's caps, exactly as best-game-01's gate.json names them. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

/** The name the bounty looks for. */
const DOSSIER_NAME = 'dossier.json';

/** Where this program lives: the repository root that holds game/, screenshots/ and vendor/. */
const HERE = dirname(fileURLToPath(import.meta.url));

/** The staging directory, from the environment or the platform's convention. */
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/**
 * Copy one entry directory into the output directory. An existing copy is removed first so a
 * rerun never leaves a stale file behind that the dossier would then count.
 */
function stage(name: string): void {
  const from = join(HERE, name);
  const to = join(OUTPUT_DIR, name);
  if (!existsSync(from)) throw new Error(`${name}/ is missing beside ${HERE}: nothing to hand in`);
  if (!statSync(from).isDirectory()) throw new Error(`${name} is not a directory`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

/** The staged tree, as a couple of counts worth printing. */
function countOf(name: string): { files: number; bytes: number } {
  const root = join(OUTPUT_DIR, name);
  let files = 0;
  let bytes = 0;
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) {
        files++;
        bytes += statSync(path).size;
      }
    }
  };
  walk(root);
  return { files, bytes };
}

/** Stage the entry, write its dossier, and say what happened. */
function main(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  stage('game');
  stage('screenshots');

  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  writeFileSync(join(OUTPUT_DIR, DOSSIER_NAME), dossier);

  const game = countOf('game');
  const shots = countOf('screenshots');
  console.log(`NOVA HARVEST: staged game/ (${game.files} files, ${game.bytes} bytes) and screenshots/ (${shots.files} files, ${shots.bytes} bytes)`);
  console.log(`${DOSSIER_NAME}: ${dossier.byteLength} bytes in ${OUTPUT_DIR}`);
  console.log('NOVA HARVEST — the Keeper, the light-net and the falling sky are ready to hand in.');
}

main();
