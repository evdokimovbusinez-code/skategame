import { gameEvents } from "../core/GameEvents";

export type MenuState = "main" | "paused" | "playing";

const CONTROLS_HTML = `
  <div class="controls-grid">
    <span class="key">MOUSE</span><span>click to lock · look around</span>
    <span class="key">W A S D</span><span>push / turn / brake</span>
    <span class="key">SPACE</span><span>ollie · exit grind · jump · climb up a grabbed ledge</span>
    <span class="key">S + SPACE</span><span>nollie pop</span>
    <span class="key">X</span><span>switch stance</span>
    <span class="key">F / G</span><span>kickflip / heelflip</span>
    <span class="key">C / Z</span><span>pop shove-it / frontside shove-it</span>
    <span class="key">Q / E</span><span>frontside / backside body spin</span>
    <span class="key">J / K</span><span>quick punch / heavy shove</span>
    <span class="key">H</span><span>use snack or first aid tape</span>
    <span class="key">I</span><span>open backpack</span>
    <span class="key">TAB</span><span>skate ⇄ walk</span>
    <span class="key">E</span><span>talk · grab item · hold to spray · grab & drag props</span>
    <span class="key">S</span><span>drop from a grabbed ledge (while hanging)</span>
    <span class="key">R</span><span>reset player</span>
    <span class="key">ESC</span><span>pause</span>
  </div>
`;

/**
 * Main/pause menu overlay. Fully DOM-based; the game loop keeps running behind the
 * main menu (nice attract-mode vibe) but input is locked until Start.
 */
export class Menu {
  state: MenuState = "main";
  onStateChange: ((state: MenuState) => void) | null = null;
  /** When this returns true, Escape is ignored — a modal (shop/inventory) owns the key. */
  suppressEscape: (() => boolean) | null = null;

  private root: HTMLDivElement;
  private panel: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.id = "menu-overlay";
    this.panel = document.createElement("div");
    this.panel.id = "menu-panel";
    this.root.appendChild(this.panel);
    container.appendChild(this.root);

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape") {
        if (this.suppressEscape?.()) return; // shop/inventory closes itself instead
        if (this.state === "playing") this.setState("paused");
        else if (this.state === "paused") this.setState("playing");
      }
    });

    this.renderMain();
  }

  private setState(state: MenuState): void {
    this.state = state;
    if (state === "playing") {
      this.root.classList.add("hidden");
    } else {
      this.root.classList.remove("hidden");
      if (state === "paused") this.renderPause();
    }
    this.onStateChange?.(state);
  }

  private button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = "menu-btn" + (primary ? " primary" : "");
    b.textContent = label;
    b.addEventListener("click", () => {
      gameEvents.emit("ui", { kind: "click" });
      onClick();
    });
    return b;
  }

  private renderMain(): void {
    this.panel.innerHTML = `
      <div class="menu-title">SK<span class="accent">8</span>TOWN</div>
      <div class="menu-subtitle">NO FUTURE. KEEP ROLLING.</div>
    `;
    this.panel.appendChild(this.button("DROP IN", () => this.setState("playing"), true));
    this.panel.appendChild(this.button("CONTROLS", () => this.renderControls(() => this.renderMain())));
    const hint = document.createElement("div");
    hint.className = "menu-hint";
    hint.textContent = "WEST BLOCK // SUMMER 2003 // TAPE 01";
    this.panel.appendChild(hint);
  }

  private renderPause(): void {
    this.panel.innerHTML = `<div class="menu-title small">PAUSED</div>`;
    this.panel.appendChild(this.button("RESUME", () => this.setState("playing"), true));
    this.panel.appendChild(this.button("CONTROLS", () => this.renderControls(() => this.renderPause())));
    this.panel.appendChild(this.button("RESET RUN", () => window.location.reload()));
  }

  private renderControls(back: () => void): void {
    this.panel.innerHTML = `<div class="menu-title small">CONTROLS</div>` + CONTROLS_HTML;
    this.panel.appendChild(this.button("BACK", back, true));
  }
}
