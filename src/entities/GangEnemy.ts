import * as THREE from "three";
import { ps2Material, faceted } from "../rendering/ps2Materials";
import { applyAccessory } from "./Player/Accessories";
import type { Accessory } from "./Player/Accessories";
import { Animator } from "./Player/Animator";
import { buildHumanoidRig } from "./Player/HumanoidRig";
import type { HumanoidBones, RigColors } from "./Player/HumanoidRig";

export type GangEnemyState = "idle" | "chasing" | "returning" | "staggered" | "defeated";
export type GangEnemyAccessory = Accessory;

export interface GangEnemyLootEntry {
  id: string;
  name: string;
  chance?: number;
  amount?: number;
}

export interface GangEnemyDefeatedEvent {
  enemy: GangEnemy;
  position: THREE.Vector3;
  attackerPos: THREE.Vector3;
  rewardMoney: number;
  lootTable: GangEnemyLootEntry[];
}

export type GangEnemyDefeatedCallback = (event: GangEnemyDefeatedEvent) => void;

export interface GangEnemyOptions {
  position: THREE.Vector3;
  name?: string;
  gangName?: string;
  facingYaw?: number;
  colors?: RigColors;
  accessory?: GangEnemyAccessory | GangEnemyAccessory[];
  maxHealth?: number;
  moveSpeed?: number;
  aggroRange?: number;
  leashRange?: number;
  stopDistance?: number;
  attackRange?: number;
  hitKnockback?: number;
  rewardMoney?: number;
  lootTable?: GangEnemyLootEntry[];
  hideOnDefeat?: boolean;
  onDefeated?: GangEnemyDefeatedCallback;
}

const DEFAULT_COLORS: RigColors = {
  skin: 0xc98f5f,
  shirt: 0x611d2a,
  sleeves: 0x3b111a,
  pants: 0x20232b,
  shoes: 0xd8d4c8,
};

const DEFAULT_ACCESSORIES: GangEnemyAccessory[] = ["mohawk", "vest"];
const HEALTH_BAR_WIDTH = 184;
const HEALTH_BAR_HEIGHT = 14;

function clamp01(value: number): number {
  return THREE.MathUtils.clamp(value, 0, 1);
}

function flatDistanceSquared(a: THREE.Vector3, b: THREE.Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function dampAngle(current: number, target: number, strength: number, dt: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * Math.min(1, strength * dt);
}

function makeBillboardTexture(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; texture: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, context, texture };
}

function makeShadowMesh(): THREE.Mesh {
  const geometry = faceted(new THREE.CircleGeometry(0.5, 10));
  const material = ps2Material(0x101010, {
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.receiveShadow = true;
  return shadow;
}

function makeEnemyTag(): THREE.Group {
  const group = new THREE.Group();
  const mat = ps2Material(0xf0d060, { emissive: 0x5a4210, emissiveIntensity: 0.2 });
  const postMat = ps2Material(0x111111);
  const tag = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.18, 0.09, 0.025)), mat);
  tag.position.set(0, 0.46, 0.17);
  tag.castShadow = true;
  const slash = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.025, 0.12, 0.03)), postMat);
  slash.position.set(0, 0.46, 0.19);
  slash.rotation.z = -0.55;
  slash.castShadow = true;
  group.add(tag, slash);
  return group;
}

export class GangEnemy {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly name: string;
  readonly gangName: string;
  readonly maxHealth: number;
  readonly rewardMoney: number;

  state: GangEnemyState = "idle";
  health: number;

  private readonly bones: HumanoidBones;
  private readonly animator = new Animator();
  private readonly homePosition: THREE.Vector3;
  private readonly moveDir = new THREE.Vector3();
  private readonly toTarget = new THREE.Vector3();
  private readonly knockVelocity = new THREE.Vector3();
  private readonly bodyMaterials: THREE.MeshLambertMaterial[] = [];
  private readonly lootTable: GangEnemyLootEntry[];
  private readonly moveSpeed: number;
  private readonly aggroRange: number;
  private readonly leashRange: number;
  private readonly stopDistance: number;
  private readonly attackRange: number;
  private readonly hitKnockback: number;
  private readonly hideOnDefeat: boolean;
  private readonly onDefeated?: GangEnemyDefeatedCallback;
  private readonly plateCanvas: HTMLCanvasElement;
  private readonly plateContext: CanvasRenderingContext2D;
  private readonly plateTexture: THREE.CanvasTexture;
  private readonly plateMaterial: THREE.SpriteMaterial;
  private readonly namePlate: THREE.Sprite;

  private phase = Math.random() * Math.PI * 2;
  private staggerTimer = 0;
  private hitFlashTimer = 0;
  private flashVisible = false;
  private lastPlayerDistance = Infinity;

  constructor(scene: THREE.Scene, options: GangEnemyOptions) {
    this.name = options.name ?? "Rival Skater";
    this.gangName = options.gangName ?? "RIVAL GANG";
    this.maxHealth = Math.max(1, options.maxHealth ?? 60);
    this.health = this.maxHealth;
    this.moveSpeed = options.moveSpeed ?? 2.4;
    this.aggroRange = options.aggroRange ?? 9;
    this.leashRange = options.leashRange ?? 16;
    this.stopDistance = options.stopDistance ?? 1.05;
    this.attackRange = options.attackRange ?? 1.2;
    this.hitKnockback = options.hitKnockback ?? 2.8;
    this.rewardMoney = Math.max(0, Math.round(options.rewardMoney ?? 12));
    this.lootTable = options.lootTable?.map((entry) => ({ ...entry })) ?? [];
    this.hideOnDefeat = options.hideOnDefeat ?? true;
    this.onDefeated = options.onDefeated;

    const rig = buildHumanoidRig(options.colors ?? DEFAULT_COLORS);
    this.group = rig.group;
    this.bones = rig.bones;
    this.position = this.group.position;
    this.position.copy(options.position);
    this.homePosition = options.position.clone();
    this.group.rotation.y = options.facingYaw ?? 0;
    this.group.userData.entity = this;

    const accessories = options.accessory ?? DEFAULT_ACCESSORIES;
    for (const accessory of Array.isArray(accessories) ? accessories : [accessories]) {
      applyAccessory(this.bones, accessory);
    }
    this.bones.spine.add(makeEnemyTag());
    this.group.add(makeShadowMesh());

    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof THREE.MeshLambertMaterial) this.bodyMaterials.push(material);
      }
    });

    const billboard = makeBillboardTexture(256, 88);
    this.plateCanvas = billboard.canvas;
    this.plateContext = billboard.context;
    this.plateTexture = billboard.texture;
    this.plateMaterial = new THREE.SpriteMaterial({
      map: this.plateTexture,
      transparent: true,
      depthWrite: false,
    });
    this.namePlate = new THREE.Sprite(this.plateMaterial);
    this.namePlate.position.set(0, 2.05, 0);
    this.namePlate.scale.set(1.25, 0.43, 1);
    this.group.add(this.namePlate);
    this.refreshNamePlate();

    scene.add(this.group);
  }

  get isDefeated(): boolean {
    return this.state === "defeated";
  }

  get healthFrac(): number {
    return this.health / this.maxHealth;
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    const dt = Math.min(delta, 0.05);
    this.phase += dt;
    this.hitFlashTimer = Math.max(0, this.hitFlashTimer - dt);
    this.updateHitFlash();

    if (this.isDefeated) return;

    const playerDistSq = flatDistanceSquared(this.position, playerPos);
    this.lastPlayerDistance = Math.sqrt(playerDistSq);
    this.staggerTimer = Math.max(0, this.staggerTimer - dt);

    let speedFrac = 0;
    if (this.staggerTimer > 0) {
      this.state = "staggered";
    } else {
      speedFrac = this.updateNavigation(dt, playerPos, playerDistSq);
    }

    this.applyKnockback(dt);
    this.animator.update(this.bones, dt, { speedFrac, grounded: true });
    this.namePlate.position.y = 2.05 + Math.sin(this.phase * 2.2) * 0.035;
  }

  takeHit(damage: number, attackerPos: THREE.Vector3): boolean {
    if (this.isDefeated) return true;

    const cleanDamage = Math.max(0, damage);
    if (cleanDamage <= 0) return false;

    this.health = Math.max(0, this.health - cleanDamage);
    this.staggerTimer = 0.22;
    this.hitFlashTimer = 0.12;

    this.moveDir.subVectors(this.position, attackerPos);
    this.moveDir.y = 0;
    if (this.moveDir.lengthSq() > 0.0001) {
      this.moveDir.normalize();
      this.knockVelocity.addScaledVector(this.moveDir, this.hitKnockback);
    }

    this.refreshNamePlate();
    if (this.health <= 0) this.defeat(attackerPos);
    return this.isDefeated;
  }

  isPlayerInAttackRange(): boolean {
    return !this.isDefeated && this.lastPlayerDistance <= this.attackRange;
  }

  removeFromParent(): void {
    this.group.parent?.remove(this.group);
  }

  dispose(): void {
    this.removeFromParent();
    this.plateTexture.dispose();
    this.plateMaterial.dispose();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }

  private updateNavigation(dt: number, playerPos: THREE.Vector3, playerDistSq: number): number {
    const aggroRangeSq = this.aggroRange * this.aggroRange;
    const leashRangeSq = this.leashRange * this.leashRange;
    const stopDistanceSq = this.stopDistance * this.stopDistance;
    const homeDistSq = flatDistanceSquared(this.position, this.homePosition);
    const shouldChase =
      (this.state === "chasing" && playerDistSq <= leashRangeSq && homeDistSq <= leashRangeSq) ||
      (playerDistSq <= aggroRangeSq && homeDistSq <= leashRangeSq);

    if (shouldChase) {
      this.state = "chasing";
      if (playerDistSq > stopDistanceSq) return this.moveToward(playerPos, dt, 1);
      this.faceToward(playerPos, dt);
      return 0;
    }

    if (homeDistSq > 0.08 * 0.08) {
      this.state = "returning";
      return this.moveToward(this.homePosition, dt, 0.75);
    }

    this.state = "idle";
    return 0;
  }

  private moveToward(target: THREE.Vector3, dt: number, speedScale: number): number {
    this.toTarget.subVectors(target, this.position);
    this.toTarget.y = 0;
    const distance = this.toTarget.length();
    if (distance <= 0.001) return 0;

    this.moveDir.copy(this.toTarget).multiplyScalar(1 / distance);
    this.position.addScaledVector(this.moveDir, Math.min(distance, this.moveSpeed * speedScale * dt));
    const yaw = Math.atan2(this.moveDir.x, this.moveDir.z);
    this.group.rotation.y = dampAngle(this.group.rotation.y, yaw, 12, dt);
    return clamp01(speedScale);
  }

  private faceToward(target: THREE.Vector3, dt: number): void {
    this.toTarget.subVectors(target, this.position);
    this.toTarget.y = 0;
    if (this.toTarget.lengthSq() <= 0.0001) return;
    const yaw = Math.atan2(this.toTarget.x, this.toTarget.z);
    this.group.rotation.y = dampAngle(this.group.rotation.y, yaw, 10, dt);
  }

  private applyKnockback(dt: number): void {
    if (this.knockVelocity.lengthSq() <= 0.0001) {
      this.knockVelocity.set(0, 0, 0);
      return;
    }
    this.position.addScaledVector(this.knockVelocity, dt);
    this.knockVelocity.multiplyScalar(Math.exp(-9 * dt));
    this.position.y = this.homePosition.y;
  }

  private defeat(attackerPos: THREE.Vector3): void {
    this.state = "defeated";
    this.health = 0;
    this.knockVelocity.set(0, 0, 0);
    this.namePlate.visible = false;
    this.updateHitFlash();
    if (this.hideOnDefeat) this.group.visible = false;
    this.onDefeated?.({
      enemy: this,
      position: this.position.clone(),
      attackerPos: attackerPos.clone(),
      rewardMoney: this.rewardMoney,
      lootTable: this.lootTable.map((entry) => ({ ...entry })),
    });
  }

  private refreshNamePlate(): void {
    const ctx = this.plateContext;
    const healthFrac = clamp01(this.healthFrac);
    ctx.clearRect(0, 0, this.plateCanvas.width, this.plateCanvas.height);

    ctx.fillStyle = "rgba(12, 12, 14, 0.82)";
    ctx.fillRect(16, 8, 224, 66);
    ctx.strokeStyle = "#d8d0c5";
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 8, 224, 66);

    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f0e6d2";
    ctx.fillText(this.name.toUpperCase(), 128, 24);

    ctx.font = "bold 10px monospace";
    ctx.fillStyle = "#d05a46";
    ctx.fillText(this.gangName.toUpperCase(), 128, 40);

    const barX = 36;
    const barY = 54;
    ctx.fillStyle = "#1a1718";
    ctx.fillRect(barX, barY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);
    ctx.fillStyle = healthFrac > 0.5 ? "#7fc36a" : healthFrac > 0.25 ? "#ffd23e" : "#d95745";
    ctx.fillRect(barX, barY, Math.max(2, HEALTH_BAR_WIDTH * healthFrac), HEALTH_BAR_HEIGHT);
    ctx.strokeStyle = "#080808";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT);

    this.plateTexture.needsUpdate = true;
  }

  private updateHitFlash(): void {
    const shouldFlash = this.hitFlashTimer > 0 && !this.isDefeated;
    if (shouldFlash === this.flashVisible) return;
    this.flashVisible = shouldFlash;
    for (const material of this.bodyMaterials) {
      material.emissive.setHex(shouldFlash ? 0x8a2018 : 0x000000);
    }
  }
}
