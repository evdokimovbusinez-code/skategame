import type { ItemDef } from "../rpg/Inventory";

export type InventoryItemRarity = "common" | "uncommon" | "rare" | "epic" | "quest";

export type HUDInventoryItem = Omit<ItemDef, "rarity"> & {
  rarity?: InventoryItemRarity;
  quantity?: number;
  value?: number;
  equipped?: boolean;
  category?: string;
  tags?: string[];
};

export type HUDCombatTone = "idle" | "ready" | "warning" | "danger";

export interface HUDCombatStatus {
  label?: string;
  hint?: string;
  tone?: HUDCombatTone;
  visible?: boolean;
}

/** Thin DOM overlay for prompts, dialogue, objectives, toasts, and the graffiti hold-bar. */
export class HUD {
  private root: HTMLDivElement;
  private healthPanel: HTMLDivElement;
  private healthFillEl: HTMLDivElement;
  private healthValueEl: HTMLSpanElement;
  private combatPanel: HTMLDivElement;
  private combatStatusEl: HTMLDivElement;
  private combatHintEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private dialogueBox: HTMLDivElement;
  private dialogueSpeaker: HTMLDivElement;
  private dialogueText: HTMLDivElement;
  private objectiveTracker: HTMLDivElement;
  private objectiveTitle: HTMLDivElement;
  private objectiveText: HTMLDivElement;
  private toastContainer: HTMLDivElement;
  private holdBarContainer: HTMLDivElement;
  private holdBarFill: HTMLDivElement;
  private trickPopupContainer: HTMLDivElement;
  private comboPanel: HTMLDivElement;
  private comboLine: HTMLDivElement;
  private totalScoreLine: HTMLDivElement;
  private modeEl: HTMLDivElement;
  private speedFill: HTMLDivElement;
  private moneyEl: HTMLDivElement;
  private repLevelEl: HTMLDivElement;
  private repFillEl: HTMLDivElement;
  private inventoryPanel: HTMLDivElement;
  private inventorySummary: HTMLDivElement;
  private inventoryGrid: HTMLDivElement;
  private inventoryDetails: HTMLDivElement;
  private inventoryItems: HUDInventoryItem[] = [];
  private inventorySelectedIndex = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "hud";
    container.appendChild(this.root);

    const statusPanel = document.createElement("div");
    statusPanel.id = "player-status-panel";
    this.healthPanel = document.createElement("div");
    this.healthPanel.id = "health-panel";
    const healthHeader = document.createElement("div");
    healthHeader.className = "status-header";
    const healthLabel = document.createElement("span");
    healthLabel.textContent = "HEALTH";
    this.healthValueEl = document.createElement("span");
    this.healthValueEl.className = "status-value";
    healthHeader.append(healthLabel, this.healthValueEl);
    const healthBar = document.createElement("div");
    healthBar.id = "health-bar";
    this.healthFillEl = document.createElement("div");
    this.healthFillEl.id = "health-fill";
    healthBar.appendChild(this.healthFillEl);
    this.healthPanel.append(healthHeader, healthBar);

    this.combatPanel = document.createElement("div");
    this.combatPanel.id = "combat-panel";
    this.combatStatusEl = document.createElement("div");
    this.combatStatusEl.className = "combat-status";
    this.combatHintEl = document.createElement("div");
    this.combatHintEl.className = "combat-hint";
    this.combatPanel.append(this.combatStatusEl, this.combatHintEl);
    statusPanel.append(this.healthPanel, this.combatPanel);
    this.root.appendChild(statusPanel);
    this.setHealth(100, 100);
    this.setCombatStatus(null);

    this.promptEl = document.createElement("div");
    this.promptEl.id = "prompt";
    this.root.appendChild(this.promptEl);

    this.objectiveTracker = document.createElement("div");
    this.objectiveTracker.id = "objective-tracker";
    this.objectiveTitle = document.createElement("div");
    this.objectiveTitle.className = "quest-title";
    this.objectiveText = document.createElement("div");
    this.objectiveTracker.append(this.objectiveTitle, this.objectiveText);
    this.root.appendChild(this.objectiveTracker);

    this.toastContainer = document.createElement("div");
    this.toastContainer.id = "toast-container";
    this.root.appendChild(this.toastContainer);

    this.dialogueBox = document.createElement("div");
    this.dialogueBox.id = "dialogue-box";
    this.dialogueSpeaker = document.createElement("div");
    this.dialogueSpeaker.className = "speaker";
    this.dialogueText = document.createElement("div");
    this.dialogueText.className = "text";
    const hint = document.createElement("div");
    hint.className = "continue-hint";
    hint.textContent = "Press E to continue";
    this.dialogueBox.append(this.dialogueSpeaker, this.dialogueText, hint);
    this.root.appendChild(this.dialogueBox);

    this.holdBarContainer = document.createElement("div");
    this.holdBarContainer.id = "hold-bar-container";
    this.holdBarFill = document.createElement("div");
    this.holdBarFill.id = "hold-bar-fill";
    this.holdBarContainer.appendChild(this.holdBarFill);
    this.root.appendChild(this.holdBarContainer);

    this.trickPopupContainer = document.createElement("div");
    this.trickPopupContainer.id = "trick-popup-container";
    this.root.appendChild(this.trickPopupContainer);

    this.comboPanel = document.createElement("div");
    this.comboPanel.id = "combo-panel";
    this.comboLine = document.createElement("div");
    this.comboLine.className = "combo-line";
    this.totalScoreLine = document.createElement("div");
    this.totalScoreLine.className = "total-score-line";
    this.totalScoreLine.textContent = "SCORE 0";
    this.comboPanel.append(this.comboLine, this.totalScoreLine);
    this.root.appendChild(this.comboPanel);

    this.modeEl = document.createElement("div");
    this.modeEl.id = "mode-indicator";
    this.modeEl.textContent = "SKATE";
    this.root.appendChild(this.modeEl);

    const speedBar = document.createElement("div");
    speedBar.id = "speed-bar";
    this.speedFill = document.createElement("div");
    this.speedFill.id = "speed-fill";
    speedBar.appendChild(this.speedFill);
    this.root.appendChild(speedBar);

    // ---- RPG panel: money + reputation (top-right, GTA-style stack) ----
    const rpgPanel = document.createElement("div");
    rpgPanel.id = "rpg-panel";
    const moneyLabel = document.createElement("div");
    moneyLabel.className = "rpg-label";
    moneyLabel.textContent = "CASH";
    this.moneyEl = document.createElement("div");
    this.moneyEl.id = "money-counter";
    this.moneyEl.textContent = "$0";
    const repLabel = document.createElement("div");
    repLabel.className = "rpg-label";
    repLabel.textContent = "REP";
    const repRow = document.createElement("div");
    repRow.id = "rep-row";
    this.repLevelEl = document.createElement("div");
    this.repLevelEl.id = "rep-level";
    this.repLevelEl.textContent = "NOBODY";
    const repBar = document.createElement("div");
    repBar.id = "rep-bar";
    this.repFillEl = document.createElement("div");
    this.repFillEl.id = "rep-fill";
    repBar.appendChild(this.repFillEl);
    repRow.append(this.repLevelEl, repBar);
    rpgPanel.append(moneyLabel, this.moneyEl, repLabel, repRow);
    this.root.appendChild(rpgPanel);

    // ---- Inventory panel (toggled with I) ----
    this.inventoryPanel = document.createElement("div");
    this.inventoryPanel.id = "inventory-panel";
    this.inventoryPanel.setAttribute("aria-label", "Inventory");
    const invHeader = document.createElement("div");
    invHeader.className = "inv-header";
    const invTitle = document.createElement("div");
    invTitle.className = "inv-title";
    invTitle.textContent = "BACKPACK";
    this.inventorySummary = document.createElement("div");
    this.inventorySummary.className = "inv-summary";
    invHeader.append(invTitle, this.inventorySummary);
    const invBody = document.createElement("div");
    invBody.className = "inv-body";
    this.inventoryGrid = document.createElement("div");
    this.inventoryGrid.className = "inv-grid";
    this.inventoryDetails = document.createElement("div");
    this.inventoryDetails.className = "inv-details";
    invBody.append(this.inventoryGrid, this.inventoryDetails);
    this.inventoryPanel.append(invHeader, invBody);
    this.root.appendChild(this.inventoryPanel);
    this.setInventoryItems([]);
  }

  setHealth(current: number, max = 100): void {
    const safeMax = Math.max(1, max);
    const clamped = Math.min(safeMax, Math.max(0, current));
    const frac = clamped / safeMax;
    this.healthFillEl.style.width = `${Math.round(frac * 100)}%`;
    this.healthValueEl.textContent = `${Math.ceil(clamped)} / ${Math.ceil(safeMax)}`;
    this.healthPanel.classList.toggle("warning", frac <= 0.5 && frac > 0.25);
    this.healthPanel.classList.toggle("critical", frac <= 0.25);
  }

  setCombatStatus(status: HUDCombatStatus | string | null): void {
    const normalized = typeof status === "string" ? { label: status, tone: "ready" as const } : status;
    const visible = Boolean(normalized && normalized.visible !== false && (normalized.label || normalized.hint));
    this.combatPanel.classList.remove("visible", "idle", "ready", "warning", "danger");
    if (!visible || !normalized) {
      this.combatStatusEl.textContent = "";
      this.combatHintEl.textContent = "";
      return;
    }

    const tone = normalized.tone ?? "ready";
    this.combatPanel.classList.add("visible", tone);
    this.combatStatusEl.textContent = (normalized.label ?? "COMBAT").toUpperCase();
    this.combatHintEl.textContent = normalized.hint ?? "";
    this.combatHintEl.classList.toggle("empty", !normalized.hint);
  }

  setCombatHint(hint: string | null, tone: HUDCombatTone = "ready"): void {
    this.setCombatStatus(hint ? { label: "COMBAT", hint, tone } : null);
  }

  setMoney(balance: number, delta = 0): void {
    this.moneyEl.textContent = `$${balance}`;
    if (delta !== 0) {
      this.moneyEl.classList.remove("bump-up", "bump-down");
      void this.moneyEl.offsetWidth; // restart the CSS animation
      this.moneyEl.classList.add(delta > 0 ? "bump-up" : "bump-down");
    }
  }

  setRep(levelName: string, levelFrac: number): void {
    this.repLevelEl.textContent = levelName.toUpperCase();
    this.repFillEl.style.width = `${Math.round(Math.min(1, Math.max(0, levelFrac)) * 100)}%`;
  }

  setInventoryOpen(open: boolean, items: ReadonlyArray<HUDInventoryItem> = []): void {
    this.inventoryPanel.classList.toggle("visible", open);
    if (!open) return;
    this.setInventoryItems(items);
  }

  setInventoryItems(items: ReadonlyArray<HUDInventoryItem>, selectedIndex = this.inventorySelectedIndex): void {
    this.inventoryItems = [...items];
    const maxIndex = this.inventoryItems.length - 1;
    this.inventorySelectedIndex = maxIndex < 0 ? 0 : Math.min(maxIndex, Math.max(0, Math.floor(selectedIndex)));
    this.renderInventory();
  }

  selectInventoryItem(index: number): void {
    if (index < 0 || index >= this.inventoryItems.length) return;
    this.inventorySelectedIndex = index;
    this.renderInventory();
  }

  private renderInventory(): void {
    this.inventoryGrid.innerHTML = "";
    this.inventorySummary.textContent = `${this.inventoryItems.length} item${this.inventoryItems.length === 1 ? "" : "s"}`;
    if (this.inventoryItems.length === 0) {
      const empty = document.createElement("div");
      empty.className = "inv-empty";
      const emptyTitle = document.createElement("div");
      emptyTitle.className = "inv-empty-title";
      emptyTitle.textContent = "Nothing packed";
      const emptyText = document.createElement("div");
      emptyText.textContent = "Quest gear, shop decks, and collectibles will show up here.";
      empty.append(emptyTitle, emptyText);
      this.inventoryGrid.appendChild(empty);
      this.renderInventoryDetails(null);
      return;
    }

    this.inventoryItems.forEach((item, index) => {
      const rarity = this.getItemRarity(item);
      const cell = document.createElement("div");
      cell.className = `inv-cell rarity-${rarity}`;
      cell.setAttribute("role", "button");
      cell.tabIndex = 0;
      cell.classList.toggle("selected", index === this.inventorySelectedIndex);
      cell.addEventListener("click", () => this.selectInventoryItem(index));
      cell.addEventListener("keydown", (e) => {
        if (e.code !== "Enter" && e.code !== "Space") return;
        e.preventDefault();
        this.selectInventoryItem(index);
      });

      const icon = document.createElement("div");
      icon.className = "inv-icon";
      icon.textContent = item.icon;
      const copy = document.createElement("div");
      copy.className = "inv-copy";
      const name = document.createElement("div");
      name.className = "inv-name";
      name.textContent = item.name;
      const meta = document.createElement("div");
      meta.className = "inv-meta";
      meta.textContent = this.formatInventoryMeta(item, rarity);
      copy.append(name, meta);
      cell.append(icon, copy);
      if (item.quantity && item.quantity > 1) {
        const qty = document.createElement("div");
        qty.className = "inv-qty";
        qty.textContent = `x${item.quantity}`;
        cell.appendChild(qty);
      }
      this.inventoryGrid.appendChild(cell);
    });
    this.renderInventoryDetails(this.inventoryItems[this.inventorySelectedIndex] ?? null);
  }

  private renderInventoryDetails(item: HUDInventoryItem | null): void {
    this.inventoryDetails.innerHTML = "";
    this.inventoryDetails.classList.toggle("empty", !item);
    if (!item) {
      const emptyTitle = document.createElement("div");
      emptyTitle.className = "inv-detail-title";
      emptyTitle.textContent = "No item selected";
      const emptyText = document.createElement("div");
      emptyText.className = "inv-detail-desc";
      emptyText.textContent = "Open the backpack after picking something up.";
      this.inventoryDetails.append(emptyTitle, emptyText);
      return;
    }

    const rarity = this.getItemRarity(item);
    const icon = document.createElement("div");
    icon.className = `inv-detail-icon rarity-${rarity}`;
    icon.textContent = item.icon;
    const rarityEl = document.createElement("div");
    rarityEl.className = `inv-detail-rarity rarity-${rarity}`;
    rarityEl.textContent = rarity.toUpperCase();
    const title = document.createElement("div");
    title.className = "inv-detail-title";
    title.textContent = item.name;
    const desc = document.createElement("div");
    desc.className = "inv-detail-desc";
    desc.textContent = item.description;
    const meta = document.createElement("div");
    meta.className = "inv-detail-meta";
    meta.textContent = this.formatInventoryMeta(item, rarity);
    this.inventoryDetails.append(icon, rarityEl, title, desc, meta);
  }

  private getItemRarity(item: HUDInventoryItem): InventoryItemRarity {
    if (item.rarity) return item.rarity;
    if (item.id.startsWith("vhs") || item.id === "package") return "quest";
    if (item.id === "deck_pro") return "rare";
    if (item.id === "deck_street" || item.id === "spraycan") return "uncommon";
    return "common";
  }

  private formatInventoryMeta(item: HUDInventoryItem, rarity: InventoryItemRarity): string {
    const parts: string[] = [rarity];
    if (item.category) parts.push(item.category);
    if (item.equipped) parts.push("equipped");
    if (item.value !== undefined) parts.push(`$${item.value}`);
    if (item.tags?.length) parts.push(...item.tags);
    return parts.map((part) => part.toUpperCase()).join(" / ");
  }

  showTrickPopup(name: string, sub: string, danger = false): void {
    const el = document.createElement("div");
    el.className = "trick-popup" + (danger ? " danger" : "");
    const title = document.createElement("span");
    title.textContent = name;
    el.appendChild(title);
    if (sub) {
      const subEl = document.createElement("span");
      subEl.className = "trick-sub";
      subEl.textContent = sub;
      el.appendChild(subEl);
    }
    this.trickPopupContainer.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }

  setCombo(combo: { score: number; count: number; timeFrac: number } | null, total: number): void {
    this.totalScoreLine.textContent = `SCORE ${total}`;
    if (combo && combo.score > 0) {
      this.comboLine.textContent = combo.count > 1 ? `${combo.score} × combo ${combo.count}` : `${combo.score}`;
      this.comboLine.style.opacity = String(0.5 + 0.5 * combo.timeFrac);
    } else {
      this.comboLine.textContent = "";
    }
  }

  setMode(mode: string): void {
    if (this.modeEl.textContent !== mode) this.modeEl.textContent = mode;
    this.modeEl.classList.toggle("danger", mode === "RAGDOLL");
  }

  setSpeed(frac: number): void {
    this.speedFill.style.width = `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`;
  }

  showPrompt(text: string): void {
    this.promptEl.textContent = text;
    this.promptEl.classList.add("visible");
  }

  hidePrompt(): void {
    this.promptEl.classList.remove("visible");
  }

  showDialogue(speaker: string, text: string, choices: string[] | null = null, onPick?: (i: number) => void): void {
    this.dialogueSpeaker.textContent = speaker;
    this.dialogueText.textContent = text;
    this.dialogueBox.classList.add("visible");

    this.dialogueChoices?.remove();
    this.dialogueChoices = null;
    const hint = this.dialogueBox.querySelector<HTMLElement>(".continue-hint");
    if (choices && choices.length > 0) {
      if (hint) hint.textContent = "Choose: press 1–" + choices.length + " or click";
      const box = document.createElement("div");
      box.className = "choices";
      choices.forEach((label, i) => {
        const el = document.createElement("div");
        el.className = "choice";
        const num = document.createElement("span");
        num.className = "choice-num";
        num.textContent = String(i + 1);
        el.append(num, document.createTextNode(label));
        el.addEventListener("click", () => onPick?.(i));
        box.appendChild(el);
      });
      this.dialogueBox.insertBefore(box, hint);
      this.dialogueChoices = box;
    } else if (hint) {
      hint.textContent = "Press E to continue";
    }
  }

  private dialogueChoices: HTMLDivElement | null = null;

  hideDialogue(): void {
    this.dialogueBox.classList.remove("visible");
    this.dialogueChoices?.remove();
    this.dialogueChoices = null;
  }

  showObjective(title: string, text: string): void {
    this.objectiveTitle.textContent = title;
    this.objectiveText.textContent = text;
    this.objectiveTracker.classList.add("visible");
  }

  hideObjective(): void {
    this.objectiveTracker.classList.remove("visible");
  }

  toast(message: string, variant: "default" | "success" = "default"): void {
    const el = document.createElement("div");
    el.className = "toast" + (variant === "success" ? " success" : "");
    el.textContent = message;
    this.toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  }

  setHoldBar(visible: boolean, progress = 0): void {
    this.holdBarContainer.classList.toggle("visible", visible);
    this.holdBarFill.style.width = `${Math.round(progress * 100)}%`;
  }
}
