import * as THREE from "three";

/**
 * Pointer-lock mouse look: click the canvas to lock the pointer, then mouse movement
 * turns the character itself (yaw) and tilts the camera (pitch) — "go where the mouse
 * points," not a free orbit independent of movement. See BUG_AUDIT.md.
 */
export class MouseLook {
  pitch = 0; // radians, 0 = level with the default follow height, purely a camera tilt

  private sensitivity = 0.0022;
  private minPitch = -0.85;
  private maxPitch = 0.75;
  private locked = false;
  private pendingYawDelta = 0; // accumulated mouse-x since last consume() call

  constructor(canvas: HTMLCanvasElement) {
    canvas.style.cursor = "pointer";

    canvas.addEventListener("click", () => {
      if (!this.locked) canvas.requestPointerLock();
    });
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.pendingYawDelta -= e.movementX * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * this.sensitivity, this.minPitch, this.maxPitch);
    });
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** Call once per frame from the player controller: returns and clears the yaw turned
   * since the last call, to be added directly to the character's facing. */
  consumeYawDelta(): number {
    const d = this.pendingYawDelta;
    this.pendingYawDelta = 0;
    return d;
  }

  exit(): void {
    if (this.locked) document.exitPointerLock();
  }
}
