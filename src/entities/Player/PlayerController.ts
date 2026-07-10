import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../../core/PhysicsWorld";
import { InputManager } from "../../core/InputManager";
import { StateMachine } from "../../core/StateMachine";
import { PLAYER } from "../../config/constants";
import type { PlayerModelParts } from "./PlayerModel";
import { buildPlayerModel } from "./PlayerModel";
import { WalkController } from "./WalkController";
import { SkateController } from "./SkateController";
import type { TrickType } from "./TrickSystem";
import { TrickSystem } from "./TrickSystem";
import type { RailPiece } from "../../world/geometry/streetKit";
import { GrindSystem } from "../../world/GrindRail";
import { RAGDOLL, SKATE } from "../../config/constants";
import { RagdollRig } from "./RagdollController";
import { gameEvents } from "../../core/GameEvents";
import { Animator } from "./Animator";
import { SkateAnimator } from "./SkateAnimator";
import { ParkourSystem } from "./ParkourSystem";

export type PlayerState = "Walking" | "Skating" | "Ragdoll";
export type BailReason = "bad-landing" | "hard-impact" | "big-fall";
export type SkatePopStyle = "ollie" | "nollie";

const BOARD_UNDER_FEET = { position: new THREE.Vector3(0, 0.14, 0), rotation: new THREE.Euler(0, 0, 0) };
// Strapped diagonally across the back (spine-bone-local space) instead of held out in
// front of the body — frees up the hands to actually carry things (see setCarryingBeer)
// and reads as an idle skater carry instead of an awkward held-out pose.
const BOARD_ON_BACK = {
  position: new THREE.Vector3(0, -0.05, -0.16),
  rotation: new THREE.Euler(Math.PI / 2, 0, Math.PI / 5),
};
const TWO_PI = Math.PI * 2;

function normalizeAngle(rad: number): number {
  const normalized = THREE.MathUtils.euclideanModulo(rad + Math.PI, TWO_PI) - Math.PI;
  return Math.abs(normalized) < 0.001 ? 0 : normalized;
}

export class PlayerController {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly model: PlayerModelParts;
  readonly input: InputManager;

  yaw = 3.72; // camera-control yaw, driven by mouse-look — also the skate/board facing
  visualYaw = 3.72; // rendered body facing while Walking (GTA5-style: turns to face travel direction)
  skateSpeed = 0;
  grounded = false;
  groundedLastFrame = false;
  groundNormal = new THREE.Vector3(0, 1, 0);
  isMovingOnFoot = false;
  walkSpeedFrac = 0;
  vaulting = false; // true while ParkourSystem owns the body (vault or climb-up in progress)
  hanging = false; // true while gripping a grabbed ledge, idle (see ParkourSystem.tryGrabLedge)

  trickType: TrickType = "none";
  trickTimer = 0;
  trickDuration = 0;
  trickYawOffset = 0;
  trickPopStyle: SkatePopStyle = "ollie";
  switchStance = false;
  stanceYawOffset = 0;
  stanceToggleCooldown = 0;
  pendingBail = false;
  bailReason: BailReason = "bad-landing";
  combatSwingTimer = 0;
  combatSwingDuration = 0;
  combatSwingHeavy = false;

  lean = 0; // visual roll into turns, driven by SkateController
  timeSinceGrounded = 0; // for coyote time
  jumpBufferTimer = 0; // for pre-landing jump input buffering
  airTime = 0;
  airTimeAtLanding = 0;

  grinding = false;
  grindRail: RailPiece | null = null;
  grindT = 0;
  grindDir: 1 | -1 = 1;
  grindSpeed = 0;

  private physics: PhysicsWorld;
  private scene: THREE.Scene;
  private rails: RailPiece[];
  private fsm: StateMachine<PlayerState, PlayerController>;
  private halfExtent: number; // capsule half-height + radius, center-to-feet distance

  private airPeakY: number | null = null;
  private preStepSpeed = 0;
  private currentRagdoll: RagdollRig | null = null;
  private lastRagdollSpawnFeet = new THREE.Vector3();
  private respawnGraceTimer = 0;
  private animator = new Animator();
  private skateAnimator = new SkateAnimator();
  private parkour = new ParkourSystem();

  constructor(physics: PhysicsWorld, scene: THREE.Scene, input: InputManager, rails: RailPiece[] = []) {
    this.physics = physics;
    this.scene = scene;
    this.input = input;
    this.rails = rails;
    this.halfExtent = PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius;

    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...PLAYER.spawnPosition)
      .lockRotations()
      .setLinearDamping(0.05)
      // CCD: without this, a fast-falling/fast-moving capsule can tunnel straight through
      // thin static colliders (ground/ramps) between physics steps and end up stuck below
      // the floor with nothing to push it back out — confirmed live, see BUG_AUDIT.md.
      .setCcdEnabled(true);
    this.body = physics.world.createRigidBody(bodyDesc);

    // Movement is fully velocity-driven by Walk/SkateController. Contact friction on
    // the capsule makes Rapier eat horizontal skate speed after every physics step, so
    // use zero friction + Min combine and let the skate controller own rolling drag.
    const colliderDesc = RAPIER.ColliderDesc.capsule(PLAYER.capsuleHalfHeight, PLAYER.capsuleRadius)
      .setFriction(0)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    this.collider = physics.world.createCollider(colliderDesc, this.body);

    this.model = buildPlayerModel();
    scene.add(this.model.group);

    this.fsm = new StateMachine<PlayerState, PlayerController>("Skating", this);
    this.fsm.register("Walking", {
      enter: (ctx) => {
        ctx.setBoardCarried(true);
        ctx.visualYaw = ctx.yaw;
      },
      exit: (ctx) => {
        ctx.animator.reset(ctx.model.bones);
        ctx.setHangPose(false);
      },
      update: (ctx, dt) => {
        if (ctx.hanging) {
          ctx.parkour.updateHang(ctx, dt);
          ctx.setHangPose(true);
        } else if (ctx.vaulting) {
          ctx.parkour.update(ctx, dt);
        } else {
          ctx.parkour.tryStart(ctx); // grounded: may auto-vault and set ctx.vaulting
          if (!ctx.vaulting && !ctx.grounded) ctx.parkour.tryGrabLedge(ctx); // airborne: may grab and set ctx.hanging
          if (!ctx.vaulting && !ctx.hanging) WalkController.update(ctx, dt);
        }
        if (!ctx.hanging) ctx.animator.update(ctx.model.bones, dt, { speedFrac: ctx.walkSpeedFrac, grounded: ctx.grounded });
      },
    });
    this.fsm.register("Skating", {
      enter: (ctx) => ctx.setBoardCarried(false),
      exit: (ctx) => ctx.skateAnimator.reset(ctx.model.bones),
      update: (ctx, dt) => {
        const pushing =
          ctx.grounded && !ctx.grinding && (ctx.input.justPressed("KeyW") || ctx.input.justPressed("ArrowUp"));
        if (ctx.grinding) {
          GrindSystem.updateGrind(ctx, dt);
        } else {
          SkateController.update(ctx, dt);
          TrickSystem.update(ctx, dt);
          GrindSystem.tryEnterGrind(ctx, ctx.rails);
        }
        ctx.skateAnimator.update(ctx.model.bones, dt, {
          speedFrac: Math.min(1, Math.abs(ctx.skateSpeed) / SKATE.maxSpeed),
          grounded: ctx.grounded,
          grinding: ctx.grinding,
          pushing,
          trickActive: ctx.trickType !== "none",
          trickType: ctx.trickType,
          trickProgress: THREE.MathUtils.clamp(
            ctx.trickDuration > 0 ? 1 - ctx.trickTimer / ctx.trickDuration : 0,
            0,
            1,
          ),
          popStyle: ctx.trickPopStyle,
          switchStance: ctx.switchStance,
          fakie: ctx.isFakie,
          airborne: !ctx.grounded,
        });
      },
    });
    this.fsm.register("Ragdoll", {
      update: (ctx, dt) => {
        if (!ctx.currentRagdoll) return;
        if (ctx.currentRagdoll.update(dt)) ctx.exitRagdoll();
      },
    });
  }

  private enterRagdoll(): void {
    const v = this.body.linvel();
    const initialVel = new THREE.Vector3(v.x, v.y, v.z);
    const feet = this.feetPosition;

    this.lastRagdollSpawnFeet.copy(feet);
    this.currentRagdoll = new RagdollRig(this.physics, this.scene, feet, initialVel, this.yaw);
    this.model.group.visible = false;
    this.grinding = false;
    TrickSystem.forceReset(this);
    this.lean = 0;
    gameEvents.emit("bail", { reason: this.bailReason });

    // Park the capsule body out of the way (kinematic, off-world) while the ragdoll plays.
    this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.body.setNextKinematicTranslation({ x: feet.x, y: -50, z: feet.z });

    this.fsm.transition("Ragdoll");
  }

  private exitRagdoll(): void {
    if (!this.currentRagdoll) return;
    let pelvis = this.currentRagdoll.pelvisPosition;
    this.currentRagdoll.destroy();
    this.currentRagdoll = null;

    // Safety net for the joint-solver-explosion case (see RagdollRig.update): if physics
    // handed back a NaN/Infinity position, fall back to where the ragdoll was spawned
    // rather than teleporting the player into undefined space.
    if (!Number.isFinite(pelvis.x) || !Number.isFinite(pelvis.y) || !Number.isFinite(pelvis.z)) {
      pelvis = this.lastRagdollSpawnFeet.clone().add(new THREE.Vector3(0, 0.56, 0));
    }

    // Defensive ground snap: a settled ragdoll's pelvis can end up resting close to (or,
    // with fast falls, slightly inside) the floor. Trusting `pelvis.y + 0.4` blindly can
    // respawn the capsule partially embedded — cast down from well above the pelvis to
    // find the real surface and stand on it, instead of guessing an offset.
    const rayOrigin = { x: pelvis.x, y: pelvis.y + 3, z: pelvis.z };
    const ray = new RAPIER.Ray(rayOrigin, { x: 0, y: -1, z: 0 });
    const hit = this.physics.world.castRay(ray, 10, true, undefined, undefined, undefined, this.body);
    const groundY = hit ? rayOrigin.y - hit.timeOfImpact : pelvis.y;
    const respawnY = Math.max(groundY + this.halfExtent + 0.02, pelvis.y + 0.4);

    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.body.setTranslation({ x: pelvis.x, y: respawnY, z: pelvis.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.model.group.visible = true;
    this.clearBailState();
    this.fsm.transition("Skating");
  }

  /**
   * Clears every piece of state a bail check reads and arms the respawn grace window.
   * Shared by `exitRagdoll()` and `teleportTo()` (e.g. the manual `R` reset) — any hard
   * position reset carries the same risk of stale state reading as "we just took another
   * huge fall" and re-triggering ragdoll on the very next frame. See
   * `RAGDOLL.respawnGraceSeconds`.
   */
  private clearBailState(): void {
    this.airPeakY = null;
    this.preStepSpeed = 0;
    this.groundedLastFrame = true;
    this.respawnGraceTimer = RAGDOLL.respawnGraceSeconds;
    this.skateSpeed = 0;
    TrickSystem.forceReset(this);
    this.grinding = false;
    this.pendingBail = false;
    // Both callers forcibly reset the body to Dynamic at a new position — if a ledge
    // grab or vault/climb was in progress, that body-type stomp already broke it (the
    // kinematic hang/lerp target is now stale), but the flags don't know that on their
    // own. Left set, Walking's update hook keeps calling updateHang()/parkour.update()
    // on a body that's no longer kinematic — confirmed live: WASD stopped responding and
    // the capsule fell uncontrolled while `hanging` still read true. Clear both so
    // normal WalkController movement resumes immediately.
    this.hanging = false;
    this.vaulting = false;
    this.setHangPose(false);
  }

  /** Hard-resets the player to a given world position — used by the manual `R` reset key.
   * Safe to call from any state (forces out of ragdoll first if needed). */
  teleportTo(position: THREE.Vector3, yaw = this.yaw): void {
    if (this.state === "Ragdoll" && this.currentRagdoll) {
      this.currentRagdoll.destroy();
      this.currentRagdoll = null;
      this.model.group.visible = true;
    }
    if (this.body.bodyType() !== RAPIER.RigidBodyType.Dynamic) {
      this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    }
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.yaw = yaw;
    this.clearBailState();
    if (this.fsm.state !== "Skating") this.fsm.transition("Skating");
  }

  get state(): PlayerState {
    return this.fsm.state;
  }

  /** Camera-follow target: the parked capsule is meaningless mid-ragdoll, so track the pelvis instead. */
  get cameraTarget(): THREE.Vector3 {
    if (this.state === "Ragdoll" && this.currentRagdoll) {
      return this.currentRagdoll.pelvisPosition;
    }
    return this.position;
  }

  setBoardCarried(carried: boolean): void {
    // Reparent (not just reposition) — under-feet is root-relative so it stays put under
    // the capsule regardless of body lean, while on-the-back is spine-relative so it
    // tracks torso rotation/animation like an actual strapped-on object would.
    const target = carried ? this.model.bones.spine : this.model.group;
    const t = carried ? BOARD_ON_BACK : BOARD_UNDER_FEET;
    target.add(this.model.board);
    this.model.board.position.copy(t.position);
    this.model.board.rotation.copy(t.rotation);
  }

  /** Toggles the visible snack bundle prop parented to the carry hand. */
  setCarryingBeer(carrying: boolean): void {
    this.model.carriedSixPack.visible = carrying;
  }

  get isFakie(): boolean {
    return Math.abs(normalizeAngle(this.stanceYawOffset)) > Math.PI / 2;
  }

  get stanceLabel(): string {
    if (this.switchStance) return this.isFakie ? "SWITCH FAKIE" : "SWITCH";
    return this.isFakie ? "FAKIE" : "REGULAR";
  }

  toggleSwitchStance(): void {
    this.switchStance = !this.switchStance;
    gameEvents.emit("trick", {
      name: this.switchStance ? "SWITCH STANCE" : "REGULAR STANCE",
      score: 0,
    });
  }

  commitBodySpinLanding(spinRad: number): void {
    this.stanceYawOffset = normalizeAngle(this.stanceYawOffset + spinRad);
  }

  playCombatSwing(heavy = false): void {
    this.combatSwingHeavy = heavy;
    this.combatSwingDuration = heavy ? 0.42 : 0.28;
    this.combatSwingTimer = this.combatSwingDuration;
  }

  private applyCombatSwingPose(): void {
    if (this.combatSwingTimer <= 0 || this.combatSwingDuration <= 0) return;
    const t = 1 - this.combatSwingTimer / this.combatSwingDuration;
    const strike = Math.sin(Math.min(1, t * 1.25) * Math.PI);
    const guard = Math.sin(Math.min(1, Math.max(0, t - 0.1) / 0.9) * Math.PI);
    const power = this.combatSwingHeavy ? 1.25 : 1;
    const b = this.model.bones;

    b.spine.rotation.z += -0.08 * power * strike;
    b.head.rotation.x += -0.04 * strike;
    b.rightUpperArm.rotation.x += -0.42 * power * strike;
    b.rightUpperArm.rotation.z += 0.24 * power * strike;
    b.rightLowerArm.rotation.x += -0.36 * power * strike;
    b.leftUpperArm.rotation.x += -0.12 * guard;
    b.leftUpperArm.rotation.z += -0.18 * guard;
  }

  /**
   * Static "gripping the ledge" pose — arms raised, applied directly instead of through
   * the walk Animator since hanging is a held pose, not a cycle.
   *
   * Derived, not guessed: an upper-arm bone at `rotation.x = 0` hangs straight down (the
   * rest pose — the arm mesh is built extending along local -Y from the shoulder joint).
   * Rotating around local X sweeps the tip through direction `(0, -cos(x), -sin(x))`. We
   * want it pointing UP (+Y) and slightly FORWARD, toward the character's own facing
   * (+Z in each bone's local space, since the whole rig — not individual bones — is what
   * yaw-rotates to face the ledge). That needs `-cos(x) > 0` (so `x` near ±π) and
   * `-sin(x) > 0` — together that's `x` slightly less than `-π`, i.e. a small NEGATIVE
   * angle past `-π/2`'s straight-up point. `HumanoidRig.REACH_UP_HEIGHT` (what
   * ParkourSystem positions the hang around) assumes this same fully-extended-overhead
   * geometry, so the pose and the hang position agree on where the hands actually are.
   */
  setHangPose(active: boolean): void {
    const b = this.model.bones;
    if (!active) {
      b.leftUpperArm.rotation.set(0, 0, 0);
      b.rightUpperArm.rotation.set(0, 0, 0);
      b.leftLowerArm.rotation.set(0, 0, 0);
      b.rightLowerArm.rotation.set(0, 0, 0);
      return;
    }
    const upperReach = -2.8; // ~160° up-and-forward from the resting straight-down pose
    const lowerBend = -0.35; // slight elbow bend — a natural grip, not a ramrod-straight arm
    b.leftUpperArm.rotation.set(upperReach, 0, 0);
    b.rightUpperArm.rotation.set(upperReach, 0, 0);
    b.leftLowerArm.rotation.set(lowerBend, 0, 0);
    b.rightLowerArm.rotation.set(lowerBend, 0, 0);
  }

  /** Exposed for ParkourSystem: call when a fall is safely arrested by a ledge grab, so
   * a later drop measures its own fall height fresh instead of chaining onto whatever
   * peak was reached before the grab (confirmed this matters: without it, catching a big
   * fall on a ledge and then dropping a short remaining distance could still trigger a
   * ragdoll bail using the ORIGINAL, much bigger fall height). */
  clearFallTracking(): void {
    this.airPeakY = null;
  }

  private tryToggleMode(): void {
    if (!this.input.justPressed("Tab")) return;
    if (!this.grounded || this.vaulting || this.grinding || this.hanging) return;
    const speed = this.state === "Skating" ? Math.abs(this.skateSpeed) : 0;
    if (speed > SKATE.modeToggleMaxSpeed) return; // avoid absurd instant-stop toggling at speed
    if (this.state === "Skating") {
      this.skateSpeed = 0;
      const v = this.body.linvel();
      this.body.setLinvel({ x: 0, y: v.y, z: 0 }, true);
      this.fsm.transition("Walking");
    } else if (this.state === "Walking") {
      this.fsm.transition("Skating");
    }
  }

  /** Exposed for ParkourSystem's obstacle raycasts. */
  get physicsWorld(): RAPIER.World {
    return this.physics.world;
  }

  /** Exposed for ParkourSystem: capsule-center-to-feet distance. */
  get capsuleHalfExtent(): number {
    return this.halfExtent;
  }

  get position(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  get feetPosition(): THREE.Vector3 {
    return this.position.sub(new THREE.Vector3(0, this.halfExtent, 0));
  }

  private updateGrounded(): void {
    const origin = this.position;
    const ray = new RAPIER.Ray(origin, { x: 0, y: -1, z: 0 });
    const maxToi = this.halfExtent + 0.2;
    const hit = this.physics.world.castRayAndGetNormal(
      ray,
      maxToi,
      true,
      undefined,
      undefined,
      undefined,
      this.body,
    );
    if (hit) {
      this.grounded = hit.timeOfImpact <= this.halfExtent + 0.12;
      this.groundNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    } else {
      this.grounded = false;
      this.groundNormal.set(0, 1, 0);
    }
  }

  /** Reads input and sets body velocities — call BEFORE physics.step() so changes apply this frame. */
  beforePhysics(dt: number): void {
    const wasGrounded = this.groundedLastFrame;
    this.updateGrounded();

    if (this.state === "Ragdoll") {
      this.fsm.update(dt);
      this.groundedLastFrame = this.grounded;
      return;
    }

    this.tryToggleMode();

    if (this.respawnGraceTimer > 0) this.respawnGraceTimer = Math.max(0, this.respawnGraceTimer - dt);

    // Fall-height and wall-bonk bail checks are meaningless while grinding, vaulting, or
    // hanging: the body is KinematicPositionBased in all three (rail-follow / vault-lerp
    // / held-in-place via setNextKinematicTranslation, not physics forces), so its
    // `grounded` raycast can hit solid geometry right below the scripted path, and
    // `linvel()` doesn't track real kinematic motion the way it does for a dynamic body.
    // Without this guard those stale readings spuriously fired a bail mid-grind (confirmed
    // live — see BUG_AUDIT.md), and a vault/hang is exactly the same shape of bug. Also
    // suppressed for a short grace window right after respawning — see
    // RAGDOLL.respawnGraceSeconds.
    if (!this.grinding && !this.vaulting && !this.hanging && this.respawnGraceTimer <= 0) {
      if (!this.grounded) {
        this.airPeakY = this.airPeakY === null ? this.position.y : Math.max(this.airPeakY, this.position.y);
      }
      if (!wasGrounded && this.grounded) {
        const fallDist = (this.airPeakY ?? this.position.y) - this.position.y;
        if (fallDist > RAGDOLL.fallHeightThreshold) {
          this.pendingBail = true;
          this.bailReason = "big-fall";
        }
        this.airPeakY = null;
      }
    }

    if (this.pendingBail) {
      this.pendingBail = false;
      this.enterRagdoll();
      this.groundedLastFrame = this.grounded;
      return;
    }

    this.combatSwingTimer = Math.max(0, this.combatSwingTimer - dt);

    this.fsm.update(dt);
    this.applyCombatSwingPose();

    const v = this.body.linvel();
    this.preStepSpeed = Math.hypot(v.x, v.z);
    this.groundedLastFrame = this.grounded;
  }

  /** Syncs the visual root from the just-stepped physics body — call AFTER physics.step(). */
  afterPhysics(): void {
    if (this.state === "Ragdoll") {
      this.currentRagdoll?.syncVisuals();
      return;
    }

    // Wall-bonk detection: a sudden drop between the velocity we set and what physics
    // actually resolved (collision response) means we slammed into something solid.
    // Skipped while grinding, vaulting, hanging, or mid-respawn-grace — see beforePhysics().
    const v = this.body.linvel();
    const postSpeed = Math.hypot(v.x, v.z);
    if (
      !this.grinding &&
      !this.vaulting &&
      !this.hanging &&
      this.respawnGraceTimer <= 0 &&
      this.preStepSpeed - postSpeed > RAGDOLL.impactSpeedDeltaThreshold
    ) {
      this.pendingBail = true;
      this.bailReason = "hard-impact";
    }

    // Position from body, rotation driven manually by yaw (physics rotation is locked,
    // so we never read body.rotation() for the player). Lean rolls the model into turns
    // while skating; walking uses `visualYaw` (GTA5-style — turns to face travel
    // direction, decoupled from the mouse-driven camera yaw in `this.yaw`).
    const baseYaw = this.state === "Walking" ? this.visualYaw : this.yaw + this.stanceYawOffset;
    const renderYaw = baseYaw + (this.state === "Skating" ? this.trickYawOffset : 0);
    this.model.group.position.copy(this.feetPosition);
    this.model.group.quaternion.setFromEuler(new THREE.Euler(0, renderYaw, this.lean, "YXZ"));
  }
}
