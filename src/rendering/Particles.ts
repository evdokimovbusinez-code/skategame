import * as THREE from "three";

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
}

const POOL_SIZE = 64;

/**
 * PS2-style particle system: a fixed pool of tiny unlit quads, no textures, no shaders.
 * Cheap enough to leave running every frame; capped so it can never grow unbounded.
 */
export class ParticleSystem {
  private pool: Particle[] = [];
  private active: Particle[] = [];
  private sparkMaterial: THREE.MeshBasicMaterial;
  private dustMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene) {
    this.sparkMaterial = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true });
    this.dustMaterial = new THREE.MeshBasicMaterial({ color: 0xb0a493, transparent: true });

    const geo = new THREE.PlaneGeometry(0.09, 0.09);
    for (let i = 0; i < POOL_SIZE; i++) {
      // Each particle owns a material clone so per-particle opacity fade doesn't bleed
      // across the pool (a shared material would flicker every particle at once).
      const mesh = new THREE.Mesh(geo, this.sparkMaterial.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({ mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 0 });
    }
  }

  private spawn(
    position: THREE.Vector3,
    baseVel: THREE.Vector3,
    spread: number,
    life: number,
    material: THREE.Material,
    scale: number,
    gravity: number,
  ): void {
    const p = this.pool.pop();
    if (!p) return; // pool exhausted — drop the particle, never allocate more
    (p.mesh.material as THREE.MeshBasicMaterial).color.copy((material as THREE.MeshBasicMaterial).color);
    (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
    p.mesh.position.copy(position);
    p.mesh.scale.setScalar(scale);
    p.mesh.visible = true;
    p.velocity
      .copy(baseVel)
      .add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread, (Math.random() - 0.5) * spread));
    p.life = life;
    p.maxLife = life;
    p.gravity = gravity;
    this.active.push(p);
  }

  /** Short-lived hot sparks kicked backwards from a grind contact point. */
  emitSparks(position: THREE.Vector3, backward: THREE.Vector3): void {
    for (let i = 0; i < 2; i++) {
      this.spawn(position, backward.clone().multiplyScalar(1.5), 1.6, 0.3 + Math.random() * 0.2, this.sparkMaterial, 0.7 + Math.random() * 0.6, -14);
    }
  }

  /** Dust puff for crashes/hard landings. */
  emitDust(position: THREE.Vector3, count = 10): void {
    for (let i = 0; i < count; i++) {
      this.spawn(position, new THREE.Vector3(0, 1.2, 0), 2.2, 0.5 + Math.random() * 0.4, this.dustMaterial, 1.4 + Math.random() * 1.2, -2.5);
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      p.velocity.y += p.gravity * dt;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.quaternion.copy(camera.quaternion); // billboard toward camera
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = p.life / p.maxLife;
    }
  }
}
