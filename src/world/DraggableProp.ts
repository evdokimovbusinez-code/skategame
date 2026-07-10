import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { DRAG } from "../config/constants";
import { buildDumpster, buildCrate, buildPallet } from "./geometry/props";

/**
 * A physics prop the player can grab and drag around on foot — "hands latch on and you
 * pull" per the request. Starts as a normal dynamic body (skates/bumps into it like any
 * other prop); grabbing swaps it to kinematic and has it follow a fixed offset from the
 * player, so it moves exactly with you instead of getting shoved around or lagging behind
 * with spring-joint jitter. Releasing hands it back to gravity/collision.
 */
export class DraggableProp {
  readonly mesh: THREE.Group;
  readonly body: RAPIER.RigidBody;
  readonly grabRadius: number;

  private grabbed = false;
  private followOffset = new THREE.Vector3();
  private restY = 0;

  constructor(mesh: THREE.Group, body: RAPIER.RigidBody, grabRadius = DRAG.grabRadius) {
    this.mesh = mesh;
    this.body = body;
    this.grabRadius = grabRadius;
  }

  get isGrabbed(): boolean {
    return this.grabbed;
  }

  isNearby(playerPos: THREE.Vector3): boolean {
    const t = this.body.translation();
    return playerPos.distanceTo(new THREE.Vector3(t.x, t.y, t.z)) <= this.grabRadius;
  }

  grab(playerPos: THREE.Vector3): void {
    const t = this.body.translation();
    this.followOffset.set(t.x - playerPos.x, 0, t.z - playerPos.z);
    this.restY = t.y;
    this.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.grabbed = true;
  }

  release(): void {
    this.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.grabbed = false;
  }

  /** Call every frame while grabbed instead of leaving it to physics. Height is locked to
   * where it rested at grab-time — dragging is horizontal only, so it can't be floated
   * into the air by jumping mid-drag or dropped through the floor on uneven ground. */
  update(playerPos: THREE.Vector3, dt: number): void {
    if (!this.grabbed) return;
    const t = this.body.translation();
    const targetX = playerPos.x + this.followOffset.x;
    const targetZ = playerPos.z + this.followOffset.z;
    const rate = Math.min(1, DRAG.followSmoothing * dt);
    this.body.setNextKinematicTranslation({
      x: t.x + (targetX - t.x) * rate,
      y: this.restY,
      z: t.z + (targetZ - t.z) * rate,
    });
  }

  /** Copies the physics transform onto the visual mesh — call once per frame regardless
   * of grab state, since even resting props are now real dynamic bodies that can be
   * bumped by the skater instead of static world geometry. */
  syncVisual(): void {
    const t = this.body.translation();
    const r = this.body.rotation();
    this.mesh.position.set(t.x, t.y, t.z);
    this.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  }
}

function makeDraggable(
  scene: THREE.Scene,
  world: RAPIER.World,
  mesh: THREE.Group,
  position: THREE.Vector3,
  rotY: number,
  halfExtents: [number, number, number],
  localCenterY: number,
  grabRadius: number,
  density: number,
): DraggableProp {
  scene.add(mesh);

  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    // High damping: while grabbed the body is kinematic (damping doesn't apply), but the
    // instant it's dropped or bumped this is what keeps a stray interpenetration-recovery
    // impulse (e.g. dragged slightly into a wall, then released — kinematic bodies ignore
    // collisions, so that's possible) from reading as the object flying off under its own
    // power instead of just settling.
    .setLinearDamping(8)
    .setAngularDamping(10)
    .lockRotations(); // stays upright — dragging shouldn't tip it over
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(...halfExtents)
    .setTranslation(0, localCenterY, 0)
    .setFriction(1.8)
    .setRestitution(0) // no bounce — a bump should thud, not launch it
    .setDensity(density);
  world.createCollider(colliderDesc, body);

  const prop = new DraggableProp(mesh, body, grabRadius);
  prop.syncVisual();
  return prop;
}

/** buildDumpster's own collider is baked to world space (fine for a static prop, wrong
 * for a moving body) — build the mesh at the origin and drive it from a real body instead.
 * Density is a loaded steel bin's worth (heavy enough that a skate bump barely nudges it,
 * not "floats away" — that was the actual complaint: too light to read as having mass). */
export function makeDraggableDumpster(
  scene: THREE.Scene,
  world: RAPIER.World,
  position: THREE.Vector3,
  rotY: number,
): DraggableProp {
  const { group } = buildDumpster([0, 0, 0], 0);
  return makeDraggable(scene, world, group, position, rotY, [0.87, 0.75, 0.52], 0.75, DRAG.grabRadius, 35);
}

export function makeDraggableCrate(
  scene: THREE.Scene,
  world: RAPIER.World,
  position: THREE.Vector3,
  rotY: number,
): DraggableProp {
  const { group } = buildCrate([0, 0, 0], 0);
  const s = 0.55 / 2;
  return makeDraggable(scene, world, group, position, rotY, [s, s, s], s, DRAG.grabRadius * 0.75, 8);
}

export function makeDraggablePallet(
  scene: THREE.Scene,
  world: RAPIER.World,
  position: THREE.Vector3,
  rotY: number,
): DraggableProp {
  const { group } = buildPallet([0, 0, 0], 0);
  return makeDraggable(scene, world, group, position, rotY, [0.55, 0.09, 0.55], 0.09, DRAG.grabRadius * 0.75, 6);
}
