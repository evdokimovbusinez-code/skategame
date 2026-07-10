import Stats from "stats.js";
import type { PlayerController } from "../entities/Player/PlayerController";

/**
 * F3-toggled dev overlay: FPS meter (stats.js) + live player state readout + teleport
 * hotkeys for fast mission testing (1 = shop, 2 = graffiti wall, 3 = plaza center).
 */
export class DebugPanel {
  private stats: Stats;
  private infoEl: HTMLDivElement;
  private visible = false;

  constructor(container: HTMLElement, player: PlayerController) {
    this.stats = new Stats();
    this.stats.showPanel(0);
    this.stats.dom.style.cssText = "position:absolute;top:0;left:50%;transform:translateX(-50%);display:none;";
    container.appendChild(this.stats.dom);

    this.infoEl = document.createElement("div");
    this.infoEl.style.cssText =
      "position:absolute;top:52px;left:50%;transform:translateX(-50%);font:11px monospace;color:#8f8;background:rgba(0,0,0,0.6);padding:4px 8px;display:none;white-space:pre;z-index:30;";
    container.appendChild(this.infoEl);

    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.visible = !this.visible;
        this.stats.dom.style.display = this.visible ? "block" : "none";
        this.infoEl.style.display = this.visible ? "block" : "none";
      }
      if (!this.visible) return;
      if (e.code === "Digit1") player.body.setTranslation({ x: 12, y: 1.2, z: 14 }, true);
      if (e.code === "Digit2") player.body.setTranslation({ x: -12, y: 1.2, z: -2 }, true);
      if (e.code === "Digit3") player.body.setTranslation({ x: 0, y: 1.2, z: 0 }, true);
    });
  }

  update(player: PlayerController): void {
    this.stats.update();
    if (!this.visible) return;
    const p = player.position;
    this.infoEl.textContent =
      `state: ${player.state}${player.grinding ? " (grind)" : ""}  grounded: ${player.grounded}\n` +
      `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}  speed: ${player.skateSpeed.toFixed(1)}  stance: ${player.stanceLabel}\n` +
      `teleport: 1=shop 2=wall 3=plaza`;
  }
}
