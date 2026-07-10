# Polish Pass — Vertical Slice Checklist

Audit result (Phase 1): project boots clean, `tsc --noEmit` passes, all MVP systems work
(skate/walk/tricks/grind/ragdoll/dialogue/2 missions). Everything below is polish on top.

> **Core-blockers pass done separately — see [BUG_AUDIT.md](BUG_AUDIT.md).** That pass
> fixed real playability blockers found by testing (not assumed): z-fighting on the main
> plaza floor, NPC/shopkeeper feet floating off the ground, no mouse-look camera at all,
> broken/overlapping stair geometry, a spurious mid-grind bail, plus a skate-feel retune
> and jump-input buffering. Read that file for what was actually broken vs. what was
> already working correctly.

## Phase 1 — Audit & stabilization
- [x] `tsc --noEmit` clean
- [x] Game boots, physics initializes
- [x] TODO_POLISH.md created

## Phase 2 — Player feel
- [x] Board + body lean into turns
- [x] Air control (limited, arcade)
- [x] Coyote time / landing forgiveness for ollie
- [x] Trick score popups (OLLIE / KICKFLIP / GRIND / CLEAN LANDING / BAIL)
- [x] Combo timer + score HUD
- [x] Camera: look-ahead, FOV boost at speed, shake on hard landing
- [x] Per-state camera offsets (skate/walk/grind/ragdoll)

## Phase 3 — Physics polish
- [x] Grind spark particles (PS2-style quads)
- [x] Crash dust particles on ragdoll spawn
- [x] Bail reasons tracked (bad landing / hard impact / big fall) — shown as BAIL popup
- [x] Ragdoll camera follow smoothing (verify)

## Phase 4 — World polish
- [x] Procedural low-res canvas textures (asphalt, concrete, brick, wood, metal) + NearestFilter
- [x] Ground surface variation (noise/cracks/stains baked into procedural textures — chosen over vertex colors)
- [x] Props: benches, street lamps, traffic cones, crates, trash bags, bottles, pallets, signs
- [x] Stairs + ledge set, funbox
- [x] Abandoned lot corner (broken concrete, fence, pipes)
- [x] Shop area readable (sign, awning strip)
- [x] Graffiti wall visually marked (outline decal)
- [x] Sunset lighting + fog tune

## Phase 5 — UI/UX
- [x] Main menu (title / Start / Controls / Reset)
- [x] Pause menu (Esc)
- [x] Controls overlay
- [x] HUD mode indicator: SKATE / WALK / GRIND / RAGDOLL
- [x] Speed indicator
- [x] Trick/combo score panel
- [x] Consistent color language (yellow=mission, green=done, red=bail, white=controls)

## Phase 6 — Audio
- [x] Lightweight WebAudio manager (no asset files, procedural synth SFX)
- [x] ollie pop, landing thud, bail impact, UI click, mission complete, spray hiss, grind loop
- [x] Safe fallback when AudioContext unavailable

## Phase 7 — Missions
- [x] Beer prop more visible (bottle crate + label color)
- [x] Shopkeeper vision cone fail state (reset carry)
- [x] Objective color transitions in tracker
- [x] NPC unique silhouette (cap/hoodie)

## Phase 8 — Final pass
- [x] Remove console noise (gate behind debug flag)
- [x] Debug panel toggle (stats/state/speed/grounded/teleports)
- [x] README controls update
- [x] Full end-to-end playtest
