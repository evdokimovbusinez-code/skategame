import * as THREE from "three";

export type MarkerKind = "available" | "locked" | "turnin" | "none";

function markerTexture(glyph: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "bold 52px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.strokeText(glyph, 32, 36);
  ctx.fillStyle = color;
  ctx.fillText(glyph, 32, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One texture per kind, shared across every marker instance.
let textures: Record<Exclude<MarkerKind, "none">, THREE.CanvasTexture> | null = null;
function sharedTextures() {
  if (!textures) {
    textures = {
      available: markerTexture("!", "#ffd23e"),
      locked: markerTexture("…", "#9aa0a6"),
      turnin: markerTexture("?", "#8fd98a"),
    };
  }
  return textures;
}

/**
 * Classic RPG quest marker floating over an NPC's head: yellow "!" = quest available,
 * gray "…" = locked (come back later / rep too low), green "?" = ready to turn in.
 * Sprite = automatic billboard; bob+pulse handled in update().
 */
export class QuestMarker {
  private sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private kind: MarkerKind = "none";
  private phase = Math.random() * Math.PI * 2;
  private baseY: number;

  constructor(parent: THREE.Object3D, height = 2.05) {
    this.baseY = height;
    this.material = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.setScalar(0.5);
    this.sprite.position.set(0, height, 0);
    this.sprite.visible = false;
    parent.add(this.sprite);
  }

  setKind(kind: MarkerKind): void {
    if (kind === this.kind) return;
    this.kind = kind;
    if (kind === "none") {
      this.sprite.visible = false;
      return;
    }
    this.material.map = sharedTextures()[kind];
    this.material.needsUpdate = true;
    this.sprite.visible = true;
  }

  update(dt: number): void {
    if (!this.sprite.visible) return;
    this.phase += dt * 2.4;
    this.sprite.position.y = this.baseY + Math.sin(this.phase) * 0.07;
    const pulse = this.kind === "available" ? 0.5 + Math.sin(this.phase * 1.7) * 0.05 : 0.5;
    this.sprite.scale.setScalar(pulse);
  }
}
