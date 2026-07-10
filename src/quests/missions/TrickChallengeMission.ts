import { gameEvents } from "../../core/GameEvents";
import type { HUD } from "../../ui/HUD";

const TARGET_SCORE = 500;
const TIME_LIMIT = 60;

export type TrickChallengeState = "idle" | "running" | "passed" | "failed";

/**
 * THUG-style timed score attack: rack up TARGET_SCORE trick points within TIME_LIMIT.
 * Listens to the same trick/grind events the ScoreSystem uses, but keeps its own tally
 * so combo banking rules don't matter — every point counts the moment it happens.
 */
export class TrickChallengeMission {
  state: TrickChallengeState = "idle";

  private hud: HUD;
  private score = 0;
  private timeLeft = 0;
  private onFinish: ((passed: boolean) => void) | null = null;

  constructor(hud: HUD) {
    this.hud = hud;
    gameEvents.on("trick", ({ score }) => {
      if (this.state === "running") this.addScore(score);
    });
    gameEvents.on("grindTick", ({ meters }) => {
      if (this.state === "running") this.grindAccum += meters;
    });
  }

  private grindAccum = 0;

  start(onFinish: (passed: boolean) => void): void {
    this.state = "running";
    this.score = 0;
    this.grindAccum = 0;
    this.timeLeft = TIME_LIMIT;
    this.onFinish = onFinish;
    this.hud.toast("Homecoming line! Make the whole lot watch.");
  }

  private addScore(points: number): void {
    this.score += points;
    if (this.score >= TARGET_SCORE) this.finish(true);
  }

  update(dt: number): void {
    if (this.state !== "running") return;

    // Grind meters trickle in continuously; convert to points in whole-meter chunks.
    while (this.grindAccum >= 1) {
      this.grindAccum -= 1;
      this.score += 10;
    }
    if (this.score >= TARGET_SCORE) {
      this.finish(true);
      return;
    }

    this.timeLeft -= dt;
    this.hud.showObjective(
      "Homecoming Line",
      `${this.score} / ${TARGET_SCORE} pts — ${Math.ceil(this.timeLeft)}s left`,
    );
    if (this.timeLeft <= 0) this.finish(false);
  }

  private finish(passed: boolean): void {
    this.state = passed ? "passed" : "failed";
    this.hud.hideObjective();
    if (!passed) this.hud.toast("Time's up! Talk to Tyler to retry.");
    const cb = this.onFinish;
    this.onFinish = null;
    cb?.(passed);
  }
}
