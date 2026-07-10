import * as THREE from "three";
import { WALK } from "../../config/constants";
import type { PlayerController } from "./PlayerController";

const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/** Shortest-path angle lerp — turning from 350° to 10° goes forward through 0°, not
 * the long way around through 180°. */
function turnToward(current: number, target: number, maxDelta: number): number {
  let diff = (target - current) % TAU;
  if (diff > Math.PI) diff -= TAU;
  if (diff < -Math.PI) diff += TAU;
  if (Math.abs(diff) <= maxDelta) return current + diff;
  return current + Math.sign(diff) * maxDelta;
}

/**
 * GTA5-style on-foot movement: WASD is relative to the camera (mouse-driven `ctx.yaw`),
 * not the character's own facing — holding `A` strafes left instead of turning. The
 * character's rendered body (`ctx.visualYaw`) smoothly rotates to face wherever the
 * player is actually walking, independent of where the camera happens to be looking.
 */
export const WalkController = {
  update(ctx: PlayerController, dt: number): void {
    const input = ctx.input;

    let strafe = 0;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) strafe += 1;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) strafe -= 1;
    let fwd = 0;
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) fwd += 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) fwd -= 1;

    const camForward = new THREE.Vector3(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
    const camRight = new THREE.Vector3(-Math.cos(ctx.yaw), 0, Math.sin(ctx.yaw));
    const moveDir = camForward.multiplyScalar(fwd).add(camRight.multiplyScalar(strafe));
    const moving = moveDir.lengthSq() > 0.0001;
    if (moving) moveDir.normalize();

    const sprinting = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    const speed = WALK.maxSpeed * (sprinting ? WALK.sprintMultiplier : 1);

    const currentVel = ctx.body.linvel();
    const currentHorizontal = new THREE.Vector3(currentVel.x, 0, currentVel.z);
    const targetVel = moveDir.multiplyScalar(moving ? speed : 0);
    const rate = moving ? WALK.acceleration : WALK.deceleration;
    const nextHorizontal = currentHorizontal.lerp(targetVel, Math.min(1, rate * dt));
    ctx.body.setLinvel({ x: nextHorizontal.x, y: currentVel.y, z: nextHorizontal.z }, true);

    if (moving) {
      const targetVisualYaw = Math.atan2(moveDir.x, moveDir.z);
      ctx.visualYaw = turnToward(ctx.visualYaw, targetVisualYaw, WALK.bodyTurnRateDegPerSec * DEG2RAD * dt);
    }
    ctx.isMovingOnFoot = moving;
    ctx.walkSpeedFrac = Math.min(1, nextHorizontal.length() / speed || 0);

    if (ctx.grounded && input.justPressed("Space")) {
      const v = ctx.body.linvel();
      ctx.body.setLinvel({ x: v.x, y: WALK.jumpImpulse, z: v.z }, true);
    }
  },
};
