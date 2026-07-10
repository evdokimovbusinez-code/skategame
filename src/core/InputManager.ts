export class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private justReleasedKeys = new Set<string>();
  private locked = false;

  constructor() {
    window.addEventListener("keydown", (e) => {
      // Prevent the browser default for gameplay keys (Tab = shift focus, Space = page scroll).
      if (e.code === "Tab" || e.code === "Space") e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => {
      if (this.keys.has(e.code)) this.justReleasedKeys.add(e.code);
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.justPressedKeys.clear();
      this.justReleasedKeys.clear();
    });
  }

  /** Call once per frame after gameplay systems have read justPressed state. */
  endFrame(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  isDown(code: string): boolean {
    if (this.locked) return false;
    return this.keys.has(code);
  }

  justPressed(code: string): boolean {
    if (this.locked) return false;
    return this.justPressedKeys.has(code);
  }

  justReleased(code: string): boolean {
    if (this.locked) return false;
    return this.justReleasedKeys.has(code);
  }

  /** Unlocked variant for UI-only interactions (e.g. advancing dialogue). */
  justPressedRaw(code: string): boolean {
    return this.justPressedKeys.has(code);
  }
}
