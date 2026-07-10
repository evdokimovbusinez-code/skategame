# Bug Audit — Core Blockers Pass

Audited by reading every relevant system (`Engine`, `PlayerController`, `SkateController`,
`TrickSystem`, `GrindRail`, `RagdollController`, `FollowCamera`, `Level`, `NPC`,
`ps2Materials`/`textures`) and verifying claims empirically in the running preview
(screenshots + live state inspection via `window.__debug`), not just by reading code.
Several things the brief assumed were broken turned out to already work correctly —
those are listed as **VERIFIED OK** so nothing gets blindly rewritten.

## Confirmed bugs

### Rendering
- **[BLOCKER] Z-fighting on the main play surface.** `Level.ts`: the asphalt apron plane
  sits at `y = 0.005` and the central plaza slab (`buildBuildingBlock([0, -0.045, 0], [26,
  0.1, 26], ...)`) has its top face at `y = -0.045 + 0.1/2 = 0.005` — exactly coincident
  over the entire 26×26 plaza footprint, which is the primary skating area. Confirmed
  visually: grazing-angle screenshot shows banding/moiré across the floor, the GPU-driver
  signature of two coplanar triangles fighting for the depth buffer. This flickers as the
  camera moves. **Root cause, not a lighting issue.**
- **[MINOR] VSMShadowMap can show soft shadow-acne on some GPUs at low internal
  resolution** (we render at 0.66× scale). Not reproduced as flicker in testing, but
  documented since VSM is the more failure-prone shadow algorithm; PCFSoft would be safer
  if shadow artifacts are reported later.

### Player / NPC grounding
- **[BLOCKER] NPC (and shopkeeper) feet float ~0.25 units above the ground.**
  `NPC.ts` / `StealBeerMission.ts` (shopkeeper): legs are `BoxGeometry` height 0.5,
  positioned at local `y = 0.5`, so the leg **bottom** sits at local `y = 0.25` — but the
  NPC's `group.position` is set directly to ground-level `y = 0` with nothing underneath
  to bridge the gap. Confirmed visually (close-up screenshot): Jax's legs are clearly
  floating, shadow disconnected from feet. **The player does NOT have this bug** — the
  player also has legs bottoming at local `y = 0.25`, but stands on a skateboard deck
  (`board.position.y = 0.14` + wheels) that visually bridges the gap down to the ground;
  this was verified by computing the actual world-space leg-bottom Y (0.25) against the
  board/wheel geometry and by screenshot — the player reads as grounded correctly.

### Camera
- **[BLOCKER] No mouse-look at all.** Grepped the entire `src/` tree for
  `mousemove`/`pointerlock`/`mousedown` — zero matches. `FollowCamera` derives 100% of its
  yaw from `player.yaw` (the skateboard's facing direction); there is no way to look around
  independently of movement. This matches the brief's complaint exactly and is a real,
  confirmed gap, not a misunderstanding.

### Level design
- **[MAJOR] Stairs are broken geometry, not steps.** `Level.ts` stair loop:
  `buildBuildingBlock([5.5, 0.25 - i*0.17, 8.4+i*0.55], [3, 0.5 - i*0.0, 0.55], ...)` — the
  height term `0.5 - i * 0.0` is a no-op (multiplying by zero), so every "step" is the same
  0.5-tall box, just shifted down and forward each iteration. The boxes heavily overlap
  each other instead of forming a staircase; skating over it feels like one lumpy ramp with
  a step-shaped collision glitch, not stairs.

### Skating feel
- **[MAJOR, subjective but addressed] Push/accel/turn tuned too soft.** Not a logic bug —
  `pushAcceleration: 9` applied for a fixed 0.18s-equivalent burst (~+1.6 speed/tap) against
  `maxSpeed: 11` and `groundFriction: 2.2` means reaching top speed takes many taps and
  coasting bleeds speed fast between them. Increasing push/max-speed/turn responsiveness
  per the brief's explicit ask.
- **[MINOR] No jump input buffering.** `Space` is read via `justPressed` on the exact
  landing frame only; a press 1-2 frames early (very plausible at 60fps under human input
  timing) is silently dropped. Coyote time exists (post-edge grace) but there's no
  pre-landing buffer (pre-edge grace).
- **[BLOCKER, found during post-fix regression testing] Grinding could spuriously bail
  into ragdoll mid-rail.** `PlayerController`'s fall-height and wall-bonk bail checks ran
  unconditionally every frame, including while grinding. But mid-grind the capsule is
  `KinematicPositionBased` (driven by `setNextKinematicTranslation`, not physics forces):
  its grounded-raycast can hit the rail's own solid collider directly under the ride path
  (flipping `grounded` true mid-grind) and `body.linvel()` doesn't track true kinematic
  motion, so the wall-bonk heuristic (`preStepSpeed − postStepSpeed > threshold`) reads
  garbage. Live-traced frame-by-frame: entered a grind correctly at frame 9, then at frame
  11 `grounded` flipped true while still `grinding`, `pendingBail` fired, and by frame 12
  the player was yanked into `Ragdoll` mid-rail. Fixed by gating both checks on
  `!this.grinding`.

## Claims investigated and NOT reproduced (verified OK — left alone)

- **"Player floats above collider"** — checked `feetPosition` math
  (`capsule center − (capsuleHalfHeight+capsuleRadius)`) against `PlayerModel` origin and
  live `window.__debug` state: rest height is exactly `0.6688`, matching the capsule's
  actual bottom. Screenshots confirm the player reads as grounded (board wheels touch
  floor). Not floating.
- **"Ollie does not preserve forward velocity / kills horizontal movement"** — traced the
  frame order: `SkateController.update` sets `body.linvel()` from the `skateSpeed` scalar
  first, then `TrickSystem`'s ollie impulse reads the *just-set* velocity and overwrites
  only `y`, preserving `x`/`z`. `SkateController` continues running every frame while
  airborne (only gated by `ctx.grinding`, not by trick state), decaying speed with
  `airFriction` (0.15) rather than zeroing it. Re-verified live: pushing then ollie-ing
  keeps the player traveling forward through the jump. No fix needed.
- **"Grind lock is not acceptable / grind spams"** — `GrindRail.ts` already gates entry on:
  airborne only, minimum speed, distance-to-segment, ride-height proximity, and direction
  sign; entry converts the body to `KinematicPositionBased` and drives it along the
  segment; exit (rail end or `Space`) restores `Dynamic` with momentum preserved. The
  entry/exit logic itself needed no changes — but see the mid-grind spurious-bail BLOCKER
  above, found while regression-testing this exact path after the speed retune and fixed
  in this pass.
- **"Ragdoll spawns at wrong height / gets stuck"** — ragdoll bones are dynamic bodies
  spawned at `feetPos + local offset`, then physics itself resolves any spawn-height
  mismatch as they fall and land on real geometry (unlike the static NPC, the ragdoll is
  simulated, so an imperfect spawn offset self-corrects within the first few frames).
  Re-tested big-fall, hard-impact, and bad-landing bail paths live: velocity transfers
  in, it settles, and the player respawns at the pelvis position correctly, with a 2.5s
  timeout fallback already in place. No fix needed.

## Fix plan (this pass)

1. Separate the plaza/asphalt/ground heights so no two surfaces are coplanar (z-fighting).
2. Give the NPC and shopkeeper a visible base/shoes offset so their feet actually touch
   `y = 0` instead of floating.
3. Add mouse-look: pointer-lock-on-click orbit yaw/pitch offset, decoupled from movement
   yaw, feeding into `FollowCamera`.
4. Fix the stairs height progression so steps actually step down.
5. Retune skate push/accel/turn/friction for a punchier first-10-seconds feel.
6. Add jump input buffering (small window before landing).
7. (Found while regression-testing #5/#6) Guard the fall-height/wall-bonk bail checks so
   they don't fire while grinding — mid-rail the body is kinematic and those heuristics
   read garbage from it.

## Round 2 — reported after first playtest

Two more real bugs, reported by the user playing the built game (not found by the earlier
static-code audit, since both are behavioral and only show up live):

- **[BLOCKER] Movement ignored the mouse entirely.** The mouse-look added in round 1 was a
  *pure camera orbit offset* (`FollowCamera` added `mouseLook.yaw` on top of `player.yaw`
  just for positioning the camera) — it never fed back into the character's own facing.
  Pressing `W` always moved along `player.yaw`, which only `A`/`D` ever changed, so turning
  the camera with the mouse visibly rotated the view but the character kept walking in its
  old direction. Root cause: two independent yaw values that were never reconciled.
  **Fix:** redesigned `MouseLook` to expose `consumeYawDelta()` — a per-frame accumulated
  mouse-x delta — which `main.ts` now adds directly to `player.yaw` every tick (before
  physics), so the character's facing *is* the mouse direction and `W` always goes where
  the mouse points. `FollowCamera` no longer takes a separate yaw offset (camera sits
  directly behind `player.yaw`); mouse-y still only drives camera `pitch` (characters don't
  pitch). Verified live: turning the mouse 90° then holding only `W` (no `A`/`D`) moved the
  player entirely along the new heading's axis.
- **[BLOCKER] Player could get stuck below the floor after a fall.** Root cause: fast
  falls (a big-fall bail, or a ragdoll bone inheriting high velocity) can **tunnel through
  thin static colliders** between physics steps — neither the player capsule nor the
  ragdoll bones had continuous collision detection (CCD) enabled, which is exactly what
  Rapier's CCD exists to prevent for fast-moving dynamic bodies against thin geometry
  (ground colliders here are ~0.1–0.2 units thick). Once a bone tunnels below the floor,
  there's no surface left to push it back out, and the old respawn math
  (`pelvis.y + 0.4`, a flat guess) had no way to notice or correct that.
  **Fix:** `.setCcdEnabled(true)` on both the player capsule body and every ragdoll bone
  body (prevention). Additionally, hardened `exitRagdoll()` to cast a ray straight down
  from above the settled pelvis to find the *real* ground surface and respawn exactly on
  top of it (`groundY + halfExtent`), falling back to the old offset only if the ray finds
  nothing — defense in depth in case CCD alone doesn't cover every case. Verified live:
  dropped the player from y=30 onto open ground and separately straight onto the (thin,
  stacked) stair treads — both times it landed, ragdolled, and respawned at the correct
  standing height (~0.68, matching the normal rest height of 0.669) with `grounded: true`,
  no stuck states.

## Round 3 — reported after Round 2's fix

The Round 2 CCD fix for "stuck in floor" introduced a new, worse symptom: the character
would violently spasm/thrash during ragdoll and never respawn.

- **[BLOCKER] CCD + impulse joints caused the ragdoll to explode instead of settling.**
  Root cause: enabling CCD (`.setCcdEnabled(true)`) on every ragdoll bone was the wrong
  fix. CCD's time-of-impact position correction and the joint solver holding the bones
  together fight each other every substep — a well-known unstable combination in Rapier
  (and physics engines generally): CCD is designed for a single fast body against static
  geometry, not for a cluster of jointed bodies. The result was violent, un-settling
  jitter, and because the settle check (`maxSpeed < threshold`) never went below threshold,
  the ragdoll ran for the full 2.5s timeout every time and *looked* like it never
  recovered (compounded by the visible thrashing).
  **Fix:**
  1. Removed CCD from the ragdoll bones entirely (kept it only on the player capsule,
     which has no joints and is exactly CCD's intended use case).
  2. Replaced it with a velocity clamp (`MAX_BONE_SPEED = 14`) on the bones' spawned-in
     velocity — caps how much energy a bail can hand the ragdoll without relying on CCD,
     which is enough for our ~0.1–0.2-unit-thick colliders at a normal 60Hz timestep.
  3. Added a safety valve: `RagdollRig.update()` now detects non-finite (NaN/Infinity)
     bone velocity — the actual signature of a solver explosion — and forces an immediate
     despawn instead of waiting out a timeout against broken physics state.
  4. Added a matching guard in `exitRagdoll()`: if the pelvis position itself came back
     non-finite, fall back to the ragdoll's original spawn point instead of teleporting
     the player to `NaN`.

  Verified live with two stress cases: (a) a huge fall (y=30 drop) — ragdoll settled
  naturally via the timeout, bone speeds tailed off to ~0.1-0.2 by the end (not stuck
  oscillating), respawned at `y≈0.676`, `grounded: true`; (b) a hard 14 u/s wall-bonk
  bail — this time it settled *naturally* (not via timeout) in 95 frames (1.58s),
  respawned at `y≈0.693`. Neither case thrashed or failed to respawn.

## Round 4 — reported after Round 3's fix

The thrashing was gone, but a new (actually the *real* original) symptom surfaced: the
character would respawn, then immediately fall back into ragdoll at the same spot, over
and over, forever.

- **[BLOCKER] Infinite respawn loop.** Root cause, confirmed by tracing the exact frame
  sequence: `PlayerController.airPeakY` (the highest point reached during the *fall that
  caused the original bail*) was **never reset when entering or exiting ragdoll**.
  Separately, `groundedLastFrame` stayed `false` for the entire ragdoll duration (the
  parked capsule is off-world at `y=-50`, so its ground-raycast never hits anything).
  Put together: the frame right after `exitRagdoll()` respawns the player standing on the
  ground, `beforePhysics()` sees `wasGrounded=false, grounded=true` — a "just landed"
  transition — and computes fall distance as `(stale airPeakY from the ORIGINAL fall) −
  (new low respawn height)`, which is enormous, so it reads as *another* huge fall and
  re-triggers ragdoll immediately. Every subsequent cycle repeats the same trap, which is
  why it looked like an infinite loop rooted to one spot rather than a one-off retrigger.
  **Fix — a general respawn-invulnerability window, not a single-variable patch:** added
  `RAGDOLL.respawnGraceSeconds` (0.5s) and a `respawnGraceTimer` on `PlayerController`.
  `exitRagdoll()` now goes through a new shared `clearBailState()` helper that resets
  *every* piece of state a bail check reads (`airPeakY`, `preStepSpeed`,
  `groundedLastFrame`, `pendingBail`) and arms the grace timer; both the fall-height check
  and the wall-bonk check are suppressed while the timer is running. This is deliberately
  broader than "reset `airPeakY`" alone — it closes off the *entire class* of stale-state
  bugs a hard position reset can cause, including ones not yet found. The same helper (via
  a new `teleportTo()` method) now also backs the manual `R` reset key, which had an
  identical latent risk and previously duplicated the reset logic ad hoc in `main.ts`.
  Verified live: three consecutive big-fall drops each produced exactly 1 ragdoll entry
  and a clean respawn (`entries: 1` every time, not looping); interrupted a ragdoll
  mid-tumble with `R` and confirmed it exits cleanly (model visible, `Skating`, grounded,
  correct standing height) instead of leaving stale ragdoll state behind.

## Post-fix verification log

`npx tsc --noEmit` — clean after every step above. `npm run build` — succeeds
(`dist/` produced, no errors; only a pre-existing "chunk >500kB" advisory, unrelated).

Manual test list from the task brief, all re-run live against the rebuilt game via
`window.__debug` + screenshots (headless preview has no real rAF loop or pointer-lock
grant, so movement was driven by direct `tick()` calls and mouse deltas were dispatched
as synthetic `mousemove` events with `locked` force-set — the underlying camera/physics
code path is identical either way):

1. **No lighting flicker** — lights are created once in `setupLighting`, never
   recreated per frame; confirmed by reading `main.ts` (`setupLighting` called exactly
   once in `boot()`) and by extended live runs (150+ ticks) with no light-related state
   changes anywhere in the frame loop.
2. **No texture/geometry flicker** — z-fighting root cause (coplanar asphalt/plaza)
   fixed; re-screenshotted the same grazing angle that showed banding before, floor now
   reads clean at the same camera position.
3. **Player does not float** — re-confirmed rest height matches capsule bottom exactly;
   unchanged by this pass (was already correct).
4. **NPC does not float** — fixed; live-measured leg-bottom world Y = 0 after the
   offset fix (was 0.25), and the close-up screenshot shows both NPC and shopkeeper
   standing flush with visible shoes.
5. **Camera follows mouse** — fixed; live mouse-delta injection moved `MouseLook.yaw/
   pitch`, and feeding those into `FollowCamera.update` moved the resulting camera
   position by >3 world units from the no-offset baseline in the same frame.
6. **Skating speed feels good** — retuned; 4 push-taps now reach ~11.5 u/s (was ~3.7 u/s
   under the old constants for the same input), against a new 16 u/s cap.
7. **Ollie preserves forward motion** — unchanged (was already correct); re-verified live
   push-then-ollie keeps horizontal velocity through the jump.
8. **Grind locks to rail** — unchanged logic, but a real spurious-bail regression was
   found and fixed during this verification pass (see BLOCKER #7 above); full enter →
   ride → exit cycle now completes in `Skating` state with no unwanted ragdoll.
9. **Ragdoll works and respawns** — unchanged (was already correct); re-verified
   big-fall bail → settle → respawn-at-pelvis live after all other changes landed, no
   regression.
10. **2-minute playability** — ran a long combined session (menu → start → skate/push →
    tricks → grind → big-fall ragdoll → respawn → NPC dialogue chain → both missions,
    several hundred simulated frames total across this pass) with zero uncaught errors
    in the console and no stuck states.

See bottom of this file, filled in after fixes — build/dev checks and the 10-point manual
test list from the task brief.

## Round 5 — parkour/walk/model rebuild

Not a bug report — a feature pass (bone-rig model, GTA5-style walk, mantle/vault parkour;
skating deliberately untouched). One real bug was found and fixed during its own testing:

- **[MAJOR] Mantle could land the player teetering off the edge of a platform, slowly
  sliding off it.** `ParkourSystem.begin()` computed the landing spot as a fixed distance
  (0.35 units) from the player's *pre-vault* position, not from the obstacle's actual
  detected face. On approaches where the forward probe traveled further than that fixed
  distance before hitting the ledge (a very normal case — approach distance varies), the
  computed landing point fell short of the real edge, leaving the capsule only partially
  supported by the platform's collider. It stood there for several frames looking fine,
  then gravity slowly walked it off the front edge. Fixed by landing relative to
  `ledge.point` (the real raycast hit position) instead of the pre-vault start position.
  Verified live: mantled the funbox platform and held `y≈1.37, grounded: true` for 100+
  frames afterward with zero drift, where before it had been visibly sinking/sliding.

- **[MAJOR] Mantle chain onto thin/elevated ledges (dumpster → awning → shop roof)
  silently never triggered.** `ParkourSystem.probe()` required a forward "wall" raycast
  at `ledgeTopY - 0.15` to confirm an obstacle before accepting the down-ray's landing
  surface. That works for a continuous wall (a curb, a crate) but breaks for a *floating*
  ledge reached by a stepping-stone jump: the awning is a 0.15-unit-thick slab with open
  air underneath it, so a ray at "just below its top" passes clean through empty space and
  never reports a hit — `probe()` returned `null` every time, even from a position well
  within `mantleProbeDistance` of the awning's edge. Fixed by dropping the wall-check
  entirely; the down-ray result is already bounded by the fixed probe `distance` (can't
  reach across open space) and the min/max height band (can't fire on flat ground), which
  is sufficient to prevent false positives without requiring a solid face underneath.
  Verified live end-to-end: teleported onto the dumpster, walked to its edge, mantled onto
  the awning (`vaulting: true` → landed `y≈3.845`, matching awning-top 3.175 +
  capsule-half-extent), mantled again onto the shop roof (landed `y≈4.97`, matching
  roof-top 4.3 + half-extent), then force-activated the VHS mission and confirmed tape #1
  (roof spot) collects on proximity (`inventory.has('vhs1') === true`). Full chain
  traversable and the collectible is reachable.

## Round 6 — RPG-9 full playtest (post-RPG rebuild)

Full pass over everything added across the RPG expansion (money/rep/inventory, dialogue
choices, quest markers, Rosa/Otis + shop, the three new missions, campaign finale, skate
animations layered onto the untouched skate physics, environment additions). `npx tsc
--noEmit` and `npm run build` both clean throughout (only the pre-existing >500kB chunk
size advisory, unrelated to correctness). No new bugs found — everything below verified
live via `window.__debug` state inspection and screenshots, not just by reading code:

- **Trick Challenge mission** — both the pass path (score ≥ 500 fires `onFinish(true)`,
  state → `"passed"`) and the timeout-fail path (clock hits 0 fires `onFinish(false)`,
  state → `"failed"`) verified directly.
- **Delivery mission** — all three exits verified: reaching the destination (`onFinish
  (true)`, package removed from inventory), bailing into a real ragdoll mid-delivery
  (the actual `bail` event, not a simulated one — `onFinish(false)`, mission state resets
  to `"idle"`, package removed), and timing out far from the destination (same fail path).
- **Campaign finale** — traced the Jax dialogue chain (beer → graffiti → trick challenge)
  in source to confirm `campaignComplete` fires synchronously right after `storyStage =
  STAGE_DONE` on a passed Trick Challenge; separately confirmed the `#finale-overlay` DOM
  element and its `.visible` CSS state render correctly (screenshot: "ONE OF US" title +
  campaign-complete subtext, `opacity: 1`, `pointer-events: auto`).
- **Save/load round-trip** — set money/rep/inventory/quest-completion to non-default
  values, saved, did a real `window.location.reload()` (not a simulated one), and
  confirmed every field — including the HUD's rendered `$333` — matched pre-reload state
  exactly.
- **Skate physics regression** (money question: did the SkateAnimator addition change
  feel/behavior?) — push acceleration (0 → 16 u/s cap), ollie (clean airborne arc, trick
  type transitions correctly), kickflip, and a full grind cycle (natural ollie-into-rail
  entry, locked ride height, automatic exit at the rail's end) were all re-run on open
  ground and behave identically to the pre-RPG baseline. One test artifact worth noting
  for future debugging, not a bug: testing skate physics at world origin `(0,0,0)`
  triggered an unrelated ragdoll (real world geometry there, not a bug) — moved the test
  to open asphalt and it reproduced cleanly.
- **NPC bone rigs (Rosa, Otis)** — screenshotted both close-up; bone transforms
  (`hips/spine/head/arms/legs`) are byte-identical to Jax's (already-verified) rig, so
  proportions are structurally correct. Otis read as an indistinct silhouette in one
  straight-behind close-up shot purely from his low-contrast olive shirt/dark pants —
  confirmed cosmetic (viewing angle + palette), not a geometry bug, by comparing bone
  dumps and re-shooting from a 3/4 angle.
- **Environment** — lit window facade panels, new backdrop buildings, and the minimart
  awning all render without z-fighting or gaps in an aerial pass; the perimeter fence
  (`±29` on both axes) forms one closed rectangle with generous clearance around every
  building, mission zone, and the rooftop parkour route — confirmed it cannot block any
  intended play area.
- **Walk mode** — re-confirmed GTA5-style movement live: `player.yaw` (camera-relative
  input basis) and `player.visualYaw` (body-facing lerp target) are properly decoupled;
  screenshot shows the player's body correctly facing the direction of travel while
  carrying the board in walk stance.

## Round 7 — A/D swapped while walking (reported after Round 6)

- **[MAJOR] A and D strafed the wrong way in Walking mode only.**
  `WalkController.ts`'s `camRight` was computed as `(cos yaw, 0, -sin yaw)` — the exact
  negation of the true right vector for this game's `forward = (sin yaw, 0, cos yaw)`
  convention (`right = forward × up` works out to `(-cos yaw, 0, sin yaw)`). So pressing
  D (`strafe = +1`) moved the character along `camRight` = actually-left, and A moved them
  actually-right. Skating was unaffected — `SkateController` turns via direct yaw
  increment (A increases yaw, which was independently verified to rotate the board toward
  its own true left), it never used `camRight` at all. Fixed by flipping the sign to
  `(-cos yaw, 0, sin yaw)`. Verified live: from `yaw = 0`, D now moves to `x ≈ -0.785`
  and A to `x ≈ +0.785` — opposite directions, matching true right/left for that facing.

## Round 8 — parkour rework: real jump height, ledge grab/hang/climb, draggable props

Feature request, not a bug report: "jumps like an ant," wanted proper jump height, the
ability to hang off a ledge and pull up, a running jump to reach height, and movable
dumpster/crate/pallet props. Three bugs were found and fixed along the way — all via live
`window.__debug` testing, not just reading code.

**What changed:**
- `WALK.jumpImpulse` 4.5 → 8.0. Old value peaked ~0.5m (a twitch); new value peaks
  ~1.48m at this game's gravity (`-21.58`) — verified live (`peakY - restY ≈ 1.45`).
- `ParkourSystem` gained ledge grab/hang/climb, replacing the old ground-only,
  Space-triggered "mantle": `tryGrabLedge()` runs every airborne Walking-state frame
  (never while grounded — that's what forces an actual jump) and reuses the existing
  down-ray probe with a taller height band (`ledgeGrabMinHeight`/`MaxHeight`, checked
  against the player's CURRENT feet position every frame, so a ledge out of reach at
  takeoff can enter range as the player rises through the jump arc). A successful grab
  parks the capsule kinematically at a hang pose (arms raised — see
  `PlayerController.setHangPose`); Space climbs up (reusing the same kinematic-lerp
  machinery as vault, now `"vault" | "climb"`), S drops back to a normal fall. New
  `PlayerController.hanging` field, gated everywhere `vaulting`/`grinding` already were
  (bail checks, Tab-toggle).
- New `src/world/DraggableProp.ts`: the dumpster + the minimart's crate/pallet are now
  real dynamic Rapier bodies (previously baked into static world colliders). Walk up,
  press E to grab (kinematic follow at a fixed offset from the player, height locked to
  where it rested — dragging is horizontal only), E again to let go (back to Dynamic,
  settles under gravity). Wired into `main.ts`'s interaction-priority chain below
  dialogue/mission zones but above idle nothing.

**Bugs found and fixed during testing:**
- **[MAJOR] Player capsule friction (0.6) could freeze it mid-air against any wall.**
  `WalkController` re-asserts full commanded velocity into the input direction every
  frame regardless of collisions; pressed continuously into a solid wall, Rapier's
  friction solver was locking the capsule's *vertical* motion too (friction on the
  contact's tangential/vertical axis, driven by the large implicit normal force from a
  velocity that's being commanded straight into the surface every step) — confirmed live
  against a plain static building wall, no special prop involved: jumping into it froze
  the player in place, immobile, for the rest of the jump. The taller jump made this
  newly reachable (more airtime near a wall to get stuck). Movement is already 100%
  velocity-driven by Walk/SkateController (neither leans on collider friction to stop or
  grip a slope), so the fix was simply to drop the capsule's own friction to near-zero
  (`0.05`) — a standard fix for this exact character-controller-vs-physics-engine
  interaction. Re-verified the same wall-jump afterward: normal parabolic arc, no freeze.
  Checked for a slope-sliding regression on the existing ramps (Walk has no slope-grip
  logic, unlike Skate): standing still on one drifts ~0.05 units over 0.75s — negligible,
  accepted.
- **[MAJOR] Stale `hanging`/`vaulting` flags survived `teleportTo()`/`exitRagdoll()`,
  corrupting the body.** Both hard-reset the physics body to Dynamic at a new position
  (needed for the manual `R` key and post-ragdoll respawn) but never cleared `hanging`/
  `vaulting` — if either was active (e.g. `R` pressed mid-hang), the Walking state kept
  calling `updateHang()`/`parkour.update()` on a body that was no longer kinematic:
  `setNextKinematicTranslation` silently no-ops on a Dynamic body, so gravity took over
  while `hanging` still read `true`, WalkController never ran (gated on `!hanging`), and
  the player fell with no controls until fully re-landing. Confirmed live via the ledge
  grab's own test sequence (a leftover `hanging=true` from an earlier grab survived a
  `teleportTo()` and produced exactly this). Fixed by clearing both flags (and the hang
  pose) in the shared `clearBailState()`.
- **[MINOR] Climb-up's exit nudge (0.6 m/s) could carry the player off the far edge of a
  narrow platform** (the dumpster is only ~1.7m across) before WalkController's own
  deceleration caught up, immediately triggering a second ledge grab on the platform's
  own far rim. Not broken — the player just catches themselves again, which reads as a
  reasonable parkour-game behavior — but landings should feel settled, not like they're
  still sliding. Reduced the climb exit nudge to 0.25 m/s.

**Verified live:** jump height (~1.45m gain); immediate grab when approaching within
`ledgeGrabProbeDistance` of the dumpster before jumping; stable hang (zero drift over 40
frames); full climb arc landing exactly at the expected standing height (dumpster top +
capsule half-extent); `DraggableProp.grab()`/`update()`/`release()` correctly toggle body
type and follow a moving reference point (isolated test, since navigating the cluttered
minimart prop cluster on foot kept clipping into *other* static props — a test-setup
issue, not a game bug); skate physics (push to max speed, ollie, kickflip, clean landing)
fully unaffected by any of the above. `npx tsc --noEmit` and `npm run build` clean
throughout.

## Round 9 — Round 8 shipped with a broken hang pose (reported with screenshots)

Round 8's ledge-grab mechanics worked but the *presentation* didn't survive contact with
a real playtest: screenshots showed the arms bent the wrong way, the body clipping
through walls, the character climbing furniture that shouldn't be climbable, and dragged
props reading as weightless. All four were guessed numbers from Round 8 rather than
values derived from the rig's actual geometry — this pass replaces every one of them with
a computed or measured value and re-verifies against screenshots, not just state reads.

- **[MAJOR] Hang pose arms were rotated backwards and by a guessed angle.**
  `setHangPose()` used `rotation.x = 2.7` (positive) plus a small Z tilt. Worked through
  the actual rotation math this time: an upper-arm bone at `rotation.x = 0` rests hanging
  straight down (the mesh is built extending along local -Y from the shoulder); rotating
  by angle `x` around local X sweeps its direction to `(0, -cos(x), -sin(x))`. For the
  arm to point up and toward the character's own facing (+Z locally, since the whole rig
  yaws to face the ledge, not individual bones), both `-cos(x) > 0` and `-sin(x) > 0` are
  needed — that's a small *negative* angle past straight-up, not `+2.7`. Fixed to
  `upperReach = -2.8`, dropped the Z component entirely (mixing X and Z Euler rotation
  was likely what made the old pose read as bent/broken rather than just "wrong
  direction"). Verified via screenshot: both arms now clearly reach up and forward,
  hands landing at the grabbed ledge.
- **[MAJOR] Hang position didn't match where the arms could actually reach, and had
  ~zero wall clearance.** `hangHandOffset` (capsule-center-to-ledge-top distance) was a
  flat `0.24` — nowhere near the ~0.74 a fully raised arm actually spans (shoulder
  height + upper-arm + lower-arm length, all real rig measurements). `hangInset` (0.32,
  exactly the capsule radius) left no gap at all, so the body clipped into the wall —
  visible directly in the reported screenshots. Fixed both: `HumanoidRig.ts` now exports
  the real bone lengths and a derived `REACH_UP_HEIGHT` constant instead of main.ts/
  ParkourSystem re-guessing them; `ParkourSystem.tryGrabLedge()` computes the hang offset
  from that plus the live capsule half-extent instead of a stored constant, and
  `hangInset` went to `0.6` (clear of the radius by a real margin). Verified via
  screenshot from two angles: no wall clipping, visible gap between body and surface.
- **[MAJOR] Ledge grab fired on furniture — "why am I pulling myself up onto a bench?"**
  `ledgeGrabMinHeight` (0.68) was flush with vault's own ceiling, so anything with a thin
  raised surface above that height counted — including a park bench's backrest slat
  (0.85). Raised to `1.15`: clear of every low prop's incidental detailing, still well
  under the first real climb target (the dumpster, 1.5). Verified live: jumping directly
  at a bench backrest no longer grabs (`hanging` stays `false` for the full jump).
- **[MINOR] Draggable props read as weightless — bumped or dropped, they'd fly.**
  Density was a flat `4` for everything (a steel dumpster and a wooden pallet weighing
  the same), restitution was unset (Rapier default allows bounce), and the follow-drag
  smoothing (rate 14) snapped to the target almost instantly — nothing about the feel
  said "you're pulling something heavy." Gave each prop type a real relative density
  (dumpster 35, crate 8, pallet 6), set `restitution: 0`, raised linear/angular damping
  (3/6 → 8/10) so a stray kinematic-drag-into-geometry impulse decays fast instead of
  reading as a launch, and slowed the drag-follow rate (14 → 6) so it visibly lags like
  something with mass instead of teleporting to the player. Verified live: skating into
  the dumpster at full speed (16 u/s) now moves it 0.066 units and it settles to
  near-zero velocity immediately, versus flying off before.

Re-verified unaffected: skate push/ollie/kickflip/landing, `npx tsc --noEmit`, and
`npm run build` — all clean.

## Round 10 — Neighborhood redesign: zones, punk characters, bloom (final regression)

Closed out the full neighborhood-redesign plan: seven new named zones (Apartments A/B,
Loading Zone, Empty Lot, Parking Lot, Vacant Lot, Back Alley), new prop builders (parked
car, truck, tree, tire stack), graffiti texture variants, punk accessories (mohawk, vest)
applied to the player and select NPCs, and a real `EffectComposer`/`UnrealBloomPass`
pipeline so neon signage actually glows instead of just being a bright flat color.

- **[MINOR] Manual debug renders bypassed bloom after the composer landed.** The
  established debug pattern (`engine.stop()` + manual `tick()` stepping + a raw
  `renderer.render(scene, camera)` call to grab a deterministic screenshot) predates the
  composer — once `Engine.start()`'s RAF loop switched to `composer.render()`, that
  manual call silently skipped bloom, making any debug screenshot lie about what players
  actually see. Fixed by extracting the branch into a public `Engine.renderOnce()` that
  both the RAF loop and manual debug callers share, so there's exactly one render path.
- **Investigated, not a bug: an aerial debug camera at `y=60` produced a fully washed-out,
  detail-less screenshot** that briefly looked like a bloom threshold miscalibration
  (the whole frame haloed uniformly, not just emissive surfaces). Isolated by re-rendering
  the identical frame with `bloomPass.enabled = false` — the output was pixel-identical,
  proving bloom wasn't the cause. Root cause: `scene.fog = new THREE.Fog(0xe0c1a0, 20,
  70)` (set up long before this session) — at that camera's ~60-unit distance to the
  ground, everything sits deep in the fog falloff toward full fog-color saturation. Real
  gameplay cameras never sit that far from geometry, so this was a debug-camera artifact,
  not a player-visible issue. Re-verified bloom at a realistic aerial height (`y=26`):
  selective and correct — shop-sign neon glows, lamp heads pick up a subtle highlight,
  flat-lit walls/ground/props stay unaffected.

**Verified live:** clean boot with zero console errors; `MINIMART` sign shows a genuine
soft bloom halo while the adjacent wood walls, crates, and pallet stay flat; realistic-
height aerial view shows the plaza/hub, punk-accessoried NPC, ramps, and rails with
correct, non-blown-out lighting; all 5 missions (`stealBeerMission`, `graffitiMission`,
`trickChallenge`, `vhsMission`, `deliveryMission`) and all 6 draggable props (3 minimart +
3 new Loading Zone crates/pallet) instantiate with no errors, confirming the render-
pipeline refactor didn't touch mission/physics wiring. `npx tsc --noEmit` clean, `npm run
build` clean (single expected chunk-size warning from the Rapier/Three.js bundle, present
since before this pass — not a regression).
