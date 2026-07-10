import * as THREE from "three";
import { ps2Material, faceted } from "../rendering/ps2Materials";

export type LootDropPayload =
  | { type: "money"; amount: number }
  | { type: "item"; id: string; name: string; quantity?: number };

export interface LootDropReward {
  drop: LootDrop;
  payload: LootDropPayload;
  position: THREE.Vector3;
}

export type LootDropCollectCallback = (reward: LootDropReward) => void;

export interface LootDropOptions {
  position: THREE.Vector3;
  payload: LootDropPayload;
  collectRadius?: number;
  magnetRadius?: number;
  magnetSpeed?: number;
  lifeSeconds?: number;
  onCollect?: LootDropCollectCallback;
}

export interface MoneyDropOptions {
  position: THREE.Vector3;
  amount: number;
  collectRadius?: number;
  magnetRadius?: number;
  magnetSpeed?: number;
  lifeSeconds?: number;
  onCollect?: LootDropCollectCallback;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(faceted(geometry), material);
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function labelTexture(text: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(8, 8, 10, 0.7)";
  ctx.fillRect(18, 14, 156, 36);
  ctx.strokeStyle = "#d8d0c5";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 14, 156, 36);
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text.toUpperCase(), 96, 33);

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildMoneyMesh(amount: number): THREE.Group {
  const group = new THREE.Group();
  const coinMat = ps2Material(0xd8b44a, { emissive: 0x4b3710, emissiveIntensity: 0.12 });
  const billMat = ps2Material(0x5f9a55);
  const bandMat = ps2Material(0xf0e3b2);
  const coinGeo = faceted(new THREE.CylinderGeometry(0.11, 0.11, 0.026, 10));
  const coinCount = THREE.MathUtils.clamp(Math.ceil(amount / 6), 2, 7);

  for (let i = 0; i < coinCount; i++) {
    const coin = new THREE.Mesh(coinGeo.clone(), coinMat);
    coin.position.set((i % 2) * 0.035 - 0.02, 0.03 + i * 0.025, (i % 3) * 0.02 - 0.02);
    coin.rotation.y = i * 0.6;
    coin.castShadow = true;
    coin.receiveShadow = true;
    group.add(coin);
  }

  const bill = mesh(new THREE.BoxGeometry(0.28, 0.018, 0.16), billMat, [0, 0.08 + coinCount * 0.016, 0]);
  bill.rotation.y = -0.45;
  const band = mesh(new THREE.BoxGeometry(0.055, 0.023, 0.18), bandMat, [0, 0.095 + coinCount * 0.016, 0]);
  band.rotation.y = bill.rotation.y;
  group.add(bill, band);
  return group;
}

function buildItemMesh(payload: Extract<LootDropPayload, { type: "item" }>): THREE.Group {
  const group = new THREE.Group();
  const crateMat = ps2Material(0x31465f);
  const trimMat = ps2Material(0xd8d0c5);
  const accentMat = ps2Material(0xd95745, { emissive: 0x4b1210, emissiveIntensity: 0.1 });
  const quantity = payload.quantity ?? 1;

  group.add(mesh(new THREE.BoxGeometry(0.34, 0.24, 0.3), crateMat, [0, 0.16, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.38, 0.05, 0.34), trimMat, [0, 0.31, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.38, 0.045, 0.34), trimMat, [0, 0.035, 0]));
  group.add(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.035), accentMat, [0, 0.17, 0.17]));
  if (quantity > 1) {
    const tickMat = ps2Material(0xffd23e, { emissive: 0x5a4210, emissiveIntensity: 0.15 });
    group.add(mesh(new THREE.BoxGeometry(0.12, 0.05, 0.04), tickMat, [0.13, 0.28, 0.18]));
  }
  return group;
}

function buildLabel(payload: LootDropPayload): { sprite: THREE.Sprite; texture: THREE.CanvasTexture; material: THREE.SpriteMaterial } {
  const text = payload.type === "money" ? `$${payload.amount}` : payload.quantity && payload.quantity > 1 ? `${payload.name} x${payload.quantity}` : payload.name;
  const color = payload.type === "money" ? "#ffd23e" : "#9fd7ff";
  const texture = labelTexture(text, color);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, 0.76, 0);
  sprite.scale.set(0.95, 0.32, 1);
  return { sprite, texture, material };
}

export class LootDrop {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly payload: LootDropPayload;

  private readonly collectRadius: number;
  private readonly magnetRadius: number;
  private readonly magnetSpeed: number;
  private readonly lifeSeconds: number;
  private readonly onCollect?: LootDropCollectCallback;
  private readonly label: THREE.Sprite;
  private readonly labelMap: THREE.CanvasTexture;
  private readonly labelMaterial: THREE.SpriteMaterial;
  private readonly toPlayer = new THREE.Vector3();
  private readonly startY: number;

  private age = 0;
  private collected = false;
  private expired = false;
  private spinSpeed = 2.6 + Math.random() * 1.4;
  private phase = Math.random() * Math.PI * 2;

  constructor(scene: THREE.Scene, options: LootDropOptions) {
    this.payload = options.payload;
    this.collectRadius = options.collectRadius ?? 0.85;
    this.magnetRadius = options.magnetRadius ?? 2.2;
    this.magnetSpeed = options.magnetSpeed ?? 4.5;
    this.lifeSeconds = options.lifeSeconds ?? 0;
    this.onCollect = options.onCollect;

    this.group = new THREE.Group();
    this.position = this.group.position;
    this.position.copy(options.position);
    this.startY = options.position.y;
    this.group.userData.entity = this;

    const visual = this.payload.type === "money" ? buildMoneyMesh(this.payload.amount) : buildItemMesh(this.payload);
    this.group.add(visual);

    const label = buildLabel(this.payload);
    this.label = label.sprite;
    this.labelMap = label.texture;
    this.labelMaterial = label.material;
    this.group.add(this.label);

    scene.add(this.group);
  }

  get isCollected(): boolean {
    return this.collected;
  }

  get isExpired(): boolean {
    return this.expired;
  }

  update(delta: number, playerPos?: THREE.Vector3): void {
    if (this.collected || this.expired) return;

    const dt = Math.min(delta, 0.05);
    this.age += dt;
    if (this.lifeSeconds > 0 && this.age >= this.lifeSeconds) {
      this.expire();
      return;
    }

    this.phase += dt * 4;
    this.group.rotation.y += dt * this.spinSpeed;
    this.position.y = this.startY + Math.sin(this.phase) * 0.08;
    this.label.position.y = 0.76 + Math.sin(this.phase + 1.4) * 0.035;

    if (playerPos) this.applyMagnet(dt, playerPos);
  }

  collect(playerPos: THREE.Vector3): LootDropReward | null {
    if (this.collected || this.expired) return null;
    if (this.position.distanceToSquared(playerPos) > this.collectRadius * this.collectRadius) return null;

    this.collected = true;
    this.removeFromParent();
    const reward: LootDropReward = {
      drop: this,
      payload: this.payload,
      position: this.position.clone(),
    };
    this.onCollect?.(reward);
    return reward;
  }

  removeFromParent(): void {
    this.group.parent?.remove(this.group);
  }

  dispose(): void {
    this.removeFromParent();
    this.labelMap.dispose();
    this.labelMaterial.dispose();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }

  private applyMagnet(dt: number, playerPos: THREE.Vector3): void {
    this.toPlayer.subVectors(playerPos, this.position);
    const distSq = this.toPlayer.lengthSq();
    if (distSq <= this.collectRadius * this.collectRadius || distSq > this.magnetRadius * this.magnetRadius) return;

    const distance = Math.sqrt(distSq);
    this.toPlayer.multiplyScalar(1 / distance);
    const pull = (1 - distance / this.magnetRadius) * this.magnetSpeed;
    this.position.addScaledVector(this.toPlayer, pull * dt);
  }

  private expire(): void {
    this.expired = true;
    this.removeFromParent();
  }
}

export class MoneyDrop extends LootDrop {
  constructor(scene: THREE.Scene, options: MoneyDropOptions) {
    super(scene, {
      position: options.position,
      payload: { type: "money", amount: Math.max(0, Math.round(options.amount)) },
      collectRadius: options.collectRadius,
      magnetRadius: options.magnetRadius,
      magnetSpeed: options.magnetSpeed,
      lifeSeconds: options.lifeSeconds,
      onCollect: options.onCollect,
    });
  }
}
