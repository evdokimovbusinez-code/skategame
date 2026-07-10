import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

export type UpdateFn = (dt: number) => void;

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();
  private updateCallbacks: UpdateFn[] = [];
  private running = false;
  private renderScale = 1;
  // Optional — most of the scene renders straight to screen via `renderer.render()` same
  // as always. Only set up (via enableBloom) so the one PostFX pass this game uses has
  // somewhere to live without forcing every frame through a composer for no reason.
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private gtaoPass: GTAOPass | null = null;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      500,
    );
    this.camera.position.set(0, 3, 8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Filmic highlight roll-off is important now that wet asphalt, windows and neon all
    // share the frame.  It keeps the sunset warm without clipping the shop interior.
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // updateStyle=false everywhere: the canvas is sized by CSS (100%/100% in index.html).
    // Letting setSize stamp inline pixel styles once wrote `0px` when a headless viewport
    // reported zero size at boot, permanently hiding the canvas.
    this.renderer.setSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), false);
    container.appendChild(this.renderer.domElement);

    // Not using Timer.connect(document): Page Visibility integration zeroes delta while
    // hidden/backgrounded (including headless preview tooling), which would freeze the
    // whole game loop. The dt clamp below already handles large deltas after a tab switch.
    window.addEventListener("resize", () => this.onResize());
  }

  onUpdate(fn: UpdateFn): void {
    this.updateCallbacks.push(fn);
  }

  /** Adjust internal render resolution. The rebuilt world uses 1.0/native resolution. */
  setRenderScale(scale: number): void {
    this.renderScale = scale;
    this.renderer.domElement.style.imageRendering = scale < 1 ? "pixelated" : "auto";
    this.onResize();
  }

  /** Sets up bloom (only emissive-bright pixels above `threshold` glow) so neon signage
   * actually reads as lit instead of just being a bright flat color. Threshold is
   * deliberately high — the flat-lit PS2 geometry (walls, ground, most props) should
   * never bloom, only genuinely emissive materials (shop signs, window glow, lamp heads)
   * crossing that brightness should. Safe to call once; re-calling just retunes the pass. */
  enableBloom(strength = 0.55, radius = 0.35, threshold = 0.82): void {
    if (!this.composer) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.gtaoPass = new GTAOPass(this.scene, this.camera, 1, 1);
      this.gtaoPass.blendIntensity = 0.62;
      this.gtaoPass.updateGtaoMaterial({ radius: 0.34, thickness: 1.4, distanceFallOff: 1.05, samples: 12 });
      this.gtaoPass.updatePdMaterial({ radius: 7, rings: 2, samples: 12 });
      this.composer.addPass(this.gtaoPass);
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    } else if (this.bloomPass) {
      this.bloomPass.strength = strength;
      this.bloomPass.radius = radius;
      this.bloomPass.threshold = threshold;
    }
    this.onResize();
  }

  private lastW = 0;
  private lastH = 0;

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === 0 || h === 0) return; // headless/hidden viewport — retry when it reports real size
    this.lastW = w;
    this.lastH = h;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // `false` keeps the canvas CSS size at the container's full size while the internal
    // drawing buffer shrinks — that mismatch is what makes the upscale trick work.
    const rw = w * this.renderScale;
    const rh = h * this.renderScale;
    this.renderer.setSize(rw, rh, false);
    this.composer?.setSize(rw, rh);
  }

  /** Called each frame: catches viewports that report 0×0 at boot and grow later. */
  private checkResize(): void {
    if (window.innerWidth !== this.lastW || window.innerHeight !== this.lastH) this.onResize();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (timestamp: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      this.checkResize();
      this.timer.update(timestamp);
      const dt = Math.min(this.timer.getDelta(), 1 / 20); // clamp to avoid spiral of death on tab-switch
      for (const cb of this.updateCallbacks) cb(dt);
      this.renderOnce();
    };
    requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
  }

  /** Renders one frame through the same path the RAF loop uses (composer/bloom when set
   * up, otherwise a plain render). Exposed so manual/debug renders — e.g. taking a
   * screenshot while the loop is stopped for deterministic stepping — see bloom too. */
  renderOnce(): void {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
