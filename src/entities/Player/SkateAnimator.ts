import * as THREE from "three";
import { HIP_HEIGHT } from "./HumanoidRig";
import type { HumanoidBones } from "./HumanoidRig";
import type { TrickType } from "./TrickSystem";
import type { SkatePopStyle } from "./PlayerController";
import { solveLegIK } from "./LegIK";

export interface SkateAnimInput {
  speedFrac: number; // 0..1 of skate max speed
  grounded: boolean;
  grinding: boolean;
  pushing: boolean; // player just tapped/holds push this frame
  trickActive: boolean; // ollie/kickflip tween in progress
  trickType: TrickType;
  trickProgress: number;
  popStyle: SkatePopStyle;
  switchStance: boolean;
  fakie: boolean;
  airborne: boolean;
}

const STANCE_YAW = Math.PI / 2; // true side-on skate stance, not a forward-facing push pose
const CROUCH = 0.09; // standing knee-bend while riding
const FOOT_ON_BOARD_LIFT = 0.22; // raises shoe soles from ground-contact root to deck-top height
const DECK_ANKLE_Y = 0.205;

function pulse(t: number, start: number, end: number): number {
  if (t <= start || t >= end) return 0;
  return Math.sin(((t - start) / (end - start)) * Math.PI);
}

function isFlipTrick(type: TrickType): boolean {
  return (
    type === "kickflip" ||
    type === "heelflip" ||
    type === "varial-kickflip" ||
    type === "hardflip" ||
    type === "inward-heelflip" ||
    type === "360-flip" ||
    type === "laser-flip"
  );
}

function isShoveTrick(type: TrickType): boolean {
  return type.includes("shove") || type === "varial-kickflip" || type === "hardflip" || type === "inward-heelflip" || type === "360-flip" || type === "laser-flip";
}

/**
 * Procedural skate stance: body angled sideways (regular), knees bent, arms loose.
 * Push = back leg swings off the board in a kick stroke; ollie = crouch-then-extend;
 * grind = deep crouch with balance arms. Pure bone rotations — the board itself stays
 * owned by SkateController/TrickSystem, so skate physics/visuals stay untouched.
 */
export class SkateAnimator {
  private pushPhase = 0; // >0 while a push stroke is playing out
  private crouchBlend = 0;
  private stanceBlend = 0;
  private idleTime = 0;

  update(bones: HumanoidBones, dt: number, input: SkateAnimInput): void {
    this.idleTime += dt;
    // Blend into the sideways stance smoothly when entering skate mode.
    this.stanceBlend = THREE.MathUtils.lerp(this.stanceBlend, 1, Math.min(1, dt * 6));
    const s = this.stanceBlend;
    const stanceSign = input.switchStance ? -1 : 1;
    const leftIsFront = !input.switchStance;
    const t = THREE.MathUtils.clamp(input.trickProgress, 0, 1);
    const charging = input.trickType === "charge";
    const flipPulse = isFlipTrick(input.trickType) ? pulse(t, 0.1, 0.58) : 0;
    const shovePulse = isShoveTrick(input.trickType) ? pulse(t, 0.08, 0.48) : 0;
    const popKick = input.airborne ? Math.max(0, 1 - t / 0.24) : 0;
    const tuck = input.airborne ? Math.sin(t * Math.PI) : 0;

    // Whole-body stance: hips/spine stay almost perpendicular to the board. Set full
    // rotations every frame so temporary overlays (combat, hit reactions) cannot leave
    // hidden axis offsets behind and make the body twist like a spinning prop.
    bones.hips.rotation.set(0, STANCE_YAW * stanceSign * s, 0);
    const idleWeight = input.grounded && !input.pushing ? 1 - input.speedFrac * 0.72 : 0.18;
    const breath = Math.sin(this.idleTime * 1.8) * 0.025 * idleWeight;
    const glance = Math.sin(this.idleTime * 0.53) * 0.045 * idleWeight;
    bones.spine.rotation.set(breath * 0.35, 0.18 * stanceSign * s, breath * stanceSign);
    bones.head.rotation.set(-breath * 0.25, (-0.42 + glance) * stanceSign * s, -breath * 0.45);

    // Push stroke: kicks off automatically when SkateController reports a push, then
    // plays through even if the key is released — a stroke is a stroke.
    if (input.pushing && this.pushPhase <= 0 && input.grounded && !input.grinding) {
      this.pushPhase = 1;
    }
    if (this.pushPhase > 0) this.pushPhase = Math.max(0, this.pushPhase - dt * 2.4);

    // Target crouch: deeper in grinds, pumped before/after tricks, light while riding.
    const targetCrouch = input.grinding ? 0.3 : charging ? 0.27 : input.airborne ? 0.15 + tuck * 0.04 : input.trickActive ? 0.2 : CROUCH;
    this.crouchBlend = THREE.MathUtils.lerp(this.crouchBlend, targetCrouch, Math.min(1, dt * 8));
    const crouch = this.crouchBlend;

    bones.hips.position.y = HIP_HEIGHT + FOOT_ON_BOARD_LIFT - crouch + (input.airborne ? tuck * 0.035 : 0);

    // Legs are solved through IK targets: planted feet sit on the bolts, pop/flick feet
    // peel away from the deck, and push strokes move the rear foot off-board.
    const kick = Math.sin((1 - this.pushPhase) * Math.PI) * (this.pushPhase > 0 ? 1 : 0);
    const popRole = input.popStyle === "nollie" ? "front" : "back";
    const flickRole = input.popStyle === "nollie" ? "back" : "front";
    const makeFootIK = (side: -1 | 1, isFront: boolean) => {
      const role = isFront ? "front" : "back";
      const isPopLeg = role === popRole;
      const isFlickLeg = role === flickRole;
      const target = new THREE.Vector3(
        side * 0.11,
        DECK_ANKLE_Y + (input.airborne ? tuck * 0.055 : 0),
        isFront ? 0.255 : -0.255,
      );
      let footPitch = isFront ? -0.08 : 0.05;
      let footYaw = stanceSign * (Math.PI / 2 + (isFront ? -0.08 : 0.08));
      let footRoll = side * 0.02;

      if (role === "back") {
        target.x += side * 0.28 * kick;
        target.y = THREE.MathUtils.lerp(target.y, 0.065, kick);
        target.z -= 0.18 * kick;
        footPitch -= kick * 0.26;
        footRoll += side * kick * 0.16;
      }

      if (charging && isPopLeg) {
        target.z += isFront ? 0.055 : -0.055;
        target.y -= 0.025;
        footPitch += isFront ? -0.14 : 0.18;
      }

      if (input.airborne && isPopLeg) {
        target.z += (isFront ? 0.14 : -0.14) * popKick;
        target.y -= 0.055 * popKick;
        footPitch += (isFront ? -0.2 : 0.24) * popKick;
      }

      if (input.airborne && isFlickLeg) {
        const flick = Math.max(flipPulse, shovePulse * 0.55);
        target.x += side * (flipPulse * 0.31 + shovePulse * 0.14);
        target.y += flipPulse * 0.13 + shovePulse * 0.055;
        target.z += (isFront ? 0.1 : -0.1) * flick;
        footYaw += stanceSign * (flipPulse * 0.5 + shovePulse * 0.3);
        footRoll += -side * (flipPulse * 0.55 + shovePulse * 0.18);
      }

      if (input.airborne) {
        target.y += tuck * 0.045;
        target.z *= THREE.MathUtils.lerp(1, 0.72, tuck);
        target.x += side * tuck * 0.025;
        footPitch += (isFront ? 0.12 : -0.08) * tuck;
      }

      return {
        target,
        pole: new THREE.Vector3(side * 0.22, -0.12, isFront ? 0.36 : -0.36),
        footEuler: new THREE.Euler(footPitch, footYaw, footRoll, "YXZ"),
      };
    };

    solveLegIK(bones, "left", { ...makeFootIK(-1, leftIsFront), blend: 1 });
    solveLegIK(bones, "right", { ...makeFootIK(1, !leftIsFront), blend: 1 });

    // Arms: loose and slightly out for balance; wider in grinds/air.
    const balance = input.grinding || input.airborne ? 1 : input.fakie ? 0.68 : 0.52;
    const shoulderLife = Math.sin(this.idleTime * 1.25) * 0.035 * idleWeight;
    bones.leftUpperArm.rotation.set((-0.25 - tuck * 0.34 + shoulderLife) * s, 0, (-0.62 * balance - breath) * s);
    bones.rightUpperArm.rotation.set((-0.08 + tuck * 0.16 - shoulderLife) * s, 0, (0.62 * balance + breath) * s);
    bones.leftLowerArm.rotation.set(-0.32 * s, 0, 0);
    bones.rightLowerArm.rotation.set(-0.32 * s, 0, 0);
  }

  /** Snap all skate-pose state so the next mode starts clean. */
  reset(bones: HumanoidBones): void {
    this.pushPhase = 0;
    this.crouchBlend = 0;
    this.stanceBlend = 0;
    this.idleTime = 0;
    for (const bone of Object.values(bones)) bone.rotation.set(0, 0, 0);
    bones.hips.position.y = HIP_HEIGHT;
  }
}
