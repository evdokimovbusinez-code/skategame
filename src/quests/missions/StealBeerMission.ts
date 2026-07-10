import * as THREE from "three";
import type { InputManager } from "../../core/InputManager";
import type { HUD } from "../../ui/HUD";
import type { QuestSystem } from "../QuestSystem";
import type { QuestDef } from "../QuestData";
import type { LevelHandles } from "../../world/Level";
import { TriggerZone } from "../../world/TriggerZone";
import { ps2Material, faceted, PALETTE } from "../../rendering/ps2Materials";
import { buildSixPackMesh } from "../../world/geometry/props";
import { SHOPKEEPER } from "../../config/constants";
import { buildHumanoidRig } from "../../entities/Player/HumanoidRig";
import { Animator } from "../../entities/Player/Animator";

export const STEAL_BEER_QUEST: QuestDef = {
  id: "steal_beer",
  title: "Party Snack Run",
  objectives: [
    { id: "grab_item", description: "Grab the party snacks from the checkout" },
    { id: "escape", description: "Slip back through the glass doors without the clerk spotting you" },
  ],
};

/**
 * Grab-and-escape with a light stealth twist: a shopkeeper watches part of the shop
 * through a simple vision cone. Getting caught while carrying resets the six-pack to
 * the counter — cheap tension without building a real AI/vision system.
 */
export class StealBeerMission {
  private counterZone: TriggerZone;
  // The exit isn't a small circle: the shop's open frontage is ~6.6 units wide, so a
  // player sneaking out along either wall (the level's own intended stealth path — see
  // the shopkeeper-facing comment below) could walk right past a tight radius without
  // ever completing "escape" (confirmed live: hugging the left wall out stayed 3.1-4.2
  // units from a radius-1.6 circle centered on the doorway). Instead, "escaped" is
  // "stepped past the doorway plane, anywhere across its width" — a couple of units of
  // Z-margin already separates this from the counter, so it can't double as the grab.
  private exitThresholdZ: number;
  private exitHalfWidth = 4;
  private exitCenterX: number;
  private prop: THREE.Group;
  private shopkeeperPos: THREE.Vector3;
  private shopkeeperFacing: THREE.Vector3;
  private counterPos: THREE.Vector3;
  private hasItem = false;
  private active = false;
  private bustedCooldown = 0;
  private keeperAnimator = new Animator();
  private keeperBones: ReturnType<typeof buildHumanoidRig>["bones"];
  private onCarryChanged?: (carrying: boolean) => void;

  constructor(scene: THREE.Scene, level: LevelHandles, onCarryChanged?: (carrying: boolean) => void) {
    this.onCarryChanged = onCarryChanged;
    this.counterZone = new TriggerZone(level.shopCounter, 1.3);
    this.exitThresholdZ = level.shopExit.z - 2;
    this.exitCenterX = level.shopExit.x;
    this.counterPos = level.shopCounter.clone();
    this.shopkeeperPos = level.shopkeeper.position.clone();
    this.shopkeeperFacing = level.shopkeeper.facing.clone();

    this.prop = buildSixPackMesh();
    this.prop.position.copy(level.shopCounter);
    scene.add(this.prop);

    const rig = buildHumanoidRig({ skin: PALETTE.skin, shirt: 0x8b2f2c, pants: 0x2e3040, shoes: 0x2a2a2a });
    this.keeperBones = rig.bones;
    const apron = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.3, 0.36, 0.045)), ps2Material(0xf1ead8));
    apron.position.set(0, 0.16, 0.145);
    apron.castShadow = true;
    rig.bones.spine.add(apron);
    rig.group.position.copy(this.shopkeeperPos);
    rig.group.rotation.y = Math.atan2(this.shopkeeperFacing.x, this.shopkeeperFacing.z);
    scene.add(rig.group);

    // Vision cone painted on the floor so the stealth rule is readable, not guessed.
    const coneAngle = (SHOPKEEPER.coneAngleDeg * Math.PI) / 180;
    const coneShape = new THREE.Shape();
    coneShape.moveTo(0, 0);
    coneShape.absarc(0, 0, SHOPKEEPER.coneRange, Math.PI / 2 - coneAngle, Math.PI / 2 + coneAngle, false);
    coneShape.lineTo(0, 0);
    const coneMesh = new THREE.Mesh(
      new THREE.ShapeGeometry(coneShape, 12),
      new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
    );
    coneMesh.rotation.x = -Math.PI / 2;
    coneMesh.rotation.z = -Math.atan2(this.shopkeeperFacing.x, this.shopkeeperFacing.z);
    coneMesh.position.copy(this.shopkeeperPos).add(new THREE.Vector3(0, 0.03, 0));
    scene.add(coneMesh);
  }

  start(): void {
    this.active = true;
    this.hasItem = false;
    this.prop.visible = true;
  }

  private isSpottedByShopkeeper(playerPos: THREE.Vector3): boolean {
    const toPlayer = playerPos.clone().sub(this.shopkeeperPos);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    if (dist > SHOPKEEPER.coneRange) return false;
    const angle = toPlayer.normalize().angleTo(this.shopkeeperFacing);
    return angle < (SHOPKEEPER.coneAngleDeg * Math.PI) / 180;
  }

  /** True when this mission wants the E prompt at the player's current position this
   * frame — checked by main.ts BEFORE nearby-NPC chat prompts, since Rosa's shop sits
   * close enough to the counter that her talk radius could otherwise silently swallow
   * the "grab the six-pack" prompt (confirmed live: standing at the counter edge nearest
   * Rosa put the player inside her 2.2-unit radius). */
  wantsPrompt(playerPos: THREE.Vector3, questSystem: QuestSystem): boolean {
    if (!this.active || !questSystem.isActive(STEAL_BEER_QUEST.id)) return false;
    return !this.hasItem && this.counterZone.isInside(playerPos);
  }

  update(playerPos: THREE.Vector3, questSystem: QuestSystem, hud: HUD, input: InputManager, dt: number): void {
    this.keeperAnimator.update(this.keeperBones, dt, { speedFrac: 0, grounded: true });
    if (!this.active || !questSystem.isActive(STEAL_BEER_QUEST.id)) return;
    this.bustedCooldown = Math.max(0, this.bustedCooldown - dt);

    if (!this.hasItem) {
      if (this.counterZone.isInside(playerPos)) {
        hud.showPrompt("Press E to grab the party snacks");
        if (input.justPressedRaw("KeyE")) {
          this.hasItem = true;
          this.prop.visible = false;
          this.onCarryChanged?.(true);
          questSystem.completeObjective(STEAL_BEER_QUEST.id, "grab_item");
        }
      }
      return;
    }

    // Carrying: shopkeeper cone busts you and the snacks go back on the counter.
    if (this.bustedCooldown <= 0 && this.isSpottedByShopkeeper(playerPos)) {
      this.hasItem = false;
      this.prop.visible = true;
      this.prop.position.copy(this.counterPos);
      this.bustedCooldown = 1.5;
      this.onCarryChanged?.(false);
      hud.toast("Busted! The clerk saw you — the snacks are back at checkout");
      questSystem.resetToObjective(STEAL_BEER_QUEST.id, "grab_item");
      return;
    }

    const escaped =
      playerPos.z >= this.exitThresholdZ && Math.abs(playerPos.x - this.exitCenterX) <= this.exitHalfWidth;
    if (escaped) {
      this.hasItem = false;
      this.onCarryChanged?.(false);
      questSystem.completeObjective(STEAL_BEER_QUEST.id, "escape");
      this.active = false;
    }
  }
}
