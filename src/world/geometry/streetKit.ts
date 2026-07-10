import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import type { BuiltPiece } from "./primitives";
import { buildBox } from "./primitives";

export function buildCurb(
  position: [number, number, number],
  length: number,
  material: THREE.Material,
  rotationYDeg = 0,
): BuiltPiece {
  return buildBox([length, 0.35, 0.4], position, material, rotationYDeg);
}

export function buildBuildingBlock(
  position: [number, number, number],
  size: [number, number, number],
  material: THREE.Material,
  rotationYDeg = 0,
): BuiltPiece {
  return buildBox(size, position, material, rotationYDeg);
}

/**
 * Triangular-prism skate ramp. Rises from y=0 at the back edge to `height` at
 * the front edge (z = +length/2 locally), then rotated/positioned in world space.
 * Uses a convex-hull collider built from the same 6 vertices as the mesh, so
 * visual and physical geometry are always in sync.
 */
export function buildRamp(
  position: [number, number, number],
  width: number,
  length: number,
  height: number,
  material: THREE.Material,
  rotationYDeg = 0,
): BuiltPiece {
  const w = width / 2;
  const l = length / 2;

  const A = [-w, 0, -l];
  const B = [w, 0, -l];
  const C = [-w, 0, l];
  const D = [w, 0, l];
  const E = [-w, height, l];
  const F = [w, height, l];

  const tris: number[][] = [
    A, B, D, A, D, C, // bottom
    C, D, F, C, F, E, // front vertical wall
    A, F, B, A, E, F, // top slope
    A, C, E, // left triangle
    B, F, D, // right triangle
  ];

  const positions = new Float32Array(tris.length * 3);
  tris.forEach((v, i) => {
    positions[i * 3] = v[0];
    positions[i * 3 + 1] = v[1];
    positions[i * 3 + 2] = v[2];
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const hullPoints = new Float32Array([...A, ...B, ...C, ...D, ...E, ...F]);
  const quat = new THREE.Quaternion().setFromEuler(mesh.rotation);
  const colliderDesc = (RAPIER.ColliderDesc.convexHull(hullPoints) as RAPIER.ColliderDesc)
    .setTranslation(position[0], position[1], position[2])
    .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

  return { mesh, colliderDesc };
}

/** Smooth quarter-pipe transition with matching trimesh collision.  The old park was
 * made entirely from wedges; this curved profile gives pumping and wall rides a proper
 * skate-park silhouette while staying deterministic and asset-free. */
export function buildQuarterPipe(
  position: [number, number, number],
  width: number,
  depth: number,
  height: number,
  material: THREE.Material,
  rotationYDeg = 0,
  segments = 16,
): BuiltPiece {
  const vertices: number[] = [];
  const indices: number[] = [];
  const halfW = width / 2;

  // Per slice: top-left, top-right, ground-left, ground-right.
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const z = -depth / 2 + t * depth;
    // Quarter-circle ease: flat entry, increasingly steep transition, vertical lip.
    const y = height * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    vertices.push(-halfW, y, z, halfW, y, z, -halfW, 0, z, halfW, 0, z);
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 4;
    const b = (i + 1) * 4;
    // Skate surface.
    indices.push(a, a + 1, b + 1, a, b + 1, b);
    // Closed side cheeks.
    indices.push(a + 2, a, b, a + 2, b, b + 2);
    indices.push(a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
  }
  const last = segments * 4;
  indices.push(last + 2, last + 3, last + 1, last + 2, last + 1, last);

  const geometry = new THREE.BufferGeometry();
  const positionArray = new Float32Array(vertices);
  const indexArray = new Uint32Array(indices);
  geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
  geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const quat = new THREE.Quaternion().setFromEuler(mesh.rotation);
  const colliderDesc = RAPIER.ColliderDesc.trimesh(positionArray, indexArray)
    .setTranslation(position[0], position[1], position[2])
    .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

  return { mesh, colliderDesc };
}

export interface RailPiece extends BuiltPiece {
  start: THREE.Vector3;
  end: THREE.Vector3;
}

/** Thin oriented box connecting two points — used for grind rails and ledges. */
export function buildRailSegment(
  start: [number, number, number],
  end: [number, number, number],
  thickness: number,
  material: THREE.Material,
): RailPiece {
  const s = new THREE.Vector3(...start);
  const e = new THREE.Vector3(...end);
  const mid = s.clone().add(e).multiplyScalar(0.5);
  const dir = e.clone().sub(s);
  const length = dir.length();
  const yaw = Math.atan2(dir.x, dir.z);

  const built = buildBox([thickness, thickness, length], [mid.x, mid.y, mid.z], material, THREE.MathUtils.radToDeg(yaw));

  return { ...built, start: s, end: e };
}
