import * as THREE from "three";
import { asphaltTexture, brickTexture, concreteTexture, metalTexture, woodTexture, graffitiTexture } from "./textures";

/**
 * Flat-shaded MeshLambertMaterial factory — the core of the PS2-era look:
 * per-vertex lighting instead of PBR, hard faceted normals, no smoothing.
 */
export function ps2Material(color: THREE.ColorRepresentation, opts: Partial<THREE.MeshLambertMaterialParameters> = {}): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
}

/** PBR material for the rebuilt environment.  Characters can keep the graphic Lambert
 * treatment while concrete, painted metal and brick gain believable roughness response. */
export function stylizedMaterial(
  color: THREE.ColorRepresentation,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, ...opts });
}

// Shared texture-backed environment materials — created once, reused everywhere.
let cache: Record<string, THREE.MeshStandardMaterial> | null = null;

export function sharedMaterials() {
  if (!cache) {
    cache = {
      asphalt: stylizedMaterial(0x5c5f61, { map: asphaltTexture(14), roughness: 0.88 }),
      concrete: stylizedMaterial(0xa5a39c, { map: concreteTexture(4), roughness: 0.92 }),
      concretePlaza: stylizedMaterial(0x92938e, { map: concreteTexture(10), roughness: 0.86 }),
      brick: stylizedMaterial(0x8b4e45, { map: brickTexture(3), roughness: 0.95 }),
      warmWall: stylizedMaterial(0xa76d51, { map: concreteTexture(3), roughness: 0.9 }),
      wood: stylizedMaterial(0x845f3d, { map: woodTexture(2), roughness: 0.88 }),
      metal: stylizedMaterial(0x80898c, { map: metalTexture(2), roughness: 0.52, metalness: 0.55 }),
      graffiti: stylizedMaterial(0xffffff, { map: graffitiTexture(), transparent: true, roughness: 0.8 }),
      highlight: stylizedMaterial(0xd8ff3e, { emissive: 0x627610, emissiveIntensity: 0.45, roughness: 0.6 }),
      objective: stylizedMaterial(0xffa13d, { emissive: 0x71330c, emissiveIntensity: 0.4, roughness: 0.62 }),
    };
  }
  return cache;
}

/** Ensures hard faceted normals (no smoothing) for a chunky low-poly read. */
export function faceted<T extends THREE.BufferGeometry>(geometry: T): T {
  geometry.computeVertexNormals();
  return (geometry.index ? geometry.toNonIndexed() : geometry) as unknown as T;
}

export const PALETTE = {
  ground: 0x424540,
  concrete: 0x97958f,
  concreteDark: 0x61635f,
  brick: 0x78443f,
  wood: 0x765637,
  metal: 0x747d80,
  boardDeck: 0x20272c,
  boardGrip: 0x161412,
  wheel: 0xd8ff3e,
  skin: 0xd9a066,
  shirt: 0xb93648,
  pants: 0x202b3d,
  npcShirt: 0x3e746c,
  npcPants: 0x3a3a3a,
  grass: 0x46583a,
} as const;
