import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../../core/PhysicsWorld";
import { RAGDOLL } from "../../config/constants";
import { ps2Material, PALETTE, faceted } from "../../rendering/ps2Materials";

interface Bone {
  name: string;
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
}

interface BoneSpec {
  name: string;
  half: [number, number, number];
  local: [number, number, number]; // offset from feet position, before yaw rotation
  material: THREE.Material;
}

function ragdollGeometry(spec: BoneSpec): THREE.BufferGeometry {
  const [hx, hy, hz] = spec.half;
  if (spec.name === "head") return new THREE.SphereGeometry(Math.max(hx, hy, hz), 7, 5);
  if (spec.name === "torso") return new THREE.CylinderGeometry(hx * 0.9, hx * 1.25, hy * 2, 7);
  if (spec.name === "pelvis") return new THREE.CylinderGeometry(hx * 1.15, hx * 1.35, hy * 2, 7);
  return new THREE.CapsuleGeometry(Math.max(hx, hz), Math.max(0.01, hy * 2 - Math.max(hx, hz) * 2), 2, 7);
}

/**
 * Simplified capsule-cluster ragdoll: a handful of box bodies (matching the standing
 * model's own box meshes 1:1) connected with spherical joints. Spawned with the player's
 * velocity transferred in, so it flies naturally instead of popping in at rest.
 */
export class RagdollRig {
  bones: Bone[] = [];
  private physics: PhysicsWorld;
  private scene: THREE.Scene;
  private settleFrameCount = 0;
  private timer = 0;

  constructor(
    physics: PhysicsWorld,
    scene: THREE.Scene,
    feetPos: THREE.Vector3,
    initialVel: THREE.Vector3,
    yaw: number,
  ) {
    this.physics = physics;
    this.scene = scene;

    const skinMat = ps2Material(PALETTE.skin);
    const shirtMat = ps2Material(0xd1495b);
    const pantsMat = ps2Material(0x1a1a1a);

    // Local offsets mirror HumanoidRig's bone proportions (hips at HIP_HEIGHT=0.56, etc.)
    // so the ragdoll reads as "the same character" collapsing, not a differently-sized
    // blob swapped in. Single-segment limbs (not upper+lower like the standing rig) —
    // more joints means more solver load and a higher chance of the CCD-style instability
    // already hit once (see BUG_AUDIT.md Round 3); 7 bones stays well inside safe territory.
    const specs: BoneSpec[] = [
      { name: "pelvis", half: [0.16, 0.1, 0.13], local: [0, 0.56, 0], material: pantsMat },
      { name: "torso", half: [0.19, 0.21, 0.12], local: [0, 0.77, 0], material: shirtMat },
      { name: "head", half: [0.13, 0.13, 0.13], local: [0, 1.11, 0], material: skinMat },
      { name: "leftArm", half: [0.06, 0.23, 0.06], local: [-0.27, 0.63, 0], material: skinMat },
      { name: "rightArm", half: [0.06, 0.23, 0.06], local: [0.27, 0.63, 0], material: skinMat },
      { name: "leftLeg", half: [0.075, 0.28, 0.075], local: [-0.11, 0.28, 0], material: pantsMat },
      { name: "rightLeg", half: [0.075, 0.28, 0.075], local: [0.11, 0.28, 0], material: pantsMat },
    ];

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const bodiesByName: Record<string, RAPIER.RigidBody> = {};

    for (const spec of specs) {
      const rx = spec.local[0] * cosY + spec.local[2] * sinY;
      const rz = -spec.local[0] * sinY + spec.local[2] * cosY;
      const worldPos = new THREE.Vector3(feetPos.x + rx, feetPos.y + spec.local[1], feetPos.z + rz);

      // NOT using CCD here: CCD combined with impulse joints is a known-unstable
      // combination in Rapier (and most physics engines) — the CCD time-of-impact
      // correction and the joint solver fight each other, producing violent jitter/
      // explosion instead of a calm ragdoll (confirmed live — see BUG_AUDIT.md "Round 3").
      // Tunneling risk is instead capped by clamping spawn velocity below.
      const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(worldPos.x, worldPos.y, worldPos.z)
        .setLinearDamping(0.5)
        .setAngularDamping(0.7);
      const body = physics.world.createRigidBody(bodyDesc);

      // Clamp the inherited velocity: a very fast bail (e.g. a huge fall) would otherwise
      // hand every bone enough speed to tunnel through thin geometry in one step. Capping
      // it keeps the "flies naturally" feel while staying inside what a normal (non-CCD)
      // timestep can resolve against our ~0.1-0.2-unit-thick colliders.
      const MAX_BONE_SPEED = 14;
      const speed = initialVel.length();
      const clampedVel = speed > MAX_BONE_SPEED ? initialVel.clone().multiplyScalar(MAX_BONE_SPEED / speed) : initialVel;
      body.setLinvel({ x: clampedVel.x, y: clampedVel.y, z: clampedVel.z }, true);

      const colliderDesc = RAPIER.ColliderDesc.cuboid(...spec.half).setDensity(1).setFriction(0.7);
      physics.world.createCollider(colliderDesc, body);

      const geo = faceted(ragdollGeometry(spec));
      const mesh = new THREE.Mesh(geo, spec.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      this.bones.push({ name: spec.name, body, mesh });
      bodiesByName[spec.name] = body;
    }

    const connect = (
      a: string,
      b: string,
      anchorA: [number, number, number],
      anchorB: [number, number, number],
    ) => {
      const params = RAPIER.JointData.spherical(
        { x: anchorA[0], y: anchorA[1], z: anchorA[2] },
        { x: anchorB[0], y: anchorB[1], z: anchorB[2] },
      );
      physics.world.createImpulseJoint(params, bodiesByName[a], bodiesByName[b], true);
    };

    connect("pelvis", "torso", [0, 0.05, 0], [0, -0.16, 0]);
    connect("torso", "head", [0, 0.21, 0], [0, -0.13, 0]);
    connect("torso", "leftArm", [-0.19, 0.09, 0], [0, 0.23, 0]);
    connect("torso", "rightArm", [0.19, 0.09, 0], [0, 0.23, 0]);
    connect("pelvis", "leftLeg", [-0.11, 0, 0], [0, 0.28, 0]);
    connect("pelvis", "rightLeg", [0.11, 0, 0], [0, 0.28, 0]);
  }

  /**
   * Advances the settle/timeout check — call BEFORE physics.step(). Returns true once the
   * ragdoll should be despawned (settled or timed out).
   */
  update(dt: number): boolean {
    this.timer += dt;
    let maxSpeed = 0;
    let exploded = false;
    for (const bone of this.bones) {
      const v = bone.body.linvel();
      const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
      if (!Number.isFinite(speed)) exploded = true;
      if (speed > maxSpeed) maxSpeed = speed;
    }

    // Safety valve: if the joint solver ever does go unstable (NaN/Infinity velocity),
    // force an immediate despawn instead of leaving the player stuck in a broken ragdoll
    // forever — the timeout alone wouldn't save us here since a "settled" check against
    // NaN never resolves true or false, it just silently never settles.
    if (exploded) return true;

    this.settleFrameCount = maxSpeed < RAGDOLL.settleVelocityThreshold ? this.settleFrameCount + 1 : 0;
    return this.settleFrameCount >= RAGDOLL.settleFrames || this.timer >= RAGDOLL.timeoutSeconds;
  }

  /** Syncs bone meshes from physics — call AFTER physics.step() for jitter-free visuals. */
  syncVisuals(): void {
    for (const bone of this.bones) {
      const t = bone.body.translation();
      const r = bone.body.rotation();
      bone.mesh.position.set(t.x, t.y, t.z);
      bone.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  get pelvisPosition(): THREE.Vector3 {
    const pelvis = this.bones.find((b) => b.name === "pelvis")!;
    const t = pelvis.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  destroy(): void {
    for (const bone of this.bones) {
      this.scene.remove(bone.mesh);
      bone.mesh.geometry.dispose();
      (bone.mesh.material as THREE.Material).dispose();
      this.physics.world.removeRigidBody(bone.body);
    }
    this.bones = [];
  }
}
