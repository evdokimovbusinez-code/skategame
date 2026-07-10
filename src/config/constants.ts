// Central tuning constants for physics, movement, camera, and tricks.
// Kept in one place because skate-feel tuning is the most-iterated part of the project.

export const PHYSICS = {
  gravity: -9.81 * 2.2,
  fixedTimeStep: 1 / 60,
  maxSubSteps: 5,
};

export const PLAYER = {
  capsuleRadius: 0.32,
  capsuleHalfHeight: 0.35, // cylinder half-height, total capsule height = 2*(half+radius)
  spawnPosition: [4.0, 2, 10.5] as [number, number, number],
};

export const WALK = {
  // GTA5-style on-foot movement: WASD is camera-relative (W = toward where the camera
  // faces, A/D = strafe), and the character's VISUAL facing (`visualYaw`) smoothly turns
  // to face the direction of travel instead of snapping — decoupled from the camera yaw
  // that mouse-look drives. See WalkController.ts.
  maxSpeed: 3.4,
  sprintMultiplier: 1.85, // Shift to run
  acceleration: 16,
  deceleration: 20,
  bodyTurnRateDegPerSec: 620, // how fast the model rotates to face the movement direction
  // 4.5 only cleared ~0.5m — read as a twitch, not a jump. At -21.58 gravity, 8.0 peaks
  // ~1.48m: enough to clear a real obstacle and to close the gap on a ledge grab (see
  // LEDGE_GRAB) instead of needing the ledge to already be in reach while standing still.
  jumpImpulse: 8.0,
};

export const SKATE = {
  // Velocity-based board feel: taps give a real push impulse, held forward keeps pumping,
  // and grip/carve steer the velocity over time instead of snapping it to the yaw.
  maxSpeed: 12.5,
  pushAcceleration: 14.5,
  pushBurstFrac: 0.34, // push impulse = pushAcceleration * pushBurstFrac
  rollAcceleration: 3.2, // held-forward pumping, much weaker than a fresh push
  groundFriction: 0.075,
  airFriction: 0.025,
  turnRateDegPerSecAtLowSpeed: 135,
  turnRateDegPerSecAtMaxSpeed: 70,
  brakeDeceleration: 12,
  sideGrip: 6.2,
  powerslideGrip: 1.45,
  slopeGravity: 0.55,
  boardGroundOffset: 0.42, // capsule-center to board-bottom distance when grounded
  airTurnRateDegPerSec: 58, // limited arcade air control
  leanMaxRad: 0.34, // body/board roll into a turn at full steer + full speed
  leanSmoothing: 9,
  modeToggleMaxSpeed: 1.5, // can't flip to walking above this speed
};

export const TRICK = {
  ollieImpulse: 5.9,
  ollieMaxImpulse: 8.1,
  chargeSeconds: 0.38,
  flickWindowSeconds: 0.46,
  ollieTiltDuration: 0.28,
  kickflipDuration: 0.55,
  bailLandingAngleThresholdDeg: 35,
  minAirTimeForBail: 0.15,
  coyoteTime: 0.12, // seconds after rolling off an edge where an ollie still counts (post-edge grace)
  jumpBufferTime: 0.15, // a Space press up to this long BEFORE landing still fires on touchdown (pre-edge grace)
  landingForgiveness: 0.12, // trick may finish this many seconds AFTER touchdown and still be clean
  bodySpinRateDegPerSec: 410,
  bodySpinLandingToleranceDeg: 64,
  comboWindowSeconds: 3.0,
  scores: {
    ollie: 45,
    kickflip: 150,
    heelflip: 160,
    shove: 140,
    threeShove: 240,
    varial: 260,
    threeSixtyFlip: 420,
    body180: 120,
    body360: 260,
    grind: 10 /* per meter-ish tick */,
    cleanLanding: 25,
  },
};

export const GRIND = {
  minEntrySpeed: 2.5,
  snapDistance: 0.9,
  exitBoostImpulse: 3,
};

export const RAGDOLL = {
  boneRadius: 0.14,
  settleVelocityThreshold: 0.35,
  settleFrames: 40,
  timeoutSeconds: 2.5,
  fallHeightThreshold: 3.2,
  impactSpeedDeltaThreshold: 7,
  // Bail detection is fully suppressed for this long right after standing back up.
  // Without it, any stale state left over from the fall (e.g. the pre-respawn fall-peak
  // height) can immediately look like "just took another huge fall" and re-trigger the
  // ragdoll on the very next frame — an infinite respawn loop. This is the fix, applied
  // as a general-purpose grace window rather than patching one specific stale variable,
  // so the same class of bug can't resurface from a different stale-state path later.
  respawnGraceSeconds: 0.5,
};

export const CAMERA = {
  skate: { distance: 5.1, height: 2.15, lookAheight: 0.78, smoothing: 6 },
  walk: { distance: 3.9, height: 1.75, lookAheight: 0.82, smoothing: 7 },
  grind: { distance: 6.2, height: 2.8, lookAheight: 1.2, smoothing: 5 },
  ragdoll: { distance: 7.0, height: 3.2, lookAheight: 0.4, smoothing: 3.5 },
  baseFov: 60,
  maxFovBoost: 9, // extra degrees at max skate speed
  fovSmoothing: 4,
  lookAheadDistance: 1.6, // how far ahead of the player (along facing) the camera aims
  shakeDecay: 6,
  hardLandingShake: 0.22, // shake magnitude for a heavy-but-clean landing
};

export const INTERACTION = {
  npcRadius: 2.2,
  promptCheckInterval: 0.1,
};

export const PARKOUR = {
  // Vault: auto-triggered while walking into a low obstacle.
  vaultProbeDistance: 0.55,
  vaultMinHeight: 0.18,
  vaultMaxHeight: 0.68,
  vaultDuration: 0.38,
  vaultCooldown: 0.5,
  // Ledge grab: checked continuously while airborne (never while grounded — that's what
  // forces an actual jump). `maxHeight` is reach measured above the player's CURRENT feet
  // position, re-checked every frame — since feet rise through the jump arc, a ledge that
  // starts out of reach at takeoff can enter the band by the time you're near the apex.
  // With jumpImpulse's ~1.48m apex and a 2.0 band, effective ground-level reach is ~3.48m:
  // enough to grab the shop awning (3.18m) directly with a good running jump, without
  // strictly requiring the dumpster as a stepping stone.
  //
  // `minHeight` is deliberately NOT flush with vault's max (0.68) — a bare 0.68 caught
  // incidental thin ledges nowhere near climb-worthy (a bench backrest at 0.85, mid-air
  // window ledges) and made the character clamber onto furniture (confirmed live, and
  // called out directly: "why am I pulling myself up onto a bench?"). 1.15 sits clear of
  // every low prop's own detailing and well under the first real climb target (the
  // dumpster, 1.5) — anything between vault's ceiling and this is just a plain obstacle,
  // not vaultable or climbable, matching how most parkour games gate the two systems.
  ledgeGrabProbeDistance: 0.85,
  ledgeGrabMinHeight: 1.15,
  ledgeGrabMaxHeight: 2.0,
  ledgeGrabClearance: 0.5, // required headroom above the ledge to eventually stand there
  // Pulled back from the ledge's face by more than the capsule radius (0.32) so the body
  // hangs clear of the wall instead of clipping into it — confirmed live: the old 0.32
  // inset left ~zero gap and the character's lower body visibly poked through the wall.
  hangInset: 0.6,
  // NOT a tuned/guessed number — see HumanoidRig.REACH_UP_HEIGHT. ParkourSystem computes
  // the actual capsule-center-to-ledge-top offset at grab time from that plus the live
  // capsule half-extent, so the raised hands land on the ledge instead of the body just
  // floating near it at an arbitrary height (confirmed live: the old flat 0.24 put the
  // capsule far too close to the ledge for the arms to plausibly reach it).
  hangGraceSeconds: 0.2, // brief window after grabbing before a drop input is honored
  climbDuration: 0.55,
  climbCooldown: 0.4, // blocks an instant re-grab right after a climb or a drop
};

export const DRAG = {
  grabRadius: 2.0,
  // 14 caught up to the player almost instantly — read as weightless, not "dragging a
  // loaded dumpster." Slower catch-up plus the props' real mass (see DraggableProp
  // densities) is what actually sells the weight.
  followSmoothing: 6,
};

export const SHOPKEEPER = {
  coneAngleDeg: 55, // half-angle of the vision cone
  coneRange: 5.5,
};

export const TIME_OF_DAY = {
  // Slow, automatic, real-time day/night cycle (see DayNightCycle.ts) — a full loop
  // takes 15 real minutes, long enough that a play session sees gradual change rather
  // than a jarring flicker, short enough that players who stick around actually see
  // both the daytime and neon-lit night versions of the neighborhood.
  cycleDurationSeconds: 900,
  // Boots just before dusk: long shadows, dirty warm highlights, neon already beginning
  // to read. This is the strongest visual identity for the West Block.
  startTime01: 0.46,
  keyframes: [
    {
      t: 0.0,
      name: "dawn",
      sunPos: [4, 5, 14] as [number, number, number],
      sunColor: 0xffc3a5,
      sunIntensity: 1.4,
      hemiSky: 0x8ea2c2,
      hemiGround: 0x675748,
      hemiIntensity: 0.96,
      ambientColor: 0xe0c9ba,
      ambientIntensity: 0.24,
      fogColor: 0xa78377,
      nightFactor: 0.3,
    },
    {
      t: 0.25,
      name: "day",
      sunPos: [10, 18, 6] as [number, number, number],
      sunColor: 0xffe0b2,
      sunIntensity: 2.12,
      hemiSky: 0x91abc8,
      hemiGround: 0x806a55,
      hemiIntensity: 1.16,
      ambientColor: 0xe6d2bd,
      ambientIntensity: 0.32,
      fogColor: 0xb09b88,
      nightFactor: 0.0,
    },
    // Dusk is the hero look: rust-orange key light against cold violet fill.
    {
      t: 0.5,
      name: "dusk",
      sunPos: [-14, 18, 16] as [number, number, number],
      sunColor: 0xffb276,
      sunIntensity: 2.38,
      hemiSky: 0x8b8ca6,
      hemiGround: 0x70574a,
      hemiIntensity: 1.34,
      ambientColor: 0xe0baa4,
      ambientIntensity: 0.48,
      fogColor: 0xae7d72,
      nightFactor: 0.34,
    },
    {
      t: 0.75,
      name: "night",
      sunPos: [-8, 9, -12] as [number, number, number],
      sunColor: 0x3e527e,
      sunIntensity: 0.36,
      hemiSky: 0x172238,
      hemiGround: 0x171411,
      hemiIntensity: 0.34,
      ambientColor: 0x29334b,
      ambientIntensity: 0.13,
      fogColor: 0x171c27,
      nightFactor: 1.0,
    },
  ],
  // Emissive-intensity range night-reactive props (lamps/windows) ramp across, driven by
  // the interpolated `nightFactor` above. The night end is high enough to clear the
  // bloom threshold (0.82 — see PostFX.ts) so lamps/windows visibly glow after dark.
  emissiveDayIntensity: 0.25,
  emissiveNightIntensity: 2.05,
};
