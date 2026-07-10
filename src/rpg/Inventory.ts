import { gameEvents } from "../core/GameEvents";

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji-esque glyph rendered in the inventory grid — PS2-menu simple
  type?: "quest" | "gear" | "consumable" | "collectible";
  rarity?: "common" | "uncommon" | "rare";
  stackable?: boolean;
  healAmount?: number;
  staminaAmount?: number;
}

/** Every item that can exist. Quest items, collectibles, and shop gear all live here. */
export const ITEM_DEFS: Record<string, ItemDef> = {
  sixpack: {
    id: "sixpack",
    name: "Party Snacks",
    description: "Contraband checkout cargo for Tyler's crew.",
    icon: "CAN",
    type: "quest",
    rarity: "uncommon",
  },
  spraycan: {
    id: "spraycan",
    name: "Spray Paint",
    description: "For posters, tags, and bad decisions.",
    icon: "SPR",
    type: "gear",
    rarity: "common",
  },
  vhs1: {
    id: "vhs1",
    name: "Tape: FoodMart Roof",
    description: "Dante's missing footage 1/3.",
    icon: "VHS",
    type: "collectible",
    rarity: "rare",
  },
  vhs2: {
    id: "vhs2",
    name: "Tape: Senior Wall",
    description: "Dante's missing footage 2/3.",
    icon: "VHS",
    type: "collectible",
    rarity: "rare",
  },
  vhs3: {
    id: "vhs3",
    name: "Tape: Back Alley",
    description: "Dante's missing footage 3/3.",
    icon: "VHS",
    type: "collectible",
    rarity: "rare",
  },
  package: {
    id: "package",
    name: "Mixtape Box",
    description: "Fragile CDs for the afterparty.",
    icon: "BOX",
    type: "quest",
    rarity: "uncommon",
  },
  deck_street: {
    id: "deck_street",
    name: "Street Deck",
    description: "A fresh deck from Mia's under-counter stash.",
    icon: "DEK",
    type: "gear",
    rarity: "uncommon",
  },
  deck_pro: {
    id: "deck_pro",
    name: "Pro Deck",
    description: "Top-shelf. You've made it.",
    icon: "PRO",
    type: "gear",
    rarity: "rare",
  },
  convenience_snack: {
    id: "convenience_snack",
    name: "Corner Store Snack",
    description: "Gas-station calories. Restores a chunk of health.",
    icon: "SNK",
    type: "consumable",
    rarity: "common",
    stackable: true,
    healAmount: 28,
  },
  first_aid_tape: {
    id: "first_aid_tape",
    name: "First Aid Tape",
    description: "Hockey tape, napkin, whatever works. Big heal.",
    icon: "AID",
    type: "consumable",
    rarity: "uncommon",
    stackable: true,
    healAmount: 55,
  },
  lucky_sticker: {
    id: "lucky_sticker",
    name: "Lucky Sticker",
    description: "A rival crew sticker ripped off a board. Worth keeping.",
    icon: "STK",
    type: "collectible",
    rarity: "rare",
    stackable: true,
  },
};

/** Small RPG inventory: unique gear/quest items, stackable consumables and collectibles. */
export class Inventory {
  private items: string[] = [];

  has(id: string): boolean {
    return this.items.includes(id);
  }

  add(id: string): void {
    const def = ITEM_DEFS[id];
    if (!def) return;
    if (!def.stackable && this.items.includes(id)) return;
    this.items.push(id);
    gameEvents.emit("itemAdded", { id, name: def.name });
  }

  remove(id: string): void {
    const idx = this.items.indexOf(id);
    if (idx === -1) return;
    this.items.splice(idx, 1);
    gameEvents.emit("itemRemoved", { id });
  }

  use(id: string): ItemDef | null {
    const def = ITEM_DEFS[id];
    if (!def || def.type !== "consumable") return null;
    const idx = this.items.indexOf(id);
    if (idx === -1) return null;
    this.items.splice(idx, 1);
    gameEvents.emit("itemRemoved", { id });
    gameEvents.emit("itemUsed", { id, name: def.name });
    return def;
  }

  count(prefix: string): number {
    return this.items.filter((i) => i.startsWith(prefix)).length;
  }

  list(): ItemDef[] {
    return this.items.map((id) => ITEM_DEFS[id]).filter(Boolean);
  }

  stacks(): Array<{ item: ItemDef; count: number }> {
    const counts = new Map<string, number>();
    for (const id of this.items) counts.set(id, (counts.get(id) ?? 0) + 1);
    return [...counts.entries()]
      .map(([id, count]) => ({ item: ITEM_DEFS[id], count }))
      .filter((entry) => Boolean(entry.item));
  }

  ids(): string[] {
    return [...this.items];
  }

  restore(ids: string[]): void {
    this.items = ids.filter((id) => ITEM_DEFS[id]);
  }
}
