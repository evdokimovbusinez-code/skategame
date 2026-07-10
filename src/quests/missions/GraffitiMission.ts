import * as THREE from "three";
import type { InputManager } from "../../core/InputManager";
import type { HUD } from "../../ui/HUD";
import type { QuestSystem } from "../QuestSystem";
import type { QuestDef } from "../QuestData";
import type { LevelHandles } from "../../world/Level";
import { TriggerZone } from "../../world/TriggerZone";
import { sharedMaterials } from "../../rendering/ps2Materials";
import { gameEvents } from "../../core/GameEvents";

export const GRAFFITI_QUEST: QuestDef = {
  id: "graffiti",
  title: "Back Alley Poster",
  objectives: [{ id: "tag_wall", description: "Hold E at the alley wall to spray the Homecoming Jam mark" }],
};

const HOLD_DURATION = 2.2;
const DECAY_RATE = 2; // releasing E drains progress faster than holding fills it

/** Hold-to-fill minigame: hold E near the marked wall to spray a tag, then swap in a decal. */
export class GraffitiMission {
  private zone: TriggerZone;
  private decal: THREE.Mesh;
  private active = false;
  private holdProgress = 0;
  private wasSpraying = false;

  constructor(scene: THREE.Scene, level: LevelHandles) {
    this.zone = new TriggerZone(level.graffitiWall.position, 2.2);

    const decalMat = sharedMaterials().graffiti;
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), decalMat);
    const offset = level.graffitiWall.normal.clone().multiplyScalar(0.03);
    decal.position.copy(level.graffitiWall.position).add(offset);
    decal.lookAt(decal.position.clone().add(level.graffitiWall.normal));
    decal.visible = false;
    scene.add(decal);
    this.decal = decal;
  }

  start(): void {
    this.active = true;
    this.holdProgress = 0;
    this.decal.visible = false;
  }

  /** See StealBeerMission.wantsPrompt — same nearby-NPC-priority guard. */
  wantsPrompt(playerPos: THREE.Vector3, questSystem: QuestSystem): boolean {
    if (!this.active || !questSystem.isActive(GRAFFITI_QUEST.id)) return false;
    return this.zone.isInside(playerPos);
  }

  update(playerPos: THREE.Vector3, questSystem: QuestSystem, hud: HUD, input: InputManager, dt: number): void {
    if (!this.active || !questSystem.isActive(GRAFFITI_QUEST.id)) {
      hud.setHoldBar(false);
      return;
    }

    if (!this.zone.isInside(playerPos)) {
      hud.setHoldBar(false);
      this.holdProgress = Math.max(0, this.holdProgress - DECAY_RATE * dt);
      return;
    }

    hud.showPrompt("Hold E to spray the Homecoming mark");

    const spraying = input.isDown("KeyE");
    if (spraying !== this.wasSpraying) {
      gameEvents.emit("ui", { kind: spraying ? "spray-start" : "spray-stop" });
      this.wasSpraying = spraying;
    }
    if (spraying) {
      this.holdProgress = Math.min(HOLD_DURATION, this.holdProgress + dt);
    } else {
      this.holdProgress = Math.max(0, this.holdProgress - DECAY_RATE * dt);
    }
    hud.setHoldBar(this.holdProgress > 0, this.holdProgress / HOLD_DURATION);

    if (this.holdProgress >= HOLD_DURATION) {
      this.decal.visible = true;
      hud.setHoldBar(false);
      this.active = false;
      if (this.wasSpraying) {
        gameEvents.emit("ui", { kind: "spray-stop" });
        this.wasSpraying = false;
      }
      questSystem.completeObjective(GRAFFITI_QUEST.id, "tag_wall");
    }
  }
}
