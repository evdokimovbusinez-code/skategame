# SK8TOWN

Browser 3D skateboarding game — a clean stylised 3D vertical slice set in a dense,
run-down 2000s city block. Prove yourself to the local crew, explore the enterable
Burnout skate shop/bodega and abandoned building, fight rival skaters, tag the alley,
collect VHS tapes and build combos through the central DIY park.

Built with Three.js + Rapier (`@dimforge/rapier3d-compat`) + Vite/TypeScript. No backend,
no assets — all textures and SFX are generated procedurally in code.

## Run

```
npm install
npm run dev
```

Production build: `npm run build` (output in `dist/`, fully static).

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | push / turn / brake |
| `Space` | ollie · exit a grind |
| `F` | kickflip (while airborne) |
| `Tab` | toggle skating ⇄ walking (board in hand) |
| `E` | talk to NPC · grab item · hold to spray graffiti |
| `J / K` | quick punch / heavy shove |
| `H` | use healing snack or tape |
| `I` | inventory |
| `R` | reset player to spawn |
| `Esc` | pause menu |
| `P` | physics collider wireframe (debug) |
| `F3` | debug panel (FPS, state, teleports 1/2/3) |

## What's in the slice

- **Skating**: push/carve with speed-dependent steering, board+body lean into turns,
  slope acceleration on ramps, limited arcade air control, coyote-time ollies and
  landing forgiveness on kickflips.
- **Tricks & scoring**: OLLIE / KICKFLIP / GRIND / CLEAN LANDING popups, combo chaining
  with a bank timer, total score HUD.
- **Grinding**: zone-based rail entry, kinematic rail ride with spark particles and a
  synth grind loop, jump-off exit boost.
- **Ragdoll bails**: bad trick landings, hard wall impacts, and big falls swap the player
  for a jointed physics ragdoll (velocity transferred), then respawn at the pelvis.
  Camera shake + dust on impact.
- **Missions**: Beer Run (stealth — the shopkeeper's red vision cone busts you and puts
  the six-pack back) and Graffiti Tag (hold-to-fill spray with a real decal payoff),
  framed by NPC dialogue that advances as you complete them.
- **World**: a rebuilt connected district with a central DIY park, curved quarter-pipes,
  stair sets, hubbas, manual pads and long grind lines; the open Burnout skate shop/bodega
  with deck wall, footwear workbench, stocked aisles, coolers, VHS wall and checkout;
  enterable two-level abandoned building, apartments, fire escapes, loading zone, vacant
  lot, parking, back alleys, rooftops, wet asphalt, graffiti, power lines and city skyline.
- **Rendering**: native-resolution output, high-resolution procedural materials with
  trilinear filtering, PBR environment surfaces, ACES filmic tone mapping, GTAO contact
  shading, soft shadows, selective bloom, dynamic dusk/night lighting and a painted
  high-resolution sky. The aggressive zine/VHS texture remains in the UI rather than
  pixelating the 3D world.
- **Characters**: one shared articulated rig with four authored silhouettes — main punk,
  local skater, street-punk skater and rival — plus detailed boards, clothing layers,
  patches, chains, studs, hair and facial features. Procedural walk/skate/trick animation
  now includes idle breathing and glances.
- **Combat and RPG**: rival crews patrol and aggro, quick/heavy attacks, health, drops,
  cash, reputation, consumables, shop purchases and persistent inventory.
- **Audio**: procedural WebAudio SFX — ollie pop, landing thud, bail, roll loop, grind
  loop, spray hiss, UI clicks, mission-complete jingle. (Real recorded SFX can later be
  dropped into `public/assets/audio` and swapped in inside `src/core/AudioManager.ts`.)
- **UI**: main menu, pause, controls overlay, mode indicator (SKATE/WALK/GRIND/RAGDOLL),
  speed bar, mission tracker, toasts, dialogue box.

## Scope

This is a complete, playable art-direction vertical slice rather than a content-complete
commercial game. The world and characters are procedural code-native assets so the
project remains self-contained and editable; a full production would next add authored
animation clips, recorded audio, LODs, texture atlases and a larger mission campaign.
