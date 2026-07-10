import * as THREE from "three";

/** Simple sphere-radius volume trigger — distance check is plenty at this entity count. */
export class TriggerZone {
  center: THREE.Vector3;
  radius: number;
  private wasInside = false;

  constructor(center: THREE.Vector3, radius: number) {
    this.center = center;
    this.radius = radius;
  }

  isInside(playerPos: THREE.Vector3): boolean {
    return this.center.distanceTo(playerPos) <= this.radius;
  }

  /** Edge-triggered: true only on the frame the player crosses into the zone. */
  checkEnter(playerPos: THREE.Vector3): boolean {
    const inside = this.isInside(playerPos);
    const entered = inside && !this.wasInside;
    this.wasInside = inside;
    return entered;
  }

  reset(): void {
    this.wasInside = false;
  }
}
