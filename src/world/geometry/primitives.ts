import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { faceted } from "../../rendering/ps2Materials";

export interface BuiltPiece {
  mesh: THREE.Mesh;
  colliderDesc: RAPIER.ColliderDesc;
}

/** Axis-aligned box mesh + matching cuboid collider, both pre-positioned/rotated. */
export function buildBox(
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  rotationYDeg = 0,
): BuiltPiece {
  const [w, h, d] = size;
  const geometry = faceted(new THREE.BoxGeometry(w, h, d));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const quat = new THREE.Quaternion().setFromEuler(mesh.rotation);
  const colliderDesc = RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
    .setTranslation(position[0], position[1], position[2])
    .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });

  return { mesh, colliderDesc };
}

/** Flat ground plane with a matching large thin cuboid collider. */
export function buildGround(size: number, material: THREE.Material): BuiltPiece {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;

  const colliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, 0.1, size / 2).setTranslation(0, -0.1, 0);

  return { mesh, colliderDesc };
}
