import * as THREE from "three";
import { TIME_OF_DAY } from "../config/constants";

type Keyframe = (typeof TIME_OF_DAY.keyframes)[number];

const colorA = new THREE.Color();
const colorB = new THREE.Color();
const vecA = new THREE.Vector3();
const vecB = new THREE.Vector3();
const skyDay = new THREE.Color(0xffffff);
const skyNight = new THREE.Color(0x34405c);

function lerpColor(a: number, b: number, t: number): THREE.Color {
  return colorA.setHex(a).lerp(colorB.setHex(b), t);
}

/**
 * Drives a slow, automatic, real-time day/night cycle. `time01` (0-1, wraps) advances
 * each frame and is interpolated across the four `TIME_OF_DAY.keyframes` (dawn/day/dusk/
 * night), driving sun position/color/intensity, hemisphere + ambient fill, fog/background
 * color, and how bright night-reactive props (lamps, windows — collected into
 * `nightEmissives` at level-build time) glow.
 *
 * `setTime01()` is exposed on `window.__debug` so any time of day can be jumped to
 * instantly for testing instead of waiting real minutes.
 */
export class DayNightCycle {
  time01 = TIME_OF_DAY.startTime01;

  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private ambient: THREE.AmbientLight;
  private fog: THREE.Fog;
  private scene: THREE.Scene;
  private nightEmissives: THREE.Material[];
  private skyMaterial: THREE.MeshBasicMaterial;

  constructor(
    sun: THREE.DirectionalLight,
    hemi: THREE.HemisphereLight,
    ambient: THREE.AmbientLight,
    fog: THREE.Fog,
    scene: THREE.Scene,
    nightEmissives: THREE.Material[],
    skyMaterial: THREE.MeshBasicMaterial,
  ) {
    this.sun = sun;
    this.hemi = hemi;
    this.ambient = ambient;
    this.fog = fog;
    this.scene = scene;
    this.nightEmissives = nightEmissives;
    this.skyMaterial = skyMaterial;
    this.apply();
  }

  update(dt: number): void {
    this.time01 = (this.time01 + dt / TIME_OF_DAY.cycleDurationSeconds) % 1;
    this.apply();
  }

  setTime01(t: number): void {
    this.time01 = ((t % 1) + 1) % 1;
    this.apply();
  }

  private apply(): void {
    const frames = TIME_OF_DAY.keyframes;
    let i = frames.length - 1;
    for (let k = 0; k < frames.length; k++) {
      if (this.time01 < frames[k].t) {
        i = k - 1;
        break;
      }
    }
    const a: Keyframe = frames[i < 0 ? frames.length - 1 : i];
    const b: Keyframe = frames[(i + 1) % frames.length];
    const span = ((b.t - a.t + 1) % 1) || 1;
    const local = ((this.time01 - a.t + 1) % 1);
    const t = Math.min(1, local / span);

    this.sun.position.copy(vecA.set(...a.sunPos).lerp(vecB.set(...b.sunPos), t));
    this.sun.color.copy(lerpColor(a.sunColor, b.sunColor, t));
    this.sun.intensity = THREE.MathUtils.lerp(a.sunIntensity, b.sunIntensity, t);

    this.hemi.color.copy(lerpColor(a.hemiSky, b.hemiSky, t));
    this.hemi.groundColor.copy(lerpColor(a.hemiGround, b.hemiGround, t));
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemiIntensity, b.hemiIntensity, t);

    this.ambient.color.copy(lerpColor(a.ambientColor, b.ambientColor, t));
    this.ambient.intensity = THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t);

    const fogColor = lerpColor(a.fogColor, b.fogColor, t);
    this.fog.color.copy(fogColor);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fogColor);

    const nightFactor = THREE.MathUtils.lerp(a.nightFactor, b.nightFactor, t);
    // The painted sunset skybox is shared across the cycle; tinting it keeps the graphic
    // clouds and banding while preventing a bright orange dome from surviving at midnight.
    this.skyMaterial.color.copy(skyDay).lerp(skyNight, Math.min(0.86, nightFactor * 0.86));
    const emissiveIntensity = THREE.MathUtils.lerp(
      TIME_OF_DAY.emissiveDayIntensity,
      TIME_OF_DAY.emissiveNightIntensity,
      nightFactor,
    );
    for (const mat of this.nightEmissives) {
      (mat as THREE.MeshLambertMaterial).emissiveIntensity = emissiveIntensity;
    }
  }
}
