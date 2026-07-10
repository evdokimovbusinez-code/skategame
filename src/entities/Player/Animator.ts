import * as THREE from "three";
import { HIP_HEIGHT } from "./HumanoidRig";
import type { HumanoidBones } from "./HumanoidRig";
import { solveLegIK } from "./LegIK";

export interface AnimatorInput {
  /** 0..1, how fast relative to walk max speed. */
  speedFrac: number;
  grounded: boolean;
}

const WALK_BASE_FREQ = 5.2; // radians/sec of stride phase at a slow walk
const WALK_MAX_FREQ = 9.5; // at full speed
const ARM_SWING = 0.5;
const HIP_BOB = 0.035; // vertical bob amplitude
const IDLE_SWAY_FREQ = 1.1;
const IDLE_SWAY_AMOUNT = 0.035;
const FOOT_GROUND_Y = 0.045; // ankle height that leaves the sole kissing the ground

function walkFootTarget(side: -1 | 1, phase: number, speedFrac: number, blend: number, grounded: boolean): THREE.Vector3 {
  const stride = (0.07 + 0.3 * speedFrac) * blend;
  const lift = grounded ? Math.pow(Math.max(0, Math.sin(phase)), 1.35) * (0.055 + speedFrac * 0.085) * blend : 0.1;
  const z = Math.cos(phase) * stride;
  return new THREE.Vector3(side * 0.13, FOOT_GROUND_Y + lift, z);
}

/**
 * Drives the bone rig procedurally — no animation files, just phase-accumulated sine
 * waves, which is plenty for a PS2-era walk cycle. Only touches bones; SkateController/
 * TrickSystem own the board and never call this, so skating is untouched.
 */
export class Animator {
  private phase = 0;
  private idlePhase = 0;
  private blend = 0; // 0 = fully idle pose, 1 = fully walk-cycle pose

  update(bones: HumanoidBones, dt: number, input: AnimatorInput): void {
    const { speedFrac, grounded } = input;
    const moving = speedFrac > 0.02;

    if (grounded && moving) {
      const freq = WALK_BASE_FREQ + (WALK_MAX_FREQ - WALK_BASE_FREQ) * speedFrac;
      this.phase += freq * dt;
    }
    this.idlePhase += IDLE_SWAY_FREQ * dt;

    const targetBlend = grounded && moving ? 1 : 0;
    this.blend += (targetBlend - this.blend) * Math.min(1, dt * 8);

    const sinP = Math.sin(this.phase);
    const cosP = Math.cos(this.phase);

    // Start from a clean upper-body pose every frame. Combat/interaction overlays can
    // add on top afterward, but no stray axis should survive into the next animation
    // frame after that overlay ends.
    bones.hips.rotation.set(0, 0, 0);
    bones.spine.rotation.set(0, 0, 0);
    bones.head.rotation.set(0, 0, 0);
    bones.leftUpperArm.rotation.set(0, 0, 0);
    bones.rightUpperArm.rotation.set(0, 0, 0);
    bones.leftLowerArm.rotation.set(0, 0, 0);
    bones.rightLowerArm.rotation.set(0, 0, 0);

    // Arms counter-swing (right arm forward when left leg is forward), smaller amplitude.
    const armAmp = ARM_SWING * Math.min(1, 0.35 + speedFrac) * this.blend;
    bones.leftUpperArm.rotation.x = -sinP * armAmp;
    bones.rightUpperArm.rotation.x = sinP * armAmp;
    bones.leftLowerArm.rotation.x = -Math.max(0, sinP) * 0.4 * this.blend;
    bones.rightLowerArm.rotation.x = -Math.max(0, -sinP) * 0.4 * this.blend;

    // Hip bob: up-down at double stride frequency (both feet lift once per half-cycle),
    // fades out to a slow idle sway when standing still.
    const bobWalk = Math.abs(cosP) * HIP_BOB * this.blend;
    const idleSway = Math.sin(this.idlePhase) * IDLE_SWAY_AMOUNT * (1 - this.blend);
    bones.hips.position.y = HIP_HEIGHT + bobWalk;
    bones.spine.rotation.z = idleSway * 0.3;
    bones.head.rotation.y = Math.sin(this.idlePhase * 0.6) * IDLE_SWAY_AMOUNT * (1 - this.blend);

    const leftPhase = this.phase;
    const rightPhase = this.phase + Math.PI;
    const ikBlend = grounded ? 1 : 0.72;
    solveLegIK(bones, "left", {
      target: walkFootTarget(-1, leftPhase, speedFrac, Math.max(0.18, this.blend), grounded),
      pole: new THREE.Vector3(-0.06, -0.15, 0.42),
      footEuler: new THREE.Euler(-Math.max(0, Math.sin(leftPhase)) * 0.24 * this.blend, 0, -0.03),
      blend: ikBlend,
    });
    solveLegIK(bones, "right", {
      target: walkFootTarget(1, rightPhase, speedFrac, Math.max(0.18, this.blend), grounded),
      pole: new THREE.Vector3(0.06, -0.15, 0.42),
      footEuler: new THREE.Euler(-Math.max(0, Math.sin(rightPhase)) * 0.24 * this.blend, 0, 0.03),
      blend: ikBlend,
    });
  }

  /** Snap back to a neutral standing pose instantly (e.g. when switching out of Walking). */
  reset(bones: HumanoidBones): void {
    this.phase = 0;
    this.blend = 0;
    for (const bone of Object.values(bones)) {
      bone.rotation.set(0, 0, 0);
    }
    bones.hips.position.y = HIP_HEIGHT;
  }
}
