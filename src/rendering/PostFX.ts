import type { Engine } from "../core/Engine";

/**
 * The UI still carries the photocopied/VHS identity, but the 3D world now renders at
 * native resolution.  The old 0.82 nearest-neighbour upscale was the main reason thin
 * rails, faces and shop dressing broke into obvious pixels in motion.
 */
export const RETRO_RESOLUTION_SCALE = 1;

export function applyPS2VisualPolish(engine: Engine): void {
  engine.setRenderScale(RETRO_RESOLUTION_SCALE);
  // A restrained cinematic bloom: neon and wet highlights glow, concrete remains crisp.
  engine.enableBloom(0.38, 0.34, 0.92);
}
