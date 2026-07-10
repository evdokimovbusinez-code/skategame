import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { PHYSICS } from "../config/constants";

export type BodyMeshPair = { body: RAPIER.RigidBody; mesh: THREE.Object3D; offset?: THREE.Vector3 };

export class PhysicsWorld {
  world!: RAPIER.World;
  private accumulator = 0;
  private synced: BodyMeshPair[] = [];
  private debugLines: THREE.LineSegments | null = null;

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const instance = new PhysicsWorld();
    instance.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    return instance;
  }

  /** Register a body/mesh pair to be synced every frame after the physics step. */
  registerSync(pair: BodyMeshPair): void {
    this.synced.push(pair);
  }

  unregisterSync(body: RAPIER.RigidBody): void {
    this.synced = this.synced.filter((p) => p.body !== body);
  }

  step(dt: number): void {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= PHYSICS.fixedTimeStep && steps < PHYSICS.maxSubSteps) {
      this.world.timestep = PHYSICS.fixedTimeStep;
      this.world.step();
      this.accumulator -= PHYSICS.fixedTimeStep;
      steps++;
    }
    this.syncBodiesToMeshes();
  }

  private syncBodiesToMeshes(): void {
    for (const { body, mesh } of this.synced) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Toggleable wireframe visualization of all colliders, useful for M1+ QA. */
  toggleDebugRender(scene: THREE.Scene, enabled: boolean): void {
    if (this.debugLines) {
      scene.remove(this.debugLines);
      this.debugLines.geometry.dispose();
      (this.debugLines.material as THREE.Material).dispose();
      this.debugLines = null;
    }
    if (!enabled) return;
    const buffers = this.world.debugRender();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(buffers.vertices, 3));
    const material = new THREE.LineBasicMaterial({ vertexColors: false, color: 0x00ff88 });
    this.debugLines = new THREE.LineSegments(geometry, material);
    scene.add(this.debugLines);
  }

  updateDebugRender(): void {
    if (!this.debugLines) return;
    const buffers = this.world.debugRender();
    this.debugLines.geometry.setAttribute("position", new THREE.BufferAttribute(buffers.vertices, 3));
  }
}

export { RAPIER };
