import * as THREE from "three";
import { CAMERA } from "../config/constants";

export interface FollowCameraParams {
  distance: number;
  height: number;
  lookAheight: number;
  smoothing: number;
}

/**
 * Third-person orbit camera: yaw/pitch come from mouse-look (MouseLook) layered on top
 * of the player's facing direction, so looking around is fully decoupled from movement.
 * Also handles look-ahead, speed-scaled FOV, and decaying impact shake.
 */
export class FollowCamera {
  private desired = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private shakeMagnitude = 0;
  private currentFov = CAMERA.baseFov;

  /** Kick the camera with a shake impulse (0..~0.5 reads well). */
  addShake(magnitude: number): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
  }

  update(
    camera: THREE.PerspectiveCamera,
    targetPos: THREE.Vector3,
    targetYaw: number,
    params: FollowCameraParams,
    dt: number,
    speedFrac = 0,
    mouseYaw = 0,
    mousePitch = 0,
  ): void {
    const yaw = targetYaw + mouseYaw;
    const cosPitch = Math.cos(mousePitch);
    const sinPitch = Math.sin(mousePitch);

    // Orbit direction from player to camera, pitch tilts it up/down around the target.
    const dir = new THREE.Vector3(Math.sin(yaw) * cosPitch, sinPitch, Math.cos(yaw) * cosPitch);
    this.desired
      .copy(targetPos)
      .addScaledVector(dir, -params.distance)
      .add(new THREE.Vector3(0, params.height, 0));

    const t = 1 - Math.exp(-params.smoothing * dt);
    camera.position.lerp(this.desired, t);

    // Shake: cheap random offset with exponential decay. Reads as impact, costs nothing.
    if (this.shakeMagnitude > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shakeMagnitude;
      camera.position.y += (Math.random() - 0.5) * this.shakeMagnitude;
      this.shakeMagnitude *= Math.exp(-CAMERA.shakeDecay * dt);
    } else {
      this.shakeMagnitude = 0;
    }

    // Look-ahead follows movement direction (not the mouse), so free-look doesn't fight
    // the "see where you're going" bias.
    const facing = new THREE.Vector3(Math.sin(targetYaw), 0, Math.cos(targetYaw));
    const lookAhead = facing.clone().multiplyScalar(CAMERA.lookAheadDistance * (0.4 + 0.6 * speedFrac));
    this.lookTarget
      .copy(targetPos)
      .add(new THREE.Vector3(0, params.lookAheight, 0))
      .add(lookAhead);
    camera.lookAt(this.lookTarget);

    const targetFov = CAMERA.baseFov + CAMERA.maxFovBoost * speedFrac;
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, Math.min(1, CAMERA.fovSmoothing * dt));
    if (Math.abs(camera.fov - this.currentFov) > 0.01) {
      camera.fov = this.currentFov;
      camera.updateProjectionMatrix();
    }
  }
}
