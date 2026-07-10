import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { faceted, ps2Material, sharedMaterials, PALETTE } from "../../rendering/ps2Materials";
import { windowsTexture } from "../../rendering/textures";
import type { BuiltPiece } from "./primitives";

/**
 * Low-poly street prop kit. Each builder returns a visual group plus zero or more
 * simple cuboid colliders (small props like bottles/bags are visual-only — cheaper
 * and they never block skate lines by surprise).
 */
export interface Prop {
  group: THREE.Group;
  colliders: RAPIER.ColliderDesc[];
  /** Materials that should dim by day / glow at night (lamp heads, window panes) — the
   * day/night cycle ramps `.emissiveIntensity` on these each frame. Absent for props with
   * no emissive surface. */
  nightEmissive?: THREE.Material[];
}

function box(size: [number, number, number], material: THREE.Material, pos: [number, number, number], rotY = 0): THREE.Mesh {
  const m = new THREE.Mesh(faceted(new THREE.BoxGeometry(...size)), material);
  m.position.set(...pos);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function cylinder(rTop: number, rBot: number, h: number, seg: number, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(faceted(new THREE.CylinderGeometry(rTop, rBot, h, seg)), material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function colliderAt(half: [number, number, number], world: THREE.Vector3, rotY = 0): RAPIER.ColliderDesc {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0));
  return RAPIER.ColliderDesc.cuboid(...half)
    .setTranslation(world.x, world.y, world.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
}

export function buildBench(position: [number, number, number], rotY = 0): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  for (let i = 0; i < 4; i++) group.add(box([1.75, 0.055, 0.085], mats.wood, [0, 0.43, -0.18 + i * 0.12]));
  for (let i = 0; i < 3; i++) group.add(box([1.75, 0.055, 0.08], mats.wood, [0, 0.72 + i * 0.14, -0.29]));
  group.add(box([0.08, 0.45, 0.5], mats.metal, [-0.8, 0.22, 0]));
  group.add(box([0.08, 0.45, 0.5], mats.metal, [0.8, 0.22, 0]));
  group.add(box([0.08, 0.55, 0.08], mats.metal, [-0.72, 0.55, -0.28], -0.25));
  group.add(box([0.08, 0.55, 0.08], mats.metal, [0.72, 0.55, -0.28], -0.25));
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.9, 0.45, 0.3], world.clone().add(new THREE.Vector3(0, 0.45, 0)), rotY)] };
}

export function buildStreetLamp(position: [number, number, number]): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.add(cylinder(0.16, 0.22, 0.12, 8, mats.metal, [0, 0.06, 0]));
  group.add(cylinder(0.06, 0.09, 4.2, 6, mats.metal, [0, 2.1, 0]));
  group.add(box([0.9, 0.08, 0.12], mats.metal, [0.4, 4.2, 0]));
  group.add(box([0.22, 0.12, 0.12], mats.metal, [0.82, 4.2, 0]));
  const lampMat = ps2Material(0xfff2c0, { emissive: 0xffe9a0, emissiveIntensity: 0.2 });
  const lampHead = new THREE.Mesh(faceted(new THREE.SphereGeometry(0.18, 7, 5)), lampMat);
  lampHead.position.set(0.94, 4.02, 0);
  lampHead.scale.y = 0.72;
  lampHead.castShadow = true;
  group.add(lampHead);
  const world = new THREE.Vector3(...position);
  return {
    group,
    colliders: [colliderAt([0.09, 2.1, 0.09], world.clone().add(new THREE.Vector3(0, 2.1, 0)))],
    nightEmissive: [lampMat],
  };
}

export function buildTrafficCone(position: [number, number, number]): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  group.add(box([0.34, 0.05, 0.34], ps2Material(0xd9531e), [0, 0.03, 0]));
  group.add(cylinder(0.03, 0.15, 0.45, 6, ps2Material(0xe8622a), [0, 0.28, 0]));
  group.add(cylinder(0.085, 0.11, 0.08, 6, ps2Material(0xfff5e0), [0, 0.3, 0]));
  return { group, colliders: [] }; // knock-through visually; no collider so it never ruins a line
}

export function buildCrate(position: [number, number, number], rotY = 0, scale = 1): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const s = 0.55 * scale;
  group.add(box([s, s, s], mats.wood, [0, s / 2, 0]));
  group.add(box([s * 1.04, 0.055 * scale, s * 0.12], ps2Material(0x5a3d26), [0, s * 0.28, s * 0.53]));
  group.add(box([s * 1.04, 0.055 * scale, s * 0.12], ps2Material(0x5a3d26), [0, s * 0.72, s * 0.53]));
  const braceA = box([s * 1.25, 0.045 * scale, s * 0.11], ps2Material(0x6f4a2c), [0, s * 0.5, s * 0.545]);
  braceA.rotation.z = 0.72;
  const braceB = box([s * 1.25, 0.045 * scale, s * 0.11], ps2Material(0x6f4a2c), [0, s * 0.5, s * 0.55]);
  braceB.rotation.z = -0.72;
  group.add(braceA, braceB);
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([s / 2, s / 2, s / 2], world.clone().add(new THREE.Vector3(0, s / 2, 0)), rotY)] };
}

export function buildPallet(position: [number, number, number], rotY = 0): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  for (let i = 0; i < 5; i++) group.add(box([1.1, 0.04, 0.16], mats.wood, [0, 0.14, -0.44 + i * 0.22]));
  for (const x of [-0.45, 0, 0.45]) group.add(box([0.12, 0.1, 1.05], mats.wood, [x, 0.05, 0]));
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.55, 0.09, 0.55], world.clone().add(new THREE.Vector3(0, 0.09, 0)), rotY)] };
}

export function buildTrashBags(position: [number, number, number]): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  const bagMat = ps2Material(0x2a2d33);
  for (let i = 0; i < 3; i++) {
    const bag = new THREE.Mesh(faceted(new THREE.SphereGeometry(0.28 + Math.random() * 0.1, 5, 4)), bagMat);
    bag.position.set((Math.random() - 0.5) * 0.7, 0.22, (Math.random() - 0.5) * 0.7);
    bag.scale.y = 0.75;
    bag.castShadow = true;
    group.add(bag);
  }
  return { group, colliders: [] };
}

export function buildTrashCan(position: [number, number, number]): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.add(cylinder(0.28, 0.24, 0.75, 8, mats.metal, [0, 0.375, 0]));
  group.add(cylinder(0.3, 0.3, 0.05, 8, mats.metal, [0, 0.77, 0]));
  group.add(box([0.42, 0.16, 0.025], ps2Material(0xffd23e), [0, 0.5, 0.265]));
  group.add(box([0.08, 0.08, 0.04], ps2Material(0x202226), [-0.17, 0.83, 0]));
  group.add(box([0.08, 0.08, 0.04], ps2Material(0x202226), [0.17, 0.83, 0]));
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.26, 0.4, 0.26], world.clone().add(new THREE.Vector3(0, 0.4, 0)))] };
}

export function buildBottle(position: [number, number, number]): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  const glass = ps2Material(0x5a7a3a);
  group.add(cylinder(0.035, 0.045, 0.2, 6, glass, [0, 0.1, 0]));
  group.add(cylinder(0.015, 0.03, 0.1, 6, glass, [0, 0.25, 0]));
  group.add(cylinder(0.018, 0.018, 0.025, 6, ps2Material(0xd8d4c8), [0, 0.315, 0]));
  return { group, colliders: [] };
}

export function buildFencePanel(position: [number, number, number], length: number, rotY = 0): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const posts = Math.max(2, Math.round(length / 2) + 1);
  for (let i = 0; i < posts; i++) {
    group.add(cylinder(0.04, 0.04, 1.8, 5, mats.metal, [-length / 2 + (i * length) / (posts - 1), 0.9, 0]));
  }
  group.add(box([length, 0.055, 0.055], mats.metal, [0, 1.65, 0]));
  group.add(box([length, 0.045, 0.045], mats.metal, [0, 0.32, 0]));
  // chain-link reads fine as a translucent dark plane at PS2 fidelity
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(length, 1.7),
    ps2Material(0x3a3f44, { transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  mesh.position.set(0, 0.95, 0);
  group.add(mesh);
  const diagMat = ps2Material(0x9aa0a6, { transparent: true, opacity: 0.48 });
  for (let x = -length / 2 + 0.5; x < length / 2; x += 1.2) {
    const diag = box([0.035, 2.0, 0.025], diagMat, [x, 0.95, 0.02], 0);
    diag.rotation.z = 0.55;
    group.add(diag);
  }
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([length / 2, 0.95, 0.05], world.clone().add(new THREE.Vector3(0, 0.95, 0)), rotY)] };
}

export function buildPipes(position: [number, number, number], rotY = 0): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const pipeMat = ps2Material(0x6f7a6a);
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.22, 0.22, 3.2, 7)), pipeMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 0.22 + (i === 2 ? 0.42 : 0), i === 2 ? 0.22 : (i - 0.5) * 0.46);
    pipe.castShadow = true;
    group.add(pipe);
  }
  void mats;
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([1.6, 0.45, 0.55], world.clone().add(new THREE.Vector3(0, 0.4, 0)), rotY)] };
}

/** Low-profile parked car — body + cabin + 4 wheels, kept deliberately short (top ~0.6)
 * so it sits inside PARKOUR.vaultMaxHeight (0.68): the whole point of a parking-lot row
 * of these is a real car-hopping vault line, not just scenery to skate around. */
export function buildParkedCar(position: [number, number, number], rotY = 0, colorVariant = 0): Prop {
  const bodyColors = [0x8a3a3a, 0x2f4a6b, 0x5a5f52, 0xb8a86a];
  const bodyMat = ps2Material(bodyColors[colorVariant % bodyColors.length]);
  const glassMat = ps2Material(0x2a3038, { transparent: true, opacity: 0.75 });
  const wheelMat = ps2Material(0x181818);
  const trimMat = ps2Material(0xd8d4c8);
  const lightMat = ps2Material(0xfff2c0, { emissive: 0xffd23e, emissiveIntensity: 0.12 });
  const tailMat = ps2Material(0xff5a4e, { emissive: 0x7a1f1b, emissiveIntensity: 0.1 });
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  group.add(box([1.7, 0.32, 3.6], bodyMat, [0, 0.28, 0]));
  group.add(box([1.3, 0.2, 1.8], bodyMat, [0, 0.5, -0.2]));
  group.add(box([1.24, 0.14, 1.68], glassMat, [0, 0.5, -0.2]));
  group.add(box([1.0, 0.035, 0.72], glassMat, [0, 0.63, 0.75]));
  group.add(box([0.08, 0.2, 1.55], glassMat, [-0.66, 0.49, -0.2]));
  group.add(box([0.08, 0.2, 1.55], glassMat, [0.66, 0.49, -0.2]));
  group.add(box([1.72, 0.06, 0.5], trimMat, [0, 0.28, 1.6])); // front bumper
  group.add(box([1.72, 0.06, 0.5], trimMat, [0, 0.28, -1.6])); // rear bumper
  group.add(box([0.22, 0.08, 0.05], lightMat, [-0.48, 0.35, 1.83]));
  group.add(box([0.22, 0.08, 0.05], lightMat, [0.48, 0.35, 1.83]));
  group.add(box([0.22, 0.08, 0.05], tailMat, [-0.48, 0.35, -1.83]));
  group.add(box([0.22, 0.08, 0.05], tailMat, [0.48, 0.35, -1.83]));
  group.add(box([0.08, 0.035, 2.4], ps2Material(0xffd23e), [0, 0.47, 0.12]));
  const wheelPositions: [number, number, number][] = [
    [-0.82, 0.24, 1.15],
    [0.82, 0.24, 1.15],
    [-0.82, 0.24, -1.15],
    [0.82, 0.24, -1.15],
  ];
  for (const p of wheelPositions) {
    const wheel = cylinder(0.24, 0.24, 0.2, 8, wheelMat, p);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
    const hub = cylinder(0.09, 0.09, 0.22, 8, trimMat, p);
    hub.rotation.z = Math.PI / 2;
    group.add(hub);
  }
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.85, 0.3, 1.85], world.clone().add(new THREE.Vector3(0, 0.3, 0)), rotY)] };
}

/** Delivery truck for the Loading Zone — a scaled-up cargo box on wheels. Deliberately
 * NOT vault-height (it's a backdrop/staging anchor for the draggable-crate sandbox, not
 * an obstacle to hop). */
export function buildTruck(position: [number, number, number], rotY = 0): Prop {
  const cabMat = ps2Material(0xc0392b);
  const cargoMat = ps2Material(0xd8d4c8);
  const wheelMat = ps2Material(0x181818);
  const glassMat = ps2Material(0x2a3038, { transparent: true, opacity: 0.75 });
  const trimMat = ps2Material(0xffd23e);
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  group.add(box([2.1, 1.7, 1.9], cabMat, [0, 0.95, 2.2])); // cab
  group.add(box([1.9, 1.2, 1.5], glassMat, [0, 1.55, 3.05])); // windshield block
  group.add(box([2.2, 2.4, 4.8], cargoMat, [0, 1.3, -1.2])); // cargo box
  group.add(box([2.24, 0.08, 3.8], trimMat, [0, 1.55, -1.2]));
  group.add(box([2.26, 0.5, 1.1], ps2Material(0x1f5b6f), [0, 1.45, -1.25]));
  group.add(box([1.0, 0.1, 0.08], ps2Material(0xfff2c0, { emissive: 0xffd23e, emissiveIntensity: 0.08 }), [-0.45, 0.75, 3.18]));
  group.add(box([1.0, 0.1, 0.08], ps2Material(0xfff2c0, { emissive: 0xffd23e, emissiveIntensity: 0.08 }), [0.45, 0.75, 3.18]));
  const wheelPositions: [number, number, number][] = [
    [-1.05, 0.42, 1.6],
    [1.05, 0.42, 1.6],
    [-1.05, 0.42, -0.6],
    [1.05, 0.42, -0.6],
    [-1.05, 0.42, -2.6],
    [1.05, 0.42, -2.6],
  ];
  for (const p of wheelPositions) {
    const wheel = cylinder(0.42, 0.42, 0.3, 8, wheelMat, p);
    wheel.rotation.z = Math.PI / 2;
    group.add(wheel);
    const hub = cylinder(0.16, 0.16, 0.32, 8, cargoMat, p);
    hub.rotation.z = Math.PI / 2;
    group.add(hub);
  }
  const world = new THREE.Vector3(...position);
  return {
    group,
    colliders: [
      colliderAt([1.1, 1.2, 3.4], world.clone().add(new THREE.Vector3(0, 1.2, -1.2)), rotY),
      colliderAt([1.05, 0.85, 0.95], world.clone().add(new THREE.Vector3(0, 0.85, 2.2)), rotY),
    ],
  };
}

/** Trunk + faceted canopy sphere — cheap courtyard greenery. */
export function buildTree(position: [number, number, number], scale = 1): Prop {
  const trunkMat = ps2Material(0x5a4530);
  const canopyMats = [ps2Material(0x4a7a44), ps2Material(0x6d8a48), ps2Material(0x335f3f)];
  const group = new THREE.Group();
  group.position.set(...position);
  group.scale.setScalar(scale);
  group.add(cylinder(0.12, 0.16, 1.4, 6, trunkMat, [0, 0.7, 0]));
  const branchA = box([0.08, 0.7, 0.08], trunkMat, [-0.18, 1.2, 0.04]);
  branchA.rotation.z = 0.5;
  const branchB = box([0.08, 0.6, 0.08], trunkMat, [0.2, 1.15, -0.02]);
  branchB.rotation.z = -0.55;
  group.add(branchA, branchB);
  const blobs: Array<[number, number, number, number, number]> = [
    [0, 1.95, 0, 0.82, 0],
    [-0.42, 1.75, 0.1, 0.58, 1],
    [0.48, 1.78, -0.04, 0.62, 2],
    [0.05, 2.32, -0.08, 0.55, 1],
  ];
  for (const [x, y, z, r, matI] of blobs) {
    const canopy = new THREE.Mesh(faceted(new THREE.SphereGeometry(r, 6, 5)), canopyMats[matI]);
    canopy.position.set(x, y, z);
    canopy.scale.y = 0.82;
    canopy.castShadow = true;
    group.add(canopy);
  }
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.14 * scale, 0.7 * scale, 0.14 * scale], world.clone().add(new THREE.Vector3(0, 0.7 * scale, 0)))] };
}

/** Stack of worn tires — visual-only Parking Lot dressing (no collider, same reasoning
 * as buildTrafficCone: small knock-through clutter shouldn't silently ruin a skate line). */
export function buildTireStack(position: [number, number, number]): Prop {
  const tireMat = ps2Material(0x1c1c1c);
  const group = new THREE.Group();
  group.position.set(...position);
  for (let i = 0; i < 3; i++) {
    const tire = new THREE.Mesh(faceted(new THREE.TorusGeometry(0.32, 0.13, 5, 10)), tireMat);
    tire.rotation.x = Math.PI / 2;
    tire.position.y = 0.13 + i * 0.24;
    tire.castShadow = true;
    group.add(tire);
  }
  return { group, colliders: [] };
}

/** Party snack bundle: cardboard tray + soda cans/chips — readable from across FoodMart. */
export function buildSixPackMesh(): THREE.Group {
  const group = new THREE.Group();
  const carrier = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.42, 0.13, 0.28)), ps2Material(0xb18a55));
  carrier.position.y = 0.07;
  carrier.castShadow = true;
  group.add(carrier);
  const handle = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.08, 0.16, 0.28)), ps2Material(0x6c4b2f));
  handle.position.y = 0.18;
  handle.castShadow = true;
  group.add(handle);
  const canMats = [ps2Material(0xb3392e), ps2Material(0xd6b56d), ps2Material(0x344a5f)];
  for (let i = 0; i < 4; i++) {
    const can = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 8)), canMats[i % canMats.length]);
    can.position.set(-0.13 + (i % 2) * 0.26, 0.2, -0.065 + Math.floor(i / 2) * 0.13);
    can.castShadow = true;
    group.add(can);
    const lid = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.037, 0.037, 0.012, 8)), ps2Material(0xd8d4c8));
    lid.position.set(can.position.x, 0.297, can.position.z);
    group.add(lid);
  }
  const chips = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.13, 0.26, 0.08)), ps2Material(0xd8aa42));
  chips.position.set(0, 0.24, 0.02);
  chips.rotation.z = -0.18;
  chips.castShadow = true;
  group.add(chips);
  return group;
}

/** Big steel dumpster — tall enough to start a mantle chain up to an awning/roof. */
export function buildDumpster(position: [number, number, number], rotY = 0): Prop {
  const mats = sharedMaterials();
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const bodyMat = ps2Material(0x3f6b52);
  group.add(box([1.7, 1.3, 1.0], bodyMat, [0, 0.75, 0]));
  group.add(box([1.75, 0.08, 1.05], mats.metal, [0, 1.44, 0])); // lid rim
  const lid = box([1.65, 0.08, 0.9], ps2Material(0x2b4237), [0, 1.58, -0.08]);
  lid.rotation.x = -0.18;
  group.add(lid);
  group.add(box([0.2, 0.25, 0.06], bodyMat, [-0.6, 0.35, 0.52])); // front detail
  group.add(box([0.2, 0.25, 0.06], bodyMat, [0.6, 0.35, 0.52]));
  group.add(box([1.05, 0.12, 0.065], ps2Material(0xffd23e), [0, 0.9, 0.535]));
  group.add(box([0.16, 0.16, 0.08], ps2Material(0x181818), [-0.55, 0.1, 0.38]));
  group.add(box([0.16, 0.16, 0.08], ps2Material(0x181818), [0.55, 0.1, 0.38]));
  const world = new THREE.Vector3(...position);
  return { group, colliders: [colliderAt([0.87, 0.75, 0.52], world.clone().add(new THREE.Vector3(0, 0.75, 0)), rotY)] };
}

/** Flat window-grid panel glued onto a building facade (visual only, offset to avoid z-fighting). */
export function buildWindowPanel(
  position: [number, number, number],
  width: number,
  height: number,
  rotY = 0,
  cols = 4,
  rows = 3,
): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const tex = windowsTexture(cols, rows);
  const panelMat = new THREE.MeshLambertMaterial({
    map: tex,
    emissive: 0x6a5028,
    emissiveMap: tex,
    emissiveIntensity: 0.2,
  });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), panelMat);
  group.add(panel);
  return { group, colliders: [], nightEmissive: [panelMat] };
}

export function buildShopSign(position: [number, number, number], rotY = 0): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  // Canvas texture with the shop name — crisp low-res lettering. Near-white-hot yellow
  // (not the softer #ffd23e used elsewhere) so it reliably clears the bloom threshold —
  // this sign is meant to read as an actual lit neon tube, not just a bright-colored panel.
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#1a1c22";
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = "#fff2b0";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FOOD MART", 64, 17);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(5.1, 0.95),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  group.add(sign);
  return { group, colliders: [] };
}

/** Small neon-red "OPEN" placard — same hot/toneMapped-false trick as the shop sign,
 * meant to sit in the minimart's window/doorway as a second, smaller bloom source. */
export function buildOpenSign(position: [number, number, number], rotY = 0): Prop {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.y = rotY;
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 32;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#160a0a";
  ctx.fillRect(0, 0, 96, 32);
  ctx.fillStyle = "#ff5a4e";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("OPEN", 48, 17);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.4),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  group.add(sign);
  return { group, colliders: [] };
}

/** Convenience: register a prop's visuals + colliders into scene/physics in one call.
 * Returns the prop's night-reactive materials (if any) so callers can collect them for
 * `DayNightCycle`. */
export function addProp(prop: Prop, scene: THREE.Scene, world: RAPIER.World): THREE.Material[] {
  scene.add(prop.group);
  for (const c of prop.colliders) world.createCollider(c);
  return prop.nightEmissive ?? [];
}

export type { BuiltPiece };
export { PALETTE };
