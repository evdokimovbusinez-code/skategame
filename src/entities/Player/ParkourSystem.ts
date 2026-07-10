import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PARKOUR } from "../../config/constants";
import { REACH_UP_HEIGHT } from "./HumanoidRig";
import type { PlayerController } from "./PlayerController";

interface LedgeHit {
  topY: number; // world Y of the obstacle's top surface
  point: THREE.Vector3; // where the down-ray landed on the obstacle's surface
}

/**
 * Parkour: auto-vault over low obstacles while walking (no button — Mirror's Edge/Dying
 * Light style), and a ledge grab/hang/climb for anything taller — jump toward a ledge,
 * grab it automatically once you're close enough (checked every airborne frame, so the
 * jump itself closes the gap), then Space to pull up or S to drop. Both vault and the
 * climb-up are a scripted position lerp (kinematic-feeling, like the skate trick system)
 * rather than full physics simulation — simple, readable, reliable.
 */
export class ParkourSystem {
  private cooldown = 0;
  private timer = 0;
  private duration = 0;
  private start = new THREE.Vector3(); // feet-space start
  private end = new THREE.Vector3(); // feet-space end
  private mode: "vault" | "climb" = "vault";
  private halfExtent = 0;
  private exitVelocity = new THREE.Vector3();

  // Ledge-hang state — populated by tryGrabLedge(), consumed by updateHang().
  private hangLedge: LedgeHit | null = null;
  private hangDir = new THREE.Vector3();
  private hangCenter = new THREE.Vector3(); // capsule-center world position while hanging
  private hangGraceTimer = 0;

  /** Call every grounded Walking-state frame while NOT already vaulting. May start a
   * vault and set `ctx.vaulting = true`, in which case the caller should skip normal
   * movement this frame. */
  tryStart(ctx: PlayerController): void {
    this.cooldown = Math.max(0, this.cooldown - 1 / 60);
    if (this.cooldown > 0 || !ctx.grounded) return;
    // Auto-vault only while actually moving forward into something — standing still next
    // to a curb shouldn't launch the player over it.
    if (!ctx.isMovingOnFoot) return;

    const dir = new THREE.Vector3(Math.sin(ctx.visualYaw), 0, Math.cos(ctx.visualYaw));
    const feet = ctx.feetPosition;
    const low = this.probe(ctx, feet, dir, PARKOUR.vaultProbeDistance, PARKOUR.vaultMinHeight, PARKOUR.vaultMaxHeight);
    if (low) this.begin(ctx, feet, dir, low, "vault", PARKOUR.vaultDuration);
  }

  /** Call every airborne Walking-state frame while NOT vaulting/hanging. A jump alone
   * won't reach most ledges from a standing start — this is checked continuously as the
   * player rises, so the ledge enters reach partway through the jump arc instead of
   * needing to already be in range at takeoff. Sets `ctx.hanging = true` on a grab. */
  tryGrabLedge(ctx: PlayerController): void {
    this.cooldown = Math.max(0, this.cooldown - 1 / 60);
    if (this.cooldown > 0 || ctx.grounded) return;

    const dir = new THREE.Vector3(Math.sin(ctx.visualYaw), 0, Math.cos(ctx.visualYaw));
    const feet = ctx.feetPosition;
    const ledge = this.probe(
      ctx,
      feet,
      dir,
      PARKOUR.ledgeGrabProbeDistance,
      PARKOUR.ledgeGrabMinHeight,
      PARKOUR.ledgeGrabMaxHeight,
    );
    if (!ledge || !this.hasClearance(ctx, ledge)) return;

    this.halfExtent = ctx.capsuleHalfExtent;
    this.hangLedge = ledge;
    this.hangDir.copy(dir);
    // Capsule-center-to-ledge-top offset such that a fully-raised hand (REACH_UP_HEIGHT
    // above the feet) actually lands on the ledge, not a guessed/flat number.
    const handOffset = REACH_UP_HEIGHT - this.halfExtent;
    this.hangCenter.set(
      ledge.point.x - dir.x * PARKOUR.hangInset,
      ledge.topY - handOffset,
      ledge.point.z - dir.z * PARKOUR.hangInset,
    );
    this.hangGraceTimer = PARKOUR.hangGraceSeconds;

    ctx.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    ctx.body.setNextKinematicTranslation({ x: this.hangCenter.x, y: this.hangCenter.y, z: this.hangCenter.z });
    ctx.hanging = true;
    ctx.clearFallTracking();
  }

  /** Drives the idle hang — call every frame while `ctx.hanging` instead of normal
   * movement. Space pulls up onto the ledge (via the same lerp machinery as a vault);
   * S/Down drops back to a normal fall. */
  updateHang(ctx: PlayerController, dt: number): void {
    this.hangGraceTimer = Math.max(0, this.hangGraceTimer - dt);
    // Kinematic bodies hold their last set target, but re-issuing it every frame is cheap
    // and avoids any chance of the body drifting if something else nudges it.
    ctx.body.setNextKinematicTranslation({ x: this.hangCenter.x, y: this.hangCenter.y, z: this.hangCenter.z });

    if (ctx.input.justPressed("Space")) {
      const hangFeet = new THREE.Vector3(this.hangCenter.x, this.hangCenter.y - this.halfExtent, this.hangCenter.z);
      ctx.hanging = false;
      this.begin(ctx, hangFeet, this.hangDir, this.hangLedge!, "climb", PARKOUR.climbDuration);
      return;
    }
    if (this.hangGraceTimer <= 0 && (ctx.input.justPressed("KeyS") || ctx.input.justPressed("ArrowDown"))) {
      ctx.hanging = false;
      ctx.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      ctx.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      this.cooldown = PARKOUR.climbCooldown;
    }
  }

  /** Drives the in-progress vault/climb — call instead of normal movement while `ctx.vaulting`. */
  update(ctx: PlayerController, dt: number): void {
    this.timer += dt;
    const t = Math.min(1, this.timer / this.duration);
    const eased = 1 - (1 - t) * (1 - t); // ease-out: quick rise, soft landing

    const feetPos = this.start.clone().lerp(this.end, eased);
    // Arc the mid-flight height a bit above a straight lerp so it reads as a hop/climb,
    // not a slide — peaks at the midpoint of the motion.
    feetPos.y += Math.sin(t * Math.PI) * (this.mode === "vault" ? 0.18 : 0.05);

    ctx.body.setNextKinematicTranslation({ x: feetPos.x, y: feetPos.y + this.halfExtent, z: feetPos.z });

    if (t >= 1) {
      ctx.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      ctx.body.setLinvel({ x: this.exitVelocity.x, y: 0, z: this.exitVelocity.z }, true);
      ctx.vaulting = false;
      this.cooldown = this.mode === "vault" ? PARKOUR.vaultCooldown : PARKOUR.climbCooldown;
    }
  }

  private begin(
    ctx: PlayerController,
    feet: THREE.Vector3,
    dir: THREE.Vector3,
    ledge: LedgeHit,
    mode: "vault" | "climb",
    duration: number,
  ): void {
    this.mode = mode;
    this.timer = 0;
    this.duration = duration;
    this.halfExtent = ctx.capsuleHalfExtent;
    this.start.copy(feet);

    // Land just past the obstacle's near FACE (the actual raycast hit point), not a fixed
    // distance from the player's pre-vault position — the approach distance varies, and
    // landing short of the real edge left the capsule teetering off the platform instead
    // of resting on it (confirmed live: it slid off over several frames post-landing).
    const inset = mode === "vault" ? 0.4 : 0.3;
    this.end.set(ledge.point.x + dir.x * inset, ledge.topY, ledge.point.z + dir.z * inset);
    // Climb's exit nudge is deliberately small: a full 0.6 m/s carried across a narrow
    // platform (e.g. the dumpster, ~1.7m across) before WalkController's own deceleration
    // caught up was enough to drift the player right off the far edge and into another
    // ledge grab — not broken (they just catch themselves again), but landings should
    // read as "you're standing here now," not "you're still sliding."
    this.exitVelocity.copy(dir).multiplyScalar(mode === "vault" ? 2.2 : 0.25);

    ctx.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    ctx.vaulting = true;
  }

  /**
   * Down-ray ledge detection: cast straight down from a point `distance` ahead of the
   * player (well above the climb band) to find whatever top surface is there. This
   * works identically for a thick wall's top and a thin floating slab (an awning, a
   * platform reached by a stepping-stone jump) — an earlier version additionally
   * required a forward ray to hit a "wall" at just-below-ledge height, which reliably
   * broke thin/elevated ledges: there's genuinely open air directly under a floating
   * awning, so that ray found nothing even though the mantle is completely valid
   * (confirmed live: chained dumpster->awning mantles silently failed every time).
   *
   * Without an explicit wall hit, false positives are still bounded by three things
   * together: the landing point is capped at exactly `distance` away (can't reach far
   * across open space), the height must be a genuine climb (`minHeight`..`maxHeight`
   * ABOVE current feet, so flat ground never qualifies), and the caller only allows
   * this while grounded (vault) or airborne (ledge grab) as appropriate — never both.
   * That's enough to keep it from firing on a random rooftop with nothing connecting it
   * to the player.
   */
  private probe(
    ctx: PlayerController,
    feet: THREE.Vector3,
    dir: THREE.Vector3,
    distance: number,
    minHeight: number,
    maxHeight: number,
  ): LedgeHit | null {
    const world = ctx.physicsWorld;

    const aheadX = feet.x + dir.x * distance;
    const aheadZ = feet.z + dir.z * distance;
    const downOrigin = { x: aheadX, y: feet.y + maxHeight + 0.5, z: aheadZ };
    const downRay = new RAPIER.Ray(downOrigin, { x: 0, y: -1, z: 0 });
    const downHit = world.castRay(downRay, maxHeight + 1, true, undefined, undefined, undefined, ctx.body);
    if (!downHit) return null;

    const topY = downOrigin.y - downHit.timeOfImpact;
    const height = topY - feet.y;
    if (height < minHeight || height > maxHeight) return null;

    return { topY, point: new THREE.Vector3(aheadX, topY, aheadZ) };
  }

  private hasClearance(ctx: PlayerController, ledge: LedgeHit): boolean {
    const world = ctx.physicsWorld;
    const ray = new RAPIER.Ray({ x: ledge.point.x, y: ledge.topY + 0.05, z: ledge.point.z }, { x: 0, y: 1, z: 0 });
    const hit = world.castRay(ray, PARKOUR.ledgeGrabClearance, true, undefined, undefined, undefined, ctx.body);
    return !hit; // clear headroom to actually stand up there
  }
}
