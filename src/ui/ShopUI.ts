import { gameEvents } from "../core/GameEvents";
import type { PlayerStats } from "../rpg/PlayerStats";
import type { Inventory } from "../rpg/Inventory";

interface ShopEntry {
  itemId: string;
  name: string;
  description: string;
  price: number;
  repReward: number; // supporting the local shop earns street cred
}

const CATALOG: ShopEntry[] = [
  { itemId: "spraycan", name: "Spray Paint", description: "Fresh paint for alley posters.", price: 10, repReward: 0 },
  { itemId: "deck_street", name: "Street Deck", description: "Solid 7-ply. Mia-approved.", price: 60, repReward: 15 },
  { itemId: "deck_pro", name: "Pro Deck", description: "Featherlight. For legends only.", price: 150, repReward: 40 },
];

/** Mia's under-counter skate shop: a simple modal catalog. Buying adds the item + a little rep. */
export class ShopUI {
  isOpen = false;

  private panel: HTMLDivElement;
  private itemsBox: HTMLDivElement;
  private hint: HTMLDivElement;
  private stats: PlayerStats;
  private inventory: Inventory;

  constructor(container: HTMLElement, stats: PlayerStats, inventory: Inventory) {
    this.stats = stats;
    this.inventory = inventory;

    this.panel = document.createElement("div");
    this.panel.id = "shop-panel";
    const title = document.createElement("div");
    title.className = "shop-title";
    title.textContent = "MIA'S COUNTER STASH";
    const sub = document.createElement("div");
    sub.className = "shop-sub";
    sub.textContent = "FoodMart back counter · no receipts · respect the local scene";
    this.itemsBox = document.createElement("div");
    this.hint = document.createElement("div");
    this.hint.className = "shop-hint";
    this.hint.textContent = "Esc / E — close";
    this.panel.append(title, sub, this.itemsBox, this.hint);
    container.appendChild(this.panel);
  }

  open(): void {
    this.isOpen = true;
    this.render();
    this.panel.classList.add("visible");
  }

  close(): void {
    this.isOpen = false;
    this.panel.classList.remove("visible");
  }

  private render(): void {
    this.itemsBox.innerHTML = "";
    for (const entry of CATALOG) {
      const row = document.createElement("div");
      row.className = "shop-item";
      const label = document.createElement("div");
      label.className = "label";
      label.innerHTML = `<strong>${entry.name}</strong> <span class="desc">${entry.description}</span>`;
      const btn = document.createElement("button");
      btn.className = "buy-btn";
      const owned = this.inventory.has(entry.itemId);
      if (owned) {
        btn.textContent = "OWNED";
        btn.classList.add("owned");
        btn.disabled = true;
      } else {
        btn.textContent = `$${entry.price}`;
        btn.disabled = this.stats.money < entry.price;
        btn.addEventListener("click", () => this.buy(entry));
      }
      row.append(label, btn);
      this.itemsBox.appendChild(row);
    }
  }

  private buy(entry: ShopEntry): void {
    if (this.inventory.has(entry.itemId)) return;
    if (!this.stats.spend(entry.price)) return;
    this.inventory.add(entry.itemId);
    if (entry.repReward > 0) this.stats.addRep(entry.repReward);
    gameEvents.emit("ui", { kind: "purchase" });
    this.render();
  }
}
