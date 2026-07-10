import * as THREE from "three";
import { gameEvents } from "../../core/GameEvents";
import type { HUD } from "../../ui/HUD";
import type { Inventory } from "../../rpg/Inventory";

const TIME_LIMIT = 45;

export type DeliveryState = "idle" | "running" | "done";

/**
 * Mia's timed mixtape run: carry the package from the supermarket to Dante before the clock
 * runs out. Bailing (any ragdoll) drops/ruins the package and fails the run — grab a
 * new one from Rosa to retry. Crow-flies distance is short; the timer punishes wandering.
 */
export class DeliveryMission {
  state: DeliveryState = "idle";

  private hud: HUD;
  private inventory: Inventory;
  private timeLeft = 0;
  private destination: THREE.Vector3;
  private onFinish: ((passed: boolean) => void) | null = null;

  constructor(hud: HUD, inventory: Inventory, destination: THREE.Vector3) {
    this.hud = hud;
    this.inventory = inventory;
    this.destination = destination.clone();

    gameEvents.on("bail", () => {
      if (this.state === "running") this.fail("Диски всмятку! Возьми новый микстейп у Mia.");
    });
  }

  start(onFinish: (passed: boolean) => void): void {
    this.state = "running";
    this.timeLeft = TIME_LIMIT;
    this.onFinish = onFinish;
    this.inventory.add("package");
    this.hud.toast("Mixtape packed! Get it to Dante — don't bail!");
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this.state !== "running") return;

    this.timeLeft -= dt;
    const dist = playerPos.distanceTo(this.destination);
    this.hud.showObjective("Mixtape Dash", `${Math.ceil(this.timeLeft)}s — Dante is ${dist.toFixed(0)}m away`);

    if (dist < 2.2) {
      this.state = "done";
      this.inventory.remove("package");
      this.hud.hideObjective();
      const cb = this.onFinish;
      this.onFinish = null;
      cb?.(true);
      return;
    }

    if (this.timeLeft <= 0) this.fail("Слишком долго — afterparty началась без трека. Retry at Mia's.");
  }

  private fail(msg: string): void {
    this.state = "idle";
    this.inventory.remove("package");
    this.hud.hideObjective();
    this.hud.toast(msg);
    const cb = this.onFinish;
    this.onFinish = null;
    cb?.(false);
  }
}
