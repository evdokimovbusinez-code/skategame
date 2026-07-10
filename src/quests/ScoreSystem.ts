import { TRICK } from "../config/constants";
import { gameEvents } from "../core/GameEvents";
import type { HUD } from "../ui/HUD";

/**
 * Listens to trick/grind/bail events and maintains the arcade combo state:
 * tricks landed within TRICK.comboWindowSeconds of each other chain into one combo;
 * a bail voids the pending combo; grind meters trickle score while grinding.
 */
export class ScoreSystem {
  totalScore = 0;

  private hud: HUD;
  private comboScore = 0;
  private comboCount = 0;
  private comboTimer = 0;
  private grindMeters = 0;

  constructor(hud: HUD) {
    this.hud = hud;

    gameEvents.on("trick", ({ name, score }) => {
      this.hud.showTrickPopup(name, score > 0 ? `+${score}` : "");
      if (score <= 0) return;
      this.comboScore += score;
      this.comboCount += 1;
      this.comboTimer = TRICK.comboWindowSeconds;
      this.updateComboHud();
    });

    gameEvents.on("grindTick", ({ meters }) => {
      this.grindMeters += meters;
      // Score accrues per whole meter ground, keeping the combo alive throughout.
      while (this.grindMeters >= 1) {
        this.grindMeters -= 1;
        this.comboScore += TRICK.scores.grind;
        this.comboTimer = TRICK.comboWindowSeconds;
        this.updateComboHud();
      }
    });

    gameEvents.on("bail", () => {
      this.comboScore = 0;
      this.comboCount = 0;
      this.comboTimer = 0;
      this.grindMeters = 0;
      this.hud.showTrickPopup("BAIL", "", true);
      this.hud.setCombo(null, this.totalScore);
    });
  }

  update(dt: number): void {
    if (this.comboTimer <= 0) return;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.bankCombo();
  }

  private bankCombo(): void {
    if (this.comboScore > 0) {
      this.totalScore += this.comboScore;
      this.hud.showTrickPopup(`+${this.comboScore}`, "BANKED");
      gameEvents.emit("comboBanked", { score: this.comboScore });
    }
    this.comboScore = 0;
    this.comboCount = 0;
    this.grindMeters = 0;
    this.hud.setCombo(null, this.totalScore);
  }

  private updateComboHud(): void {
    this.hud.setCombo(
      { score: this.comboScore, count: this.comboCount, timeFrac: this.comboTimer / TRICK.comboWindowSeconds },
      this.totalScore,
    );
  }
}
