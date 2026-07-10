import * as THREE from "three";
import type { HumanoidBones } from "./HumanoidRig";
import { LOWER_LEG_LEN, UPPER_LEG_LEN } from "./HumanoidRig";

export type LegSide = "left" | "right";

export interface LegIKTarget {
  target: THREE.Vector3; // ankle target in model-root local space
  pole: THREE.Vector3; // knee bend hint in model-root local space
  footEuler?: THREE.Euler; // desired foot orientation in model-root local space
  blend?: number;
}

const DOWN = new THREE.Vector3(0, -1, 0);
const FALLBACK_POLE = new THREE.Vector3(0, 0, 1);
const EPS = 1e-5;

const scratchTargetHips = new THREE.Vector3();
const scratchHip = new THREE.Vector3();
const scratchToTarget = new THREE.Vector3();
const scratchDir = new THREE.Vector3();
const scratchPole = new THREE.Vector3();
const scratchKneeDir = new THREE.Vector3();
const scratchAnkleDir = new THREE.Vector3();
const scratchAnkleDirUpper = new THREE.Vector3();
const scratchDesiredFootQ = new THREE.Quaternion();
const scratchParentQ = new THREE.Quaternion();
const scratchLocalFootQ = new THREE.Quaternion();
const scratchHipsInvQ = new THREE.Quaternion();
const scratchUpperInvQ = new THREE.Quaternion();
const scratchSolvedUpperQ = new THREE.Quaternion();
const scratchSolvedLowerQ = new THREE.Quaternion();

function legBones(bones: HumanoidBones, side: LegSide) {
  return side === "left"
    ? { upper: bones.leftUpperLeg, lower: bones.leftLowerLeg, foot: bones.leftFoot }
    : { upper: bones.rightUpperLeg, lower: bones.rightLowerLeg, foot: bones.rightFoot };
}

/**
 * Analytic two-bone IK for the low-poly humanoid leg.
 *
 * Targets are authored in the model root's local space, then converted under the hips
 * bone so skate stance yaw, fakie offsets, and walk facing all stay compatible. The
 * solver aims the upper leg at a computed knee point and the lower leg at the ankle,
 * then orients the foot back into the requested root-space orientation.
 */
export function solveLegIK(bones: HumanoidBones, side: LegSide, ik: LegIKTarget): void {
  const { upper, lower, foot } = legBones(bones, side);
  const blend = THREE.MathUtils.clamp(ik.blend ?? 1, 0, 1);
  if (blend <= 0) return;

  scratchHipsInvQ.copy(bones.hips.quaternion).invert();
  scratchTargetHips.copy(ik.target).sub(bones.hips.position).applyQuaternion(scratchHipsInvQ);
  scratchHip.copy(upper.position);
  scratchToTarget.copy(scratchTargetHips).sub(scratchHip);

  const rawDist = scratchToTarget.length();
  const maxReach = UPPER_LEG_LEN + LOWER_LEG_LEN - 0.001;
  const minReach = Math.abs(UPPER_LEG_LEN - LOWER_LEG_LEN) + 0.001;
  const dist = THREE.MathUtils.clamp(rawDist, minReach, maxReach);

  if (rawDist < EPS) {
    scratchDir.set(0, -1, 0);
  } else {
    scratchDir.copy(scratchToTarget).multiplyScalar(1 / rawDist);
  }

  scratchPole.copy(ik.pole).applyQuaternion(scratchHipsInvQ);
  scratchPole.add(scratchHip).sub(scratchHip);
  scratchPole.addScaledVector(scratchDir, -scratchPole.dot(scratchDir));
  if (scratchPole.lengthSq() < EPS) scratchPole.copy(FALLBACK_POLE).addScaledVector(scratchDir, -FALLBACK_POLE.dot(scratchDir));
  scratchPole.normalize();

  const kneeAlong = THREE.MathUtils.clamp(
    (UPPER_LEG_LEN * UPPER_LEG_LEN + dist * dist - LOWER_LEG_LEN * LOWER_LEG_LEN) /
      (2 * UPPER_LEG_LEN * dist),
    -1,
    1,
  );
  const kneeOut = Math.sqrt(Math.max(0, 1 - kneeAlong * kneeAlong));

  scratchKneeDir.copy(scratchDir).multiplyScalar(kneeAlong).addScaledVector(scratchPole, kneeOut).normalize();
  scratchSolvedUpperQ.setFromUnitVectors(DOWN, scratchKneeDir);

  scratchAnkleDir.copy(scratchTargetHips).sub(scratchHip).addScaledVector(scratchKneeDir, -UPPER_LEG_LEN);
  if (scratchAnkleDir.lengthSq() < EPS) scratchAnkleDir.copy(DOWN);
  else scratchAnkleDir.normalize();

  scratchUpperInvQ.copy(scratchSolvedUpperQ).invert();
  scratchAnkleDirUpper.copy(scratchAnkleDir).applyQuaternion(scratchUpperInvQ).normalize();
  scratchSolvedLowerQ.setFromUnitVectors(DOWN, scratchAnkleDirUpper);

  upper.quaternion.slerp(scratchSolvedUpperQ, blend);
  lower.quaternion.slerp(scratchSolvedLowerQ, blend);

  if (ik.footEuler) {
    scratchDesiredFootQ.setFromEuler(ik.footEuler);
    scratchParentQ.copy(bones.hips.quaternion).multiply(upper.quaternion).multiply(lower.quaternion);
    scratchLocalFootQ.copy(scratchParentQ).invert().multiply(scratchDesiredFootQ);
    foot.quaternion.slerp(scratchLocalFootQ, blend);
  }
}
