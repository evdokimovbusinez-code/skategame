import * as THREE from "three";
import { ps2Material, faceted } from "../../rendering/ps2Materials";
import type { HUD } from "../../ui/HUD";
import type { Inventory } from "../../rpg/Inventory";

interface TapeSpot {
  itemId: string;
  position: THREE.Vector3;
}

/**
 * Dante's collectathon: three camcorder tapes hidden around the district — one on the shop roof
 * (mantle up the crates), one on the funbox platform, one in the fenced abandoned lot.
 * Tapes spin/bob like classic collectibles and are grabbed by proximity.
 */
export class VhsCollectionMission {
  active = false;

  private tapes: { spot: TapeSpot; mesh: THREE.Group; collected: boolean }[] = [];
  private hud: HUD;
  private inventory: Inventory;
  private onAllCollected: (() => void) | null = null;
  private phase = 0;

  constructor(scene: THREE.Scene, hud: HUD, inventory: Inventory, spots: TapeSpot[]) {
    this.hud = hud;
    this.inventory = inventory;

    const bodyMat = ps2Material(0x1c1c1c);
    const labelMat = ps2Material(0xe8e2d0);
    for (const spot of spots) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.36, 0.06, 0.2)), bodyMat);
      const label = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.2, 0.065, 0.12)), labelMat);
      label.position.x = -0.03;
      group.add(body, label);
      group.position.copy(spot.position);
      group.visible = false;
      group.traverse((o) => (o.castShadow = true));
      scene.add(group);
      this.tapes.push({ spot, mesh: group, collected: false });
    }
  }

  start(onAllCollected: () => void): void {
    this.active = true;
    this.onAllCollected = onAllCollected;
    for (const tape of this.tapes) {
      tape.collected = this.inventory.has(tape.spot.itemId);
      tape.mesh.visible = !tape.collected;
    }
    this.updateTracker();
  }

  get collectedCount(): number {
    return this.tapes.filter((t) => t.collected).length;
  }

  private updateTracker(): void {
    this.hud.showObjective("Missing Footage", `Tapes found: ${this.collectedCount} / ${this.tapes.length} — check rooftops and landmarks`);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.active) return;
    this.phase += dt;

    for (const tape of this.tapes) {
      if (tape.collected) continue;
      tape.mesh.rotation.y += dt * 2.2;
      tape.mesh.position.y = tape.spot.position.y + Math.sin(this.phase * 2 + tape.spot.position.x) * 0.08;

      if (playerPos.distanceTo(tape.mesh.position) < 1.1) {
        tape.collected = true;
        tape.mesh.visible = false;
        this.inventory.add(tape.spot.itemId);
        this.hud.toast(`Found a tape! (${this.collectedCount}/${this.tapes.length})`, "success");
        if (this.collectedCount === this.tapes.length) {
          this.active = false;
          this.hud.hideObjective();
          this.hud.toast("All tapes found — bring them to Dante", "success");
          const cb = this.onAllCollected;
          this.onAllCollected = null;
          cb?.();
        } else {
          this.updateTracker();
        }
      }
    }
  }
}
