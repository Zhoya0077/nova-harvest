[![make.fun best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/Zhoya0077/nova-harvest/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/Zhoya0077/nova-harvest/reward.svg)](https://make.fun/bounty/best-game-01)

# NOVA HARVEST

A neon arcade catcher for the browser. The sky above the last dark world is coming apart, and most
of what falls is only worth the catching. You are the Keeper: one hover skimmer, one light-net, and
a horizon full of star-seeds that are worth something if they land in it.

Catch the mint seeds. Catch a golden nova when you can — it pays five times over and stretches a
moment of slow-motion across the sky. Let the violet void shards through: each one that touches the
hull costs a heart and snaps your combo back to x1. Every wave comes harder than the last, and
between waves the sky offers you one of two gifts.

## Play

Open `game/index.html` in a desktop browser. It is pure static files — no build step, no server, no
network, no assets to download. Every star, hull, spark and sound is generated in code.

If you would rather serve it (some browsers are picky about `file://` and ES modules):

```
npx serve game        # or: python3 -m http.server -d game 8000
```

## Controls

| Input              | Action                                     |
| ------------------ | ------------------------------------------ |
| Mouse              | Steers the skimmer (keyboard wins if held) |
| Arrow keys / WASD  | Steer left/right, nudge up/down            |
| Click / Enter      | Start from the title, choose on game over  |
| 1 / 2 or click     | Pick an upgrade card between waves         |
| P / Esc            | Pause and resume                           |
| M                  | Mute (remembered between sessions)         |
| R                  | Play again from the game-over screen       |

## How it scores

- Star-seed: 10 points × combo. Golden nova: 50 points × combo, plus a 60 point bloom bonus and
  brief slow-motion.
- The combo climbs one rung (x1…x8) every two consecutive catches. A seed that slips past the net
  or a shard that hits resets it.
- Clearing a wave pays 60 plus 120 per heart still intact.
- The best score lives in `localStorage` under `nova-harvest.best`.

Upgrades, two offered each wave: **Wider Net** (four ranks of reach), **Magnet Aura** (seeds lean
in), **Extra Heart**, **Longer Bloom** (slow-motion linger), **Shard Shield** (one absorbed shard per
wave) and **Swift Skimmer** (hull speed).

## File map

```
game/
  index.html          the page: one canvas, one module script, no external references
  style.css           page chrome only — the frame, the hint line, a whisper of CRT
  src/
    config.js         all tuning: view size, palette, wave curve, scoring, caps
    random.js         seeded RNG (mulberry32) so a screenshot is byte-identical every run
    audio.js          WebAudio synth SFX, created on the first gesture, mute persisted
    input.js          keyboard/mouse state: held keys, edge presses, pointer in canvas space
    field.js          parallax starfield, painted nebula, comets
    entities.js       seeds, shards, particles, ripples, floating score text
    upgrades.js       the six upgrade lanes, offers, card layout and hit testing
    render.js         the skimmer, net, entities, HUD and every canvas screen
    game.js           the state machine: collisions, combo, waves, scoring, persistence
    shots.js          `?shot=` scene construction for deterministic screenshots
    main.js           boot, fixed-timestep loop, shake, wiring
main.ts               hand-in program: stages game/ + screenshots/, writes dossier.json
shots.json            the four screenshot scenes and their seeds
vendor/makefun-game.ts  make.fun's dossier builder (vendored, unmodified)
```

## Screenshot mode

Appending `?shot=start|play|upgrade|end&seed=N` to the page URL freezes that scene with a seeded
RNG instead of running the game — used to produce `screenshots/1-start.jpg` and friends. Without
those parameters the query string is ignored entirely.

## Hand-in

`main.ts` copies `game/` and `screenshots/` into `$MAKEFUN_OUTPUT_DIR` (default `/output`) and writes
`dossier.json` there with make.fun's own `buildDossier`, so the scorer's recomputation matches.

```
node main.ts
```
