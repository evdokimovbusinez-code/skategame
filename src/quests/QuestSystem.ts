import type { HUD } from "../ui/HUD";
import type { QuestDef } from "./QuestData";
import { gameEvents } from "../core/GameEvents";

/** Single-active-quest tracker: NotStarted -> InProgress(objective N) -> ... -> Completed. */
export class QuestSystem {
  private hud: HUD;
  private active: QuestDef | null = null;
  private objectiveIndex = 0;
  private onQuestComplete: (() => void) | null = null;

  constructor(hud: HUD) {
    this.hud = hud;
  }

  isActive(id: string): boolean {
    return this.active?.id === id;
  }

  start(quest: QuestDef, onComplete?: () => void): void {
    this.active = quest;
    this.objectiveIndex = 0;
    this.onQuestComplete = onComplete ?? null;
    this.hud.toast(`Quest started: ${quest.title}`);
    this.updateTracker();
  }

  completeObjective(questId: string, objectiveId: string): void {
    if (!this.active || this.active.id !== questId) return;
    const current = this.active.objectives[this.objectiveIndex];
    if (!current || current.id !== objectiveId) return;

    this.objectiveIndex++;
    if (this.objectiveIndex >= this.active.objectives.length) {
      this.completeQuest();
    } else {
      this.updateTracker();
    }
  }

  /** Rolls an in-progress quest back to a named objective (e.g. a stealth fail). */
  resetToObjective(questId: string, objectiveId: string): void {
    if (!this.active || this.active.id !== questId) return;
    const idx = this.active.objectives.findIndex((o) => o.id === objectiveId);
    if (idx === -1 || idx > this.objectiveIndex) return;
    this.objectiveIndex = idx;
    this.updateTracker();
  }

  private completeQuest(): void {
    if (!this.active) return;
    this.hud.toast(`Mission Complete: ${this.active.title}`, "success");
    gameEvents.emit("missionComplete", { title: this.active.title });
    this.hud.hideObjective();
    const cb = this.onQuestComplete;
    this.active = null;
    this.onQuestComplete = null;
    cb?.();
  }

  private updateTracker(): void {
    if (!this.active) return;
    const obj = this.active.objectives[this.objectiveIndex];
    this.hud.showObjective(this.active.title, obj?.description ?? "");
  }
}
