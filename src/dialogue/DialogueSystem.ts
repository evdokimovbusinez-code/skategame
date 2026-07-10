import type { DialogueTree, DialogueNode, DialogueChoice } from "./DialogueData";
import type { HUD } from "../ui/HUD";
import type { InputManager } from "../core/InputManager";

/**
 * Dialogue player with branching: advances line-by-line, then either follows `next`
 * (linear) or presents `choices` — picked with 1/2/3 keys or mouse click. A chosen
 * option can fire `onPick` (rewards, flags) before jumping to its `next` node.
 */
export class DialogueSystem {
  isOpen = false;

  private hud: HUD;
  private input: InputManager;
  private tree: DialogueTree | null = null;
  private nodeId: string | null = null;
  private lineIndex = 0;
  private onComplete: (() => void) | null = null;
  private awaitingChoice: DialogueChoice[] | null = null;

  constructor(hud: HUD, input: InputManager) {
    this.hud = hud;
    this.input = input;
  }

  start(tree: DialogueTree, onComplete?: () => void): void {
    this.tree = tree;
    this.nodeId = tree.start;
    this.lineIndex = 0;
    this.onComplete = onComplete ?? null;
    this.awaitingChoice = null;
    this.isOpen = true;
    this.input.setLocked(true);
    this.enterNode();
  }

  /** Call once per frame while a dialogue may be open (input lock is bypassed on purpose). */
  update(): void {
    if (!this.isOpen) return;

    if (this.awaitingChoice) {
      for (let i = 0; i < this.awaitingChoice.length; i++) {
        if (this.input.justPressedRaw(`Digit${i + 1}`)) {
          this.pick(i);
          return;
        }
      }
      return; // E/Space do nothing while a choice is pending — the player must decide
    }

    if (this.input.justPressedRaw("KeyE") || this.input.justPressedRaw("Space")) {
      this.advance();
    }
  }

  /** Also used by DialogueUI click handlers. */
  pick(index: number): void {
    const choice = this.awaitingChoice?.[index];
    if (!choice) return;
    this.awaitingChoice = null;
    choice.onPick?.();
    if (choice.next) {
      this.nodeId = choice.next;
      this.lineIndex = 0;
      this.enterNode();
    } else {
      this.close();
    }
  }

  private currentNode(): DialogueNode | null {
    if (!this.tree || !this.nodeId) return null;
    return this.tree.nodes[this.nodeId] ?? null;
  }

  private enterNode(): void {
    const node = this.currentNode();
    if (!node) {
      this.close();
      return;
    }
    node.onEnter?.();
    this.showLine();
  }

  private showLine(): void {
    const node = this.currentNode();
    if (!node) {
      this.close();
      return;
    }
    const line = node.lines[this.lineIndex];
    const isLastLine = this.lineIndex === node.lines.length - 1;
    const choices = isLastLine && node.choices?.length ? node.choices : null;
    this.hud.showDialogue(line.speaker, line.text, choices?.map((c) => c.text) ?? null, (i) => this.pick(i));
    if (choices) this.awaitingChoice = choices;
  }

  private advance(): void {
    const node = this.currentNode();
    if (!node) {
      this.close();
      return;
    }
    this.lineIndex++;
    if (this.lineIndex < node.lines.length) {
      this.showLine();
      return;
    }
    if (node.next) {
      this.nodeId = node.next;
      this.lineIndex = 0;
      this.enterNode();
    } else {
      this.close();
    }
  }

  close(): void {
    this.isOpen = false;
    this.awaitingChoice = null;
    this.hud.hideDialogue();
    this.input.setLocked(false);
    const cb = this.onComplete;
    this.onComplete = null;
    this.tree = null;
    this.nodeId = null;
    cb?.();
  }
}
