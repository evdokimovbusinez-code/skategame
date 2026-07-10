import { gameEvents } from "../core/GameEvents";

export interface RepLevel {
  name: string;
  threshold: number;
}

/** Reputation ladder — mission availability and the campaign finale gate off these. */
export const REP_LEVELS: RepLevel[] = [
  { name: "Nobody", threshold: 0 },
  { name: "Poser", threshold: 60 },
  { name: "Local", threshold: 150 },
  { name: "Known", threshold: 280 },
  { name: "Legend", threshold: 450 },
];

const SAVE_KEY = "sk8town-save-v1";

interface SaveData {
  money: number;
  rep: number;
  health?: number;
  inventory: string[];
  completedQuests: string[];
  storyStage: number;
}

/**
 * Central RPG state: money, reputation, and persistence. Quest/shop/trick systems all
 * read and write through here so the HUD and save file always agree.
 */
export class PlayerStats {
  money = 0;
  rep = 0;
  maxHealth = 100;
  health = 100;
  completedQuests = new Set<string>();
  storyStage = 0;

  private inventoryRef: () => string[];

  constructor(inventoryRef: () => string[] = () => []) {
    this.inventoryRef = inventoryRef;
  }

  get repLevel(): RepLevel {
    let current = REP_LEVELS[0];
    for (const level of REP_LEVELS) {
      if (this.rep >= level.threshold) current = level;
    }
    return current;
  }

  /** 0..1 progress toward the NEXT level (1 when maxed). */
  get repLevelFrac(): number {
    const idx = REP_LEVELS.indexOf(this.repLevel);
    const next = REP_LEVELS[idx + 1];
    if (!next) return 1;
    const base = this.repLevel.threshold;
    return (this.rep - base) / (next.threshold - base);
  }

  addMoney(delta: number): void {
    this.money = Math.max(0, this.money + delta);
    gameEvents.emit("moneyChanged", { balance: this.money, delta });
    this.save();
  }

  /** Returns false (and changes nothing) if the player can't afford it. */
  spend(amount: number): boolean {
    if (this.money < amount) return false;
    this.addMoney(-amount);
    return true;
  }

  addRep(delta: number): void {
    const before = this.repLevel;
    this.rep = Math.max(0, this.rep + delta);
    const after = this.repLevel;
    gameEvents.emit("repChanged", {
      rep: this.rep,
      delta,
      levelName: after.name,
      levelFrac: this.repLevelFrac,
    });
    if (after !== before && delta > 0) gameEvents.emit("repLevelUp", { levelName: after.name });
    this.save();
  }

  heal(amount: number): void {
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + Math.max(0, amount));
    const delta = this.health - before;
    if (delta !== 0) gameEvents.emit("healthChanged", { health: this.health, maxHealth: this.maxHealth, delta });
    this.save();
  }

  takeDamage(amount: number, source?: string): void {
    if (this.health <= 0) return;
    const damage = Math.max(0, amount);
    if (damage <= 0) return;
    const before = this.health;
    this.health = Math.max(0, this.health - damage);
    const delta = this.health - before;
    gameEvents.emit("healthChanged", { health: this.health, maxHealth: this.maxHealth, delta });
    gameEvents.emit("playerDamaged", { amount: damage, source });
    if (this.health <= 0) gameEvents.emit("playerDefeated", { source });
    this.save();
  }

  restoreHealth(): void {
    const before = this.health;
    this.health = this.maxHealth;
    const delta = this.health - before;
    gameEvents.emit("healthChanged", { health: this.health, maxHealth: this.maxHealth, delta });
    this.save();
  }

  markQuestComplete(id: string): void {
    this.completedQuests.add(id);
    this.save();
  }

  isQuestComplete(id: string): boolean {
    return this.completedQuests.has(id);
  }

  save(): void {
    try {
      const data: SaveData = {
        money: this.money,
        rep: this.rep,
        health: this.health,
        inventory: this.inventoryRef(),
        completedQuests: [...this.completedQuests],
        storyStage: this.storyStage,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Private-browsing / storage-denied: play a session-only game rather than crash.
    }
  }

  /** Returns the raw save (including inventory ids for InventorySystem to restore). */
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as SaveData;
      this.money = data.money ?? 0;
      this.rep = data.rep ?? 0;
      this.health = clamp(data.health ?? this.maxHealth, 1, this.maxHealth);
      this.completedQuests = new Set(data.completedQuests ?? []);
      this.storyStage = data.storyStage ?? 0;
      return data;
    } catch {
      return null;
    }
  }

  static wipeSave(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
