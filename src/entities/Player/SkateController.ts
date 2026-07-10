import * as THREE from "three";
import { SKATE } from "../../config/constants";
import type { PlayerController } from "./PlayerController";

const DEG2RAD = Math.PI / 180;

function damp(value: number, lambda: number, dt: number): number {
  return value * Math.exp(-lambda * dt);
}

function clampVectorLength(v: THREE.Vector3, maxLength: number): void {
  const len = v.length();
  if (len > maxLength && len > 1e-6) v.multiplyScalar(maxLength / len);
}

/**
 * Velocity-based skateboard movement.
 *
 * The old controller rebuilt horizontal velocity from a scalar every frame, so turning
 * snapped momentum directly to the board's yaw. This keeps horizontal velocity as a real
 * vector: pushes add impulse, yaw changes the board, grip gradually kills side-slip, and
 * braking lowers grip for a powerslide-style feel.
 */
export const SkateController = {
  update(ctx: PlayerController, dt: number): void {
    const input = ctx.input;

    let turn = 0;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) turn += 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) turn -= 1;

    const pushHeld = input.isDown("KeyW") || input.isDown("ArrowUp");
    const pushTapped = input.justPressed("KeyW") || input.justPressed("ArrowUp");
    const braking = input.isDown("KeyS") || input.isDown("ArrowDown");

    ctx.stanceToggleCooldown = Math.max(0, ctx.stanceToggleCooldown - dt);
    if (
      ctx.grounded &&
      !ctx.grinding &&
      ctx.trickType === "none" &&
      ctx.stanceToggleCooldown <= 0 &&
      input.justPressed("KeyX")
    ) {
      ctx.toggleSwitchStance();
      ctx.stanceToggleCooldown = 0.28;
    }

    const currentVel = ctx.body.linvel();
    const vel = new THREE.Vector3(currentVel.x, 0, currentVel.z);
    let speed = vel.length();
    let forward = new THREE.Vector3(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
    const signedForwardBefore = vel.dot(forward);
    const moveSign = signedForwardBefore < -0.3 ? -1 : 1;

    // Steering turns the board first; grip below decides how much velocity follows.
    const speedFracBefore = THREE.MathUtils.clamp(speed / SKATE.maxSpeed, 0, 1);
    const turnAuthority = ctx.grounded
      ? THREE.MathUtils.lerp(0.55, 1, THREE.MathUtils.smoothstep(speed, 0.35, 3.2))
      : 0.38;
    const turnRate = ctx.grounded
      ? THREE.MathUtils.lerp(SKATE.turnRateDegPerSecAtLowSpeed, SKATE.turnRateDegPerSecAtMaxSpeed, speedFracBefore)
      : SKATE.airTurnRateDegPerSec;
    ctx.yaw += turn * moveSign * turnRate * turnAuthority * DEG2RAD * dt;
    forward = new THREE.Vector3(Math.sin(ctx.yaw), 0, Math.cos(ctx.yaw));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    if (ctx.grounded) {
      if (pushTapped) vel.addScaledVector(forward, SKATE.pushAcceleration * SKATE.pushBurstFrac);
      if (pushHeld && !braking) {
        const forwardNow = Math.max(0, vel.dot(forward));
        const pumpScale = 1 - THREE.MathUtils.clamp(forwardNow / SKATE.maxSpeed, 0, 1);
        vel.addScaledVector(forward, SKATE.rollAcceleration * pumpScale * dt);
      }

      if (braking && speed > 1e-4) {
        const brake = Math.min(speed, SKATE.brakeDeceleration * dt);
        vel.addScaledVector(vel.clone().normalize(), -brake);
      }

      const downhill = new THREE.Vector3(0, -1, 0).projectOnPlane(ctx.groundNormal);
      if (downhill.lengthSq() > 1e-6) {
        downhill.normalize();
        vel.addScaledVector(downhill, 9.81 * SKATE.slopeGravity * dt);
      }

      // Board grip: decompose velocity in board space, then damp sideways slip. Holding
      // brake lowers grip, giving a controllable slide instead of a dead stop.
      let forwardSpeed = vel.dot(forward);
      let sideSpeed = vel.dot(right);
      const grip = braking ? SKATE.powerslideGrip : SKATE.sideGrip;
      sideSpeed = damp(sideSpeed, grip, dt);

      // Rolling resistance is proportional and low: the board coasts for a long time
      // instead of losing all speed when input is released.
      forwardSpeed = damp(forwardSpeed, SKATE.groundFriction, dt);
      if (Math.abs(forwardSpeed) < 0.025) forwardSpeed = 0;
      vel.copy(forward).multiplyScalar(forwardSpeed).addScaledVector(right, sideSpeed);
    } else {
      vel.multiplyScalar(Math.exp(-SKATE.airFriction * dt));
    }

    clampVectorLength(vel, SKATE.maxSpeed);
    speed = vel.length();
    const signedForward = vel.dot(forward);
    ctx.skateSpeed = THREE.MathUtils.clamp(signedForward, -SKATE.maxSpeed * 0.45, SKATE.maxSpeed);

    ctx.body.setLinvel({ x: vel.x, y: currentVel.y, z: vel.z }, true);

    const speedFrac = THREE.MathUtils.clamp(speed / SKATE.maxSpeed, 0, 1);
    const slip = speed > 0.01 ? THREE.MathUtils.clamp(vel.dot(right) / Math.max(speed, 1), -1, 1) : 0;
    const targetLean =
      -turn * moveSign * speedFrac * SKATE.leanMaxRad * (ctx.grounded ? 1 : 0.35) +
      slip * 0.16;
    ctx.lean = THREE.MathUtils.lerp(ctx.lean, targetLean, Math.min(1, SKATE.leanSmoothing * dt));

    // Tilt the board to roughly match the ground slope — skipped mid-trick so it doesn't
    // fight the ollie/kickflip tween, which drives board rotation directly.
    if (ctx.trickType === "none") {
      const tiltQuat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        ctx.groundNormal,
      );
      ctx.model.board.quaternion.slerp(tiltQuat, Math.min(1, 10 * dt));
    }
  },
};
