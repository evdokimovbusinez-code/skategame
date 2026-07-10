import * as THREE from "three";
import { ps2Material, faceted } from "../../rendering/ps2Materials";

/**
 * Shared low-poly humanoid rig: a real bone hierarchy (nested `THREE.Group`s acting as
 * joints) instead of disconnected boxes floating at fixed world offsets. Rotating a
 * bone — e.g. `leftUpperLeg` — carries every mesh parented under it (lower leg, foot)
 * along for the ride, which is what makes procedural walk animation possible.
 *
 * All bones are parented under `hips`, which sits `HIP_HEIGHT` above the rig root (the
 * root itself is the ground-contact/feet point, matching how `PlayerController` places
 * `model.group` at `feetPosition`).
 */

export const HIP_HEIGHT = 0.7;
export const UPPER_LEG_LEN = 0.35;
export const LOWER_LEG_LEN = 0.34;
const SPINE_PIVOT = 0.1; // spine's own joint offset above the hips origin
export const SPINE_LEN = 0.52;
export const SHOULDER_DROP = 0.15; // shoulder joint sits this far below the neck
export const UPPER_ARM_LEN = 0.31;
export const LOWER_ARM_LEN = 0.28;
const HEAD_SIZE = 0.31;

/** Shoulder-joint height above the feet/ground (root is planted at the feet — see the
 * class doc below). Real measurement from the same numbers the rig itself is built from,
 * not a guessed constant, so anything positioning relative to the body (ledge-grab hang,
 * carried props) stays correct if the rig proportions ever change. */
export const SHOULDER_HEIGHT = HIP_HEIGHT + SPINE_PIVOT + (SPINE_LEN - SHOULDER_DROP);

/** Fingertip height above the feet when an arm is raised fully straight overhead — the
 * reach a ledge-grab hang pose needs to match so the hands actually land on the ledge. */
export const REACH_UP_HEIGHT = SHOULDER_HEIGHT + UPPER_ARM_LEN + LOWER_ARM_LEN;

export interface RigColors {
  skin: THREE.ColorRepresentation;
  shirt: THREE.ColorRepresentation;
  sleeves?: THREE.ColorRepresentation;
  pants: THREE.ColorRepresentation;
  shoes: THREE.ColorRepresentation;
}

export interface HumanoidBones {
  hips: THREE.Group;
  spine: THREE.Group;
  head: THREE.Group;
  leftUpperArm: THREE.Group;
  leftLowerArm: THREE.Group;
  rightUpperArm: THREE.Group;
  rightLowerArm: THREE.Group;
  leftUpperLeg: THREE.Group;
  leftLowerLeg: THREE.Group;
  leftFoot: THREE.Group;
  rightUpperLeg: THREE.Group;
  rightLowerLeg: THREE.Group;
  rightFoot: THREE.Group;
}

export interface HumanoidRig {
  group: THREE.Group; // root — position this at the character's feet/ground point
  bones: HumanoidBones;
}

function makeMesh(geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(faceted(geometry), material);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function box(size: [number, number, number], material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(faceted(new THREE.BoxGeometry(...size)), material);
  mesh.position.set(...pos);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function capsule(totalLength: number, radius: number, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  return makeMesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, totalLength - radius * 2), 2, 7), material, pos);
}

function tapered(top: number, bottom: number, height: number, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  return makeMesh(new THREE.CylinderGeometry(top, bottom, height, 7), material, pos);
}

function sphere(radius: number, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  return makeMesh(new THREE.SphereGeometry(radius, 7, 5), material, pos);
}

function addFace(head: THREE.Group): void {
  const eyeWhiteMat = ps2Material(0xe9e2d3);
  const eyeMat = ps2Material(0x161616);
  const noseMat = ps2Material(0xb9784f);
  const mouthMat = ps2Material(0x5a2d2b);
  const browMat = ps2Material(0x23151d);

  const eyeGeo = new THREE.BoxGeometry(0.072, 0.047, 0.014);
  const pupilGeo = new THREE.BoxGeometry(0.027, 0.036, 0.012);
  const leftEye = makeMesh(eyeGeo.clone(), eyeWhiteMat, [-0.063, 0.185, 0.137]);
  const rightEye = makeMesh(eyeGeo.clone(), eyeWhiteMat, [0.063, 0.185, 0.137]);
  const leftPupil = makeMesh(pupilGeo.clone(), eyeMat, [-0.054, 0.183, 0.151]);
  const rightPupil = makeMesh(pupilGeo.clone(), eyeMat, [0.054, 0.183, 0.151]);
  const leftBrow = box([0.07, 0.018, 0.016], browMat, [-0.06, 0.225, 0.142]);
  const rightBrow = box([0.07, 0.018, 0.016], browMat, [0.06, 0.225, 0.142]);
  leftBrow.rotation.z = 0.15;
  rightBrow.rotation.z = -0.15;
  const nose = box([0.034, 0.05, 0.026], noseMat, [0, 0.135, 0.154]);
  const mouth = box([0.09, 0.015, 0.012], mouthMat, [0, 0.085, 0.144]);

  head.add(leftEye, rightEye, leftPupil, rightPupil, leftBrow, rightBrow, nose, mouth);
}

/** Builds a fresh rig (own geometry/materials — safe to call once per character instance). */
export function buildHumanoidRig(colors: RigColors): HumanoidRig {
  const skinMat = ps2Material(colors.skin);
  const shirtMat = ps2Material(colors.shirt);
  const sleeveMat = ps2Material(colors.sleeves ?? colors.shirt);
  const pantsMat = ps2Material(colors.pants);
  const shoeMat = ps2Material(colors.shoes);
  const soleMat = ps2Material(0xf1ead8);

  const group = new THREE.Group();

  const hips = new THREE.Group();
  hips.position.set(0, HIP_HEIGHT, 0);
  hips.add(box([0.42, 0.14, 0.26], pantsMat, [0, 0.035, 0]));
  hips.add(box([0.46, 0.06, 0.28], pantsMat, [0, 0.135, 0.005]));
  group.add(hips);

  // ---- Spine -> head ----
  const spine = new THREE.Group();
  spine.position.set(0, SPINE_PIVOT, 0); // pivot at top of pelvis
  spine.add(tapered(0.2, 0.29, SPINE_LEN, shirtMat, [0, SPINE_LEN / 2, 0]));
  spine.add(box([0.55, 0.09, 0.23], shirtMat, [0, SPINE_LEN - 0.12, 0]));
  spine.add(box([0.13, 0.085, 0.13], skinMat, [0, SPINE_LEN - 0.035, 0]));
  hips.add(spine);

  const head = new THREE.Group();
  head.position.set(0, SPINE_LEN, 0); // neck joint
  head.add(box([0.27, 0.3, 0.25], skinMat, [0, HEAD_SIZE * 0.5, 0]));
  head.add(sphere(0.032, skinMat, [-0.15, HEAD_SIZE * 0.48, 0]));
  head.add(sphere(0.032, skinMat, [0.15, HEAD_SIZE * 0.48, 0]));
  addFace(head);
  spine.add(head);

  // ---- Arms (shoulder joint hangs off the spine near the top) ----
  const buildArm = (sign: 1 | -1) => {
    const upper = new THREE.Group();
    upper.position.set(sign * 0.275, SPINE_LEN - SHOULDER_DROP, 0);
    upper.add(capsule(UPPER_ARM_LEN, 0.06, sleeveMat, [0, -UPPER_ARM_LEN / 2, 0]));
    spine.add(upper);

    const lower = new THREE.Group();
    lower.position.set(0, -UPPER_ARM_LEN, 0); // elbow joint
    lower.add(capsule(LOWER_ARM_LEN, 0.048, skinMat, [0, -LOWER_ARM_LEN / 2, 0]));
    lower.add(box([0.085, 0.055, 0.07], skinMat, [0, -LOWER_ARM_LEN - 0.025, 0.014]));
    upper.add(lower);

    return { upper, lower };
  };
  const leftArm = buildArm(-1);
  const rightArm = buildArm(1);

  // ---- Legs (hip joint at the hips bone's own origin) ----
  const buildLeg = (sign: 1 | -1) => {
    const upper = new THREE.Group();
    upper.position.set(sign * 0.125, 0, 0);
    upper.add(capsule(UPPER_LEG_LEN, 0.078, pantsMat, [0, -UPPER_LEG_LEN / 2, 0]));
    hips.add(upper);

    const lower = new THREE.Group();
    lower.position.set(0, -UPPER_LEG_LEN, 0); // knee joint
    lower.add(capsule(LOWER_LEG_LEN, 0.068, pantsMat, [0, -LOWER_LEG_LEN / 2, 0]));
    upper.add(lower);

    const foot = new THREE.Group();
    foot.position.set(0, -LOWER_LEG_LEN, 0); // ankle joint; shoe mesh sits forward from it
    foot.add(box([0.2, 0.09, 0.37], shoeMat, [0, 0.025, 0.072]));
    foot.add(box([0.22, 0.03, 0.4], soleMat, [0, -0.035, 0.072]));
    foot.add(box([0.18, 0.028, 0.12], soleMat, [0, 0.05, 0.245]));
    lower.add(foot);

    return { upper, lower, foot };
  };
  const leftLeg = buildLeg(-1);
  const rightLeg = buildLeg(1);

  return {
    group,
    bones: {
      hips,
      spine,
      head,
      leftUpperArm: leftArm.upper,
      leftLowerArm: leftArm.lower,
      rightUpperArm: rightArm.upper,
      rightLowerArm: rightArm.lower,
      leftUpperLeg: leftLeg.upper,
      leftLowerLeg: leftLeg.lower,
      leftFoot: leftLeg.foot,
      rightUpperLeg: rightLeg.upper,
      rightLowerLeg: rightLeg.lower,
      rightFoot: rightLeg.foot,
    },
  };
}
