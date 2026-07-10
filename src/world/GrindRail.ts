import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { GRIND, PLAYER } from "../config/constants";
import { gameEvents } from "../core/GameEvents";
import type { PlayerController } from "../entities/Player/PlayerController";
import type { RailPiece } from "./geometry/streetKit";

const halfExtent = PLAYER.capsuleHalfHeight + PLAYER.capsuleRadius;

/** Closest point on segment [a,b] to point p, returned as {point, t} with t in [0,1]. */
function closestPointOnSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  const t = lenSq > 1e-8 ? THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / lenSq, 0, 1) : 0;
  const point = a.clone().add(ab.clone().multiplyScalar(t));
  return { point, t };
}

/**
 * Zone/spline-based grinding: no contact physics involved. Entry snaps the body to
 * KinematicPositionBased and drives it along the rail segment directly; exit hands
 * control back to the dynamic capsule with preserved momentum.
 */
export const GrindSystem = {
  tryEnterGrind(ctx: PlayerController, rails: RailPiece[]): void {
    if (ctx.grounded) return; // grinds are entered airborne, like hopping onto a ledge
    if (Math.abs(ctx.skateSpeed) < GRIND.minEntrySpeed) return;

    const playerPos = ctx.position;
    for (const rail of rails) {
      const { point, t } = closestPointOnSegment(playerPos, rail.start, rail.end);
      const dist = playerPos.distanceTo(point);
      if (dist > GRIND.snapDistance) continue;
      // Only snap if we're near the rail's ride height (avoid grinding from way above/below).
      if (Math.abs(playerPos.y - (point.y + halfExtent)) > 0.6) continue;

      const railDir = rail.end.clone().sub(rail.start).normalize();
      const facing = new THREE.Vector3(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
      const dir = facing.dot(railDir) >= 0 ? 1 : -1;

      ctx.grinding = true;
      ctx.grindRail = rail;
      ctx.grindT = t;
      ctx.grindDir = dir;
      ctx.grindSpeed = Math.max(Math.abs(ctx.skateSpeed), GRIND.minEntrySpeed);
      ctx.yaw = Math.atan2(railDir.x * dir, railDir.z * dir);
      ctx.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      gameEvents.emit("grindStart", undefined);
      gameEvents.emit("trick", { name: "GRIND", score: 0 });
      return;
    }
  },

  updateGrind(ctx: PlayerController, dt: number): void {
    const rail = ctx.grindRail;
    if (!rail) return;

    const railVec = rail.end.clone().sub(rail.start);
    const railLength = railVec.length();
    const deltaT = (ctx.grindSpeed * ctx.grindDir * dt) / railLength;
    ctx.grindT += deltaT;

    const exitEarly = ctx.input.justPressed("Space");
    const reachedEnd = ctx.grindT <= 0 || ctx.grindT >= 1;

    ctx.grindT = THREE.MathUtils.clamp(ctx.grindT, 0, 1);
    const point = rail.start.clone().add(railVec.multiplyScalar(ctx.grindT));
    const rideY = point.y + halfExtent;
    ctx.body.setNextKinematicTranslation({ x: point.x, y: rideY, z: point.z });

    gameEvents.emit("grindTick", { meters: ctx.grindSpeed * dt });

    if (exitEarly || reachedEnd) {
      exitGrind(ctx, exitEarly);
    }
  },
};

function exitGrind(ctx: PlayerController, boosted: boolean): void {
  const rail = ctx.grindRail!;
  const railDir = rail.end.clone().sub(rail.start).normalize().multiplyScalar(ctx.grindDir);

  ctx.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  const exitVel = railDir.multiplyScalar(ctx.grindSpeed);
  const boost = boosted ? GRIND.exitBoostImpulse : 0;
  ctx.body.setLinvel({ x: exitVel.x, y: boost, z: exitVel.z }, true);

  ctx.skateSpeed = ctx.grindSpeed;
  ctx.grinding = false;
  ctx.grindRail = null;
  ctx.grindT = 0;
  gameEvents.emit("grindEnd", undefined);
}
