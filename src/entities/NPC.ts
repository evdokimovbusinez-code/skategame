import * as THREE from "three";
import { INTERACTION } from "../config/constants";
import { buildHumanoidRig } from "./Player/HumanoidRig";
import type { HumanoidBones, RigColors } from "./Player/HumanoidRig";
import { applyAccessory } from "./Player/Accessories";
import type { Accessory } from "./Player/Accessories";
import { Animator } from "./Player/Animator";
import { QuestMarker } from "./QuestMarker";
import type { MarkerKind } from "./QuestMarker";

export type NpcAccessory = Accessory;

export class NPC {
  readonly group: THREE.Group;
  readonly position: THREE.Vector3;
  readonly name: string;
  readonly marker: QuestMarker;

  private bones: HumanoidBones;
  private animator = new Animator();

  constructor(
    scene: THREE.Scene,
    position: THREE.Vector3,
    name: string,
    facingYaw = 0,
    colors: RigColors = { skin: 0xd9a066, shirt: 0x4c8577, pants: 0x3a3a3a, shoes: 0x1c1c1c },
    accessory: NpcAccessory | NpcAccessory[] = "cap",
  ) {
    this.position = position.clone();
    this.name = name;

    const rig = buildHumanoidRig(colors);
    this.group = rig.group;
    this.bones = rig.bones;
    this.group.position.copy(position);
    this.group.rotation.y = facingYaw;

    // Accepts either one accessory (existing call sites) or a combo, e.g. ["mohawk",
    // "vest"] for a full punk look — a head accessory and a torso one don't conflict.
    for (const a of Array.isArray(accessory) ? accessory : [accessory]) applyAccessory(this.bones, a);
    this.marker = new QuestMarker(this.group);
    scene.add(this.group);
  }

  setMarker(kind: MarkerKind): void {
    this.marker.setKind(kind);
  }

  /** Subtle idle sway so NPCs don't read as static mannequins. */
  update(dt: number): void {
    this.animator.update(this.bones, dt, { speedFrac: 0, grounded: true });
    this.marker.update(dt);
  }

  isPlayerInRange(playerPos: THREE.Vector3): boolean {
    return this.position.distanceTo(playerPos) <= INTERACTION.npcRadius;
  }
}
