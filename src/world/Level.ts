import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { PhysicsWorld } from "../core/PhysicsWorld";
import { faceted, sharedMaterials, stylizedMaterial } from "../rendering/ps2Materials";
import { buildGround } from "./geometry/primitives";
import type { RailPiece } from "./geometry/streetKit";
import {
  buildBuildingBlock,
  buildQuarterPipe,
  buildRailSegment,
  buildRamp,
} from "./geometry/streetKit";
import {
  addProp,
  buildBench,
  buildBottle,
  buildCrate,
  buildDumpster,
  buildFencePanel,
  buildPallet,
  buildParkedCar,
  buildPipes,
  buildStreetLamp,
  buildTireStack,
  buildTrafficCone,
  buildTrashBags,
  buildTree,
  buildTruck,
} from "./geometry/props";
import {
  DraggableProp,
  makeDraggableCrate,
  makeDraggableDumpster,
  makeDraggablePallet,
} from "./DraggableProp";
import { graffitiTexture } from "../rendering/textures";

export interface LevelHandles {
  rails: RailPiece[];
  npcSpawn: THREE.Vector3;
  rosaSpawn: THREE.Vector3;
  otisSpawn: THREE.Vector3;
  shopCounter: THREE.Vector3;
  shopExit: THREE.Vector3;
  shopkeeper: { position: THREE.Vector3; facing: THREE.Vector3 };
  graffitiWall: { position: THREE.Vector3; normal: THREE.Vector3 };
  vhsSpots: { itemId: string; position: THREE.Vector3 }[];
  draggableProps: DraggableProp[];
  nightEmissives: THREE.Material[];
  /** Ambient motion for fans, loose signage, steam and neon. */
  update: (dt: number) => void;
}

type BoxPiece = { mesh: THREE.Mesh; colliderDesc: RAPIER.ColliderDesc };
type Animator = (time: number, dt: number) => void;

function visualBox(
  scene: THREE.Scene,
  position: [number, number, number],
  size: [number, number, number],
  material: THREE.Material,
  rotationYDeg = 0,
  castShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(faceted(new THREE.BoxGeometry(...size)), material);
  mesh.position.set(...position);
  mesh.rotation.y = THREE.MathUtils.degToRad(rotationYDeg);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function canvasTexture(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  return texture;
}

function signMaterial(
  title: string,
  subtitle: string,
  accent = "#ff674d",
  background = "#101111",
): THREE.MeshStandardMaterial {
  const texture = canvasTexture(1024, 256, (ctx, width, height) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    const glow = ctx.createLinearGradient(0, 0, width, 0);
    glow.addColorStop(0, "rgba(255,255,255,0.02)");
    glow.addColorStop(0.5, "rgba(255,255,255,0.1)");
    glow.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 16;
    ctx.strokeRect(18, 18, width - 36, height - 36);
    ctx.fillStyle = accent;
    ctx.font = "900 112px Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = accent;
    ctx.shadowBlur = 24;
    ctx.fillText(title, width / 2, height * 0.44);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#eee2ce";
    ctx.font = "700 30px Courier New, monospace";
    ctx.letterSpacing = "8px";
    ctx.fillText(subtitle, width / 2, height * 0.79);
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 70; i++) {
      const x = (i * 149) % width;
      const y = (i * 83) % height;
      ctx.fillRect(x, y, 12 + (i % 5) * 9, 2);
    }
  });
  return new THREE.MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: new THREE.Color(accent),
    emissiveIntensity: 0.85,
    roughness: 0.48,
    metalness: 0.08,
  });
}

function addSign(
  scene: THREE.Scene,
  title: string,
  subtitle: string,
  position: [number, number, number],
  size: [number, number],
  rotationY: number,
  nightEmissives: THREE.Material[],
  accent = "#ff674d",
  background = "#101111",
): THREE.Mesh {
  const material = signMaterial(title, subtitle, accent, background);
  nightEmissives.push(material);
  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const framePosition = new THREE.Vector3(...position).addScaledVector(normal, -0.13);
  const frame = visualBox(
    scene,
    [framePosition.x, framePosition.y, framePosition.z],
    [size[0] + 0.22, size[1] + 0.22, 0.12],
    stylizedMaterial(0x131313, { roughness: 0.5, metalness: 0.35 }),
    THREE.MathUtils.radToDeg(rotationY),
  );
  frame.renderOrder = 1;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), material);
  sign.position.set(...position);
  sign.rotation.y = rotationY;
  sign.castShadow = true;
  sign.renderOrder = 2;
  scene.add(sign);
  return sign;
}

function posterMaterial(
  title: string,
  kicker: string,
  ink = "#ee5a48",
  paper = "#171717",
): THREE.MeshBasicMaterial {
  const texture = canvasTexture(512, 768, (ctx, width, height) => {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = ink;
    ctx.fillRect(20, 20, width - 40, 18);
    ctx.fillStyle = "#e9dfcc";
    ctx.font = "900 72px Impact, Arial Black, sans-serif";
    ctx.textAlign = "center";
    const words = title.split(" ");
    words.forEach((word, index) => ctx.fillText(word, width / 2, 128 + index * 82));
    ctx.strokeStyle = ink;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.58, 116, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(width / 2 - 40, height * 0.56, 18, 0, Math.PI * 2);
    ctx.arc(width / 2 + 40, height * 0.56, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(width / 2 - 68, height * 0.63, 136, 16);
    ctx.fillStyle = "#e9dfcc";
    ctx.font = "700 26px Courier New, monospace";
    ctx.fillText(kicker, width / 2, height - 72);
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 90; i++) {
      const x = (i * 71) % width;
      const y = (i * 137) % height;
      ctx.fillRect(x, y, 4 + (i % 6) * 4, 2);
    }
  });
  return new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

function addPoster(
  scene: THREE.Scene,
  title: string,
  kicker: string,
  position: [number, number, number],
  size: [number, number],
  rotationY = 0,
  ink = "#ee5a48",
): void {
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(...size), posterMaterial(title, kicker, ink));
  poster.position.set(...position);
  poster.rotation.y = rotationY;
  poster.castShadow = true;
  poster.renderOrder = 4;
  scene.add(poster);
}

function addGraffiti(
  scene: THREE.Scene,
  variant: number,
  position: [number, number, number],
  size: [number, number],
  rotationY = 0,
): void {
  const material = new THREE.MeshStandardMaterial({
    map: graffitiTexture(variant),
    transparent: true,
    roughness: 0.88,
    metalness: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  decal.position.set(...position);
  decal.rotation.y = rotationY;
  decal.renderOrder = 3;
  scene.add(decal);
}

function addGroundMark(
  scene: THREE.Scene,
  position: [number, number, number],
  size: [number, number],
  color: THREE.ColorRepresentation,
  rotationY = 0,
  opacity = 0.72,
): void {
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  mark.position.set(...position);
  mark.rotation.set(-Math.PI / 2, 0, rotationY);
  mark.renderOrder = 2;
  scene.add(mark);
}

function addPuddle(
  scene: THREE.Scene,
  position: [number, number, number],
  scale: [number, number],
  rotationY = 0,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x243139,
    roughness: 0.16,
    metalness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.64,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), material);
  puddle.position.set(...position);
  puddle.rotation.set(-Math.PI / 2, 0, rotationY);
  puddle.scale.set(scale[0], scale[1], 1);
  puddle.renderOrder = 2;
  scene.add(puddle);
  return material;
}

function addWindow(
  scene: THREE.Scene,
  position: [number, number, number],
  size: [number, number],
  rotationY: number,
  material: THREE.Material,
  frameMaterial: THREE.Material,
  lit = true,
): void {
  const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(...size), material);
  windowMesh.position.set(...position);
  windowMesh.rotation.y = rotationY;
  windowMesh.castShadow = false;
  scene.add(windowMesh);

  const frame = new THREE.Group();
  frame.position.set(...position);
  frame.rotation.y = rotationY;
  const [width, height] = size;
  const bars: Array<[[number, number, number], [number, number, number]]> = [
    [[0, height / 2 + 0.04, 0.025], [width + 0.14, 0.08, 0.08]],
    [[0, -height / 2 - 0.04, 0.025], [width + 0.14, 0.08, 0.08]],
    [[-width / 2 - 0.04, 0, 0.025], [0.08, height + 0.14, 0.08]],
    [[width / 2 + 0.04, 0, 0.025], [0.08, height + 0.14, 0.08]],
    [[0, 0, 0.03], [0.055, height, 0.06]],
  ];
  if (lit) bars.push([[0, 0, 0.031], [width, 0.045, 0.055]]);
  for (const [pos, dimensions] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), frameMaterial);
    bar.position.set(...pos);
    bar.castShadow = true;
    frame.add(bar);
  }
  scene.add(frame);
}

function addPowerLine(
  scene: THREE.Scene,
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag = 0.75,
): void {
  const mid = start.clone().lerp(end, 0.5);
  mid.y -= sag;
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 18, 0.018, 5, false),
    stylizedMaterial(0x111315, { roughness: 0.7, metalness: 0.15 }),
  );
  cable.castShadow = true;
  scene.add(cable);
}

function addFacadeWindows(
  scene: THREE.Scene,
  origin: [number, number, number],
  columns: number,
  rows: number,
  spacing: [number, number],
  rotationY: number,
  litMaterial: THREE.Material,
  darkMaterial: THREE.Material,
  frameMaterial: THREE.Material,
): void {
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const offset = column - (columns - 1) / 2;
      const side = new THREE.Vector3(Math.cos(rotationY), 0, -Math.sin(rotationY));
      const pos = new THREE.Vector3(...origin)
        .addScaledVector(side, offset * spacing[0])
        .add(new THREE.Vector3(0, row * spacing[1], 0));
      const lit = (column * 5 + row * 3) % 7 < 3;
      addWindow(
        scene,
        [pos.x, pos.y, pos.z],
        [1.15, 1.05],
        rotationY,
        lit ? litMaterial : darkMaterial,
        frameMaterial,
        lit,
      );
    }
  }
}

function addFireEscape(
  scene: THREE.Scene,
  position: [number, number, number],
  width: number,
  floors: number,
  rotationY: number,
  metal: THREE.Material,
): void {
  const root = new THREE.Group();
  root.position.set(...position);
  root.rotation.y = rotationY;
  for (let floor = 0; floor < floors; floor++) {
    const y = floor * 2.25;
    const platform = new THREE.Mesh(new THREE.BoxGeometry(width, 0.09, 0.85), metal);
    platform.position.set(0, y, 0);
    platform.castShadow = true;
    root.add(platform);
    for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.8, 0.055), metal);
      rail.position.set(x, y + 0.42, 0.37);
      root.add(rail);
    }
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, 0.055), metal);
    topRail.position.set(0, y + 0.82, 0.37);
    root.add(topRail);
    if (floor < floors - 1) {
      for (let rung = 0; rung < 8; rung++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.08), metal);
        step.position.set(width * 0.22, y + 0.22 + rung * 0.25, 0.58);
        step.rotation.z = -0.36;
        root.add(step);
      }
    }
  }
  scene.add(root);
}

function displayBoard(
  scene: THREE.Scene,
  position: [number, number, number],
  rotation: [number, number, number],
  color: THREE.ColorRepresentation,
  graphic: THREE.ColorRepresentation,
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(...position);
  group.rotation.set(...rotation);
  const deck = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.7, 6, 12),
    stylizedMaterial(color, { roughness: 0.72 }),
  );
  deck.scale.set(1, 1, 0.16);
  deck.castShadow = true;
  group.add(deck);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.34, 0.018),
    stylizedMaterial(graphic, { emissive: graphic, emissiveIntensity: 0.08 }),
  );
  stripe.position.z = 0.04;
  stripe.rotation.z = -0.24;
  group.add(stripe);
  for (const y of [-0.25, 0.25]) {
    const truck = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.055, 0.08),
      stylizedMaterial(0xb8b7b0, { roughness: 0.42, metalness: 0.68 }),
    );
    truck.position.set(0, y, -0.055);
    group.add(truck);
  }
  scene.add(group);
  return group;
}

function addCeilingFan(
  scene: THREE.Scene,
  position: [number, number, number],
  animators: Animator[],
): void {
  const fan = new THREE.Group();
  fan.position.set(...position);
  const metal = stylizedMaterial(0x27282a, { roughness: 0.45, metalness: 0.65 });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.18, 12), metal);
  hub.rotation.x = Math.PI / 2;
  fan.add(hub);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.22), metal);
    blade.position.x = 0.58;
    blade.rotation.y = i * Math.PI / 2;
    fan.add(blade);
  }
  scene.add(fan);
  animators.push((_time, dt) => {
    fan.rotation.y += dt * 2.4;
  });
}

/** Rebuilt Burnout City block: dense central skatepark, combined skate shop/bodega,
 * enterable abandoned building, apartments, alleys, loading zone and parking lot. */
export function buildLevel(scene: THREE.Scene, physics: PhysicsWorld): LevelHandles {
  const materials = sharedMaterials();
  const rails: RailPiece[] = [];
  const nightEmissives: THREE.Material[] = [];
  const animators: Animator[] = [];
  let elapsed = 0;

  const addPiece = (piece: BoxPiece): THREE.Mesh => {
    scene.add(piece.mesh);
    physics.world.createCollider(piece.colliderDesc);
    return piece.mesh;
  };
  const solidBox = (
    position: [number, number, number],
    size: [number, number, number],
    material: THREE.Material,
    rotationYDeg = 0,
  ): THREE.Mesh => addPiece(buildBuildingBlock(position, size, material, rotationYDeg));
  const addRail = (
    start: [number, number, number],
    end: [number, number, number],
    thickness = 0.11,
  ): void => {
    const rail = buildRailSegment(start, end, thickness, materials.metal);
    rails.push(rail);
    addPiece(rail);
    for (const point of [start, end]) {
      visualBox(
        scene,
        [point[0], Math.max(0.16, point[1] / 2), point[2]],
        [thickness * 0.72, Math.max(0.2, point[1]), thickness * 0.72],
        materials.metal,
      );
    }
  };

  const darkMetal = stylizedMaterial(0x22272b, { roughness: 0.48, metalness: 0.6 });
  const paintedBlack = stylizedMaterial(0x161719, { roughness: 0.7, metalness: 0.12 });
  const paintedRed = stylizedMaterial(0x9e3731, { roughness: 0.76, metalness: 0.08 });
  const dirtyWhite = stylizedMaterial(0xc9c4b8, { roughness: 0.88 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x66818b,
    roughness: 0.18,
    transmission: 0.22,
    transparent: true,
    opacity: 0.48,
    metalness: 0.04,
    clearcoat: 0.6,
    side: THREE.DoubleSide,
  });
  const litWindow = stylizedMaterial(0xffd18a, {
    emissive: 0xff9b42,
    emissiveIntensity: 0.22,
    roughness: 0.34,
  });
  const darkWindow = stylizedMaterial(0x172029, { roughness: 0.26, metalness: 0.18 });
  nightEmissives.push(litWindow);

  // ---------------------------------------------------------------------------
  // City foundation and road hierarchy
  // ---------------------------------------------------------------------------
  addPiece(buildGround(128, stylizedMaterial(0x383b3b, { roughness: 1 })));

  solidBox([0, -0.055, -6], [86, 0.11, 11], materials.asphalt);
  solidBox([18, -0.052, 5], [10, 0.11, 70], materials.asphalt);
  solidBox([-2, -0.045, 8], [31, 0.1, 26], materials.concretePlaza);
  solidBox([-18, -0.045, -10.6], [27, 0.1, 4.2], materials.concrete);
  solidBox([-29.5, -0.045, 8], [5, 0.1, 31], materials.concrete);
  solidBox([29, -0.045, -15], [16, 0.1, 16], materials.asphalt);

  // Curbs and road paint.
  for (const z of [-11.55, -0.45]) {
    solidBox([0, 0.11, z], [86, 0.22, 0.28], dirtyWhite);
  }
  for (const x of [12.85, 23.15]) {
    solidBox([x, 0.11, 7], [0.28, 0.22, 68], dirtyWhite);
  }
  for (let x = -38; x <= 38; x += 8) addGroundMark(scene, [x, 0.025, -6], [3.9, 0.12], 0xd2b765, 0, 0.66);
  for (let z = -27; z <= 31; z += 8) addGroundMark(scene, [18, 0.026, z], [0.12, 3.8], 0xd2b765, Math.PI / 2, 0.6);
  for (let i = 0; i < 9; i++) {
    addGroundMark(scene, [11.8 - i * 0.72, 0.035, -5.4], [0.42, 5.3], 0xe8e2d6, 0, 0.76);
    addGroundMark(scene, [18.5, 0.036, -0.5 + i * 0.72], [5.4, 0.42], 0xe8e2d6, 0, 0.72);
  }

  // Wet breakup and repaired asphalt patches.
  addPuddle(scene, [-5.8, 0.038, -4.1], [3.9, 1.2], 0.18);
  addPuddle(scene, [21.2, 0.04, -13.8], [2.8, 0.9], -0.26);
  addPuddle(scene, [-8.0, 0.042, 8.5], [3.2, 0.86], 0.42);
  addGroundMark(scene, [-29, 0.021, -5], [8.2, 4.8], 0x303436, -0.12, 0.26);
  addGroundMark(scene, [32, 0.022, -14], [5.5, 6.4], 0x2f3435, 0.18, 0.3);

  // ---------------------------------------------------------------------------
  // Central DIY skatepark: actual transitions, stair set, hubbas and grind lines
  // ---------------------------------------------------------------------------
  solidBox([-2, 0.26, 21.0], [31, 0.52, 0.55], materials.concrete);
  solidBox([-17.25, 0.26, 9.0], [0.55, 0.52, 24.5], materials.concrete);
  solidBox([13.25, 0.26, 10.8], [0.55, 0.52, 20.8], materials.concrete);

  addPiece(buildQuarterPipe([-10.6, 0.02, 16.8], 8.0, 4.3, 2.15, materials.concrete, 0, 18));
  visualBox(scene, [-10.6, 2.2, 18.96], [8.1, 0.11, 0.18], materials.metal);
  addGraffiti(scene, 1, [-10.6, 1.02, 19.01], [3.0, 1.55], Math.PI);

  addPiece(buildQuarterPipe([8.8, 0.02, 14.4], 6.5, 3.8, 1.85, materials.concrete, 90, 18));
  visualBox(scene, [10.72, 1.9, 14.4], [0.18, 0.11, 6.6], materials.metal);

  addPiece(buildRamp([-10.9, 0.02, 3.1], 6.3, 4.2, 1.42, materials.concrete, 180));
  solidBox([-10.9, 1.1, 0.9], [6.3, 0.25, 0.65], materials.concrete);
  addGraffiti(scene, 2, [-10.9, 0.8, 0.56], [2.4, 1.1], 0);

  // Stair plaza and twin hubbas.
  const stairCenterX = 0.8;
  const stairStartZ = 4.5;
  for (let i = 0; i < 5; i++) {
    const height = 0.14 * (i + 1);
    solidBox([stairCenterX, height / 2, stairStartZ + i * 0.55], [5.8, height, 0.58], materials.concrete);
  }
  solidBox([-1.75, 0.48, 6.15], [0.65, 0.96, 3.9], materials.concrete);
  solidBox([3.35, 0.48, 6.15], [0.65, 0.96, 3.9], materials.concrete);
  addRail([-0.05, 0.78, 4.2], [-0.05, 0.2, 7.25], 0.105);
  addRail([1.65, 0.78, 4.2], [1.65, 0.2, 7.25], 0.105);

  // Manual pad and long ledges.
  solidBox([2.1, 0.29, 12.2], [5.8, 0.58, 3.6], materials.concrete);
  addPiece(buildRamp([-2.0, 0.01, 12.2], 2.4, 1.9, 0.58, materials.concrete, -90));
  addPiece(buildRamp([6.2, 0.01, 12.2], 2.4, 1.9, 0.58, materials.concrete, 90));
  visualBox(scene, [2.1, 0.61, 10.4], [5.85, 0.08, 0.11], materials.metal);
  visualBox(scene, [2.1, 0.61, 14.0], [5.85, 0.08, 0.11], materials.metal);
  addRail([-7.0, 0.62, 9.4], [-1.2, 0.62, 9.4], 0.11);
  addRail([5.7, 0.58, 18.3], [11.4, 0.58, 18.3], 0.11);

  // DIY texture: chalk lines, stickers, puddles and useful clutter.
  addGroundMark(scene, [-2, 0.035, 10.3], [0.08, 23.4], 0xbbb0a0, 0, 0.32);
  addGroundMark(scene, [-2, 0.036, 10.3], [28.8, 0.08], 0xbbb0a0, 0, 0.26);
  addPuddle(scene, [6.9, 0.04, 7.9], [2.45, 0.72], -0.18);
  addPuddle(scene, [-6.0, 0.042, 13.1], [1.7, 0.52], 0.38);
  addPoster(scene, "DIY OR DIE", "BUILD IT / SKATE IT", [-17.0, 1.55, 13.2], [2.2, 2.9], Math.PI / 2, "#e8614b");
  addProp(buildBench([-5.8, 0, 19.7], Math.PI), scene, physics.world);
  addProp(buildBench([9.0, 0, 20.0], Math.PI), scene, physics.world);
  addProp(buildPallet([10.9, 0, 9.8], 0.18), scene, physics.world);
  addProp(buildTrafficCone([11.5, 0, 8.8]), scene, physics.world);
  addProp(buildTrafficCone([-14.6, 0, 2.0]), scene, physics.world);

  // ---------------------------------------------------------------------------
  // Burnout Skate Co. + bodega: open, enterable, fully dressed interior
  // ---------------------------------------------------------------------------
  const shopX = -18.0;
  const shopZ = -20.0;
  const shopW = 23.0;
  const shopD = 15.0;
  const shopH = 5.35;
  const frontZ = shopZ + shopD / 2;

  solidBox([shopX, shopH / 2, shopZ - shopD / 2], [shopW, shopH, 0.5], materials.brick);
  solidBox([shopX - shopW / 2, shopH / 2, shopZ], [0.5, shopH, shopD], materials.brick);
  solidBox([shopX + shopW / 2, shopH / 2, shopZ], [0.5, shopH, shopD], materials.brick);
  solidBox([shopX, shopH + 0.16, shopZ], [shopW, 0.32, shopD], materials.concrete);
  solidBox([shopX, -0.01, shopZ], [shopW - 0.7, 0.12, shopD - 0.7], stylizedMaterial(0x77736d, { roughness: 0.82 }));

  // Front facade is built around a wide open entrance so the interior is always visible.
  solidBox([shopX - 9.3, 2.0, frontZ], [4.0, 4.0, 0.48], materials.brick);
  solidBox([shopX + 9.3, 2.0, frontZ], [4.0, 4.0, 0.48], materials.brick);
  solidBox([shopX, 4.5, frontZ], [14.8, 1.7, 0.48], materials.brick);
  visualBox(scene, [shopX, 3.55, frontZ + 0.44], [16.3, 0.22, 1.05], paintedBlack);
  visualBox(scene, [shopX, 3.38, frontZ + 0.51], [16.1, 0.08, 0.93], paintedRed);
  for (const x of [shopX - 7.45, shopX + 7.45]) {
    visualBox(scene, [x, 1.85, frontZ + 0.27], [0.35, 3.2, 0.36], darkMetal);
    addWindow(scene, [x + (x < shopX ? -1.65 : 1.65), 1.85, frontZ + 0.28], [2.8, 2.75], 0, glass, darkMetal, false);
  }

  addSign(
    scene,
    "BURNOUT",
    "SKATE CO. / VHS / SNACKS",
    [shopX, 4.48, frontZ + 0.31],
    [8.7, 1.65],
    0,
    nightEmissives,
    "#ff674d",
  );
  const openSign = addSign(
    scene,
    "OPEN",
    "NO FUTURE",
    [shopX - 6.4, 1.45, frontZ + 0.36],
    [1.75, 0.72],
    0,
    nightEmissives,
    "#ff875f",
    "#1b0c0a",
  );
  animators.push((time) => {
    const material = openSign.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 0.72 + Math.sin(time * 8.5) * 0.08 + Math.sin(time * 21) * 0.025;
  });
  addPoster(scene, "SKATE OR DIE", "BURNOUT CITY", [shopX - 11.27, 2.25, shopZ + 2.8], [1.65, 2.35], Math.PI / 2, "#f1b45f");
  addPoster(scene, "NO FUTURE", "JUST PUSH", [shopX + 11.27, 2.25, shopZ + 1.0], [1.65, 2.35], -Math.PI / 2, "#d64e83");

  // Interior wall treatment and ceiling lighting.
  visualBox(scene, [shopX, 2.45, shopZ - 7.2], [21.2, 4.65, 0.12], paintedBlack);
  visualBox(scene, [shopX - 11.15, 2.4, shopZ], [0.12, 4.5, 13.8], stylizedMaterial(0x5b332e));
  visualBox(scene, [shopX + 11.15, 2.4, shopZ], [0.12, 4.5, 13.8], stylizedMaterial(0x5b332e));
  for (const x of [shopX - 6.2, shopX, shopX + 6.2]) {
    const stripMat = stylizedMaterial(0xffe3b0, {
      emissive: 0xffbf70,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
    nightEmissives.push(stripMat);
    visualBox(scene, [x, 5.0, shopZ], [3.4, 0.06, 0.18], stripMat, 0, false);
    const interiorLight = new THREE.PointLight(0xffc58a, 27, 12, 1.7);
    interiorLight.position.set(x, 4.35, shopZ + 0.2);
    interiorLight.castShadow = false;
    scene.add(interiorLight);
  }
  addCeilingFan(scene, [shopX - 3.0, 4.82, shopZ - 1.5], animators);

  // Deck wall: ten unique boards, hooks and a workbench.
  for (let i = 0; i < 9; i++) {
    const z = shopZ - 5.8 + i * 1.35;
    displayBoard(
      scene,
      [shopX - 10.96, 2.45, z],
      [0, Math.PI / 2, i % 2 ? 0.08 : -0.06],
      [0x173c43, 0x9f3e33, 0x2b283f, 0x704c2e][i % 4],
      [0xe95b45, 0xe3c768, 0xd45b95][i % 3],
    );
    visualBox(scene, [shopX - 10.82, 1.52, z], [0.18, 0.05, 0.42], materials.metal, 0, false);
  }
  visualBox(scene, [shopX - 8.4, 0.72, shopZ - 3.2], [2.9, 1.35, 1.05], materials.wood);
  for (let i = 0; i < 4; i++) {
    visualBox(scene, [shopX - 9.25 + i * 0.58, 1.52, shopZ - 3.25], [0.48, 0.22, 0.78], stylizedMaterial(i % 2 ? 0x202124 : 0xd5d0c4), 0);
  }

  // Bodega shelves, drinks and VHS wall.
  for (const x of [shopX - 3.7, shopX + 0.2]) {
    visualBox(scene, [x, 0.75, shopZ - 1.3], [1.25, 1.42, 7.7], materials.wood);
    for (let shelf = 0; shelf < 4; shelf++) {
      visualBox(scene, [x, 0.36 + shelf * 0.38, shopZ - 1.3], [1.38, 0.06, 7.82], darkMetal, 0, false);
      for (let item = 0; item < 7; item++) {
        const color = [0xcf5545, 0xd4a847, 0x517563, 0x405c78][(item + shelf) % 4];
        visualBox(
          scene,
          [x + (shelf % 2 ? 0.32 : -0.32), 0.52 + shelf * 0.38, shopZ - 4.15 + item * 0.95],
          [0.42, 0.24, 0.28],
          stylizedMaterial(color),
          (item % 3 - 1) * 4,
          false,
        );
      }
    }
  }
  visualBox(scene, [shopX + 8.8, 1.4, shopZ - 2.0], [1.3, 2.72, 8.6], darkMetal);
  for (let i = 0; i < 6; i++) {
    addWindow(
      scene,
      [shopX + 8.1, 1.45, shopZ - 5.5 + i * 1.35],
      [1.15, 1.82],
      Math.PI / 2,
      glass,
      darkMetal,
      false,
    );
  }
  addSign(
    scene,
    "COLD",
    "SODA / BEER",
    [shopX + 8.07, 3.08, shopZ - 2.0],
    [0.9, 2.9],
    Math.PI / 2,
    nightEmissives,
    "#70d8dd",
    "#111b20",
  );
  for (let row = 0; row < 3; row++) {
    for (let column = 0; column < 7; column++) {
      visualBox(
        scene,
        [shopX + 10.95, 1.0 + row * 0.55, shopZ - 4.8 + column * 1.18],
        [0.11, 0.38, 0.68],
        stylizedMaterial([0x82413c, 0x314f67, 0x9a7045][(row + column) % 3]),
        0,
        false,
      );
    }
  }
  addSign(
    scene,
    "VHS",
    "REWIND OR DIE",
    [shopX + 10.94, 3.02, shopZ - 0.8],
    [0.75, 2.55],
    -Math.PI / 2,
    nightEmissives,
    "#d95a9b",
    "#171117",
  );

  // Checkout and shopkeeper mission anchors.
  const shopCounter = new THREE.Vector3(shopX + 4.35, 0.95, shopZ + 4.65);
  solidBox([shopCounter.x, 0.5, shopCounter.z], [4.2, 1.0, 1.05], materials.wood);
  visualBox(scene, [shopCounter.x, 1.05, shopCounter.z + 0.48], [4.05, 0.12, 0.11], paintedRed);
  visualBox(scene, [shopCounter.x + 1.15, 1.22, shopCounter.z - 0.06], [0.78, 0.34, 0.58], darkMetal);
  visualBox(scene, [shopCounter.x - 1.2, 1.18, shopCounter.z], [0.72, 0.18, 0.62], paintedBlack);
  addSign(
    scene,
    "BURNOUT",
    "DECKS / WHEELS / TRUCKS",
    [shopCounter.x, 2.8, shopCounter.z - 0.58],
    [3.8, 0.92],
    Math.PI,
    nightEmissives,
    "#f1724f",
  );
  const shopExit = new THREE.Vector3(shopX, 0.1, frontZ + 2.2);
  const shopkeeper = {
    position: new THREE.Vector3(shopCounter.x + 0.35, 0, shopCounter.z - 1.25),
    facing: new THREE.Vector3(0, 0, 1),
  };

  // Shop alley dressing.
  addProp(buildDumpster([shopX - 12.8, 0, shopZ + 3.2], 0.08), scene, physics.world);
  addProp(buildPallet([shopX - 12.9, 0, shopZ + 1.6], -0.2), scene, physics.world);
  addProp(buildTrashBags([shopX - 13.4, 0, shopZ + 4.2]), scene, physics.world);
  addProp(buildBottle([shopX - 12.0, 0, shopZ + 4.7]), scene, physics.world);
  addGraffiti(scene, 0, [shopX - 11.27, 2.25, shopZ - 2.0], [2.5, 2.4], Math.PI / 2);

  // ---------------------------------------------------------------------------
  // Apartment court: layered facade, balconies, fire escape and roof clutter
  // ---------------------------------------------------------------------------
  const apartmentZ = 29.2;
  solidBox([-3, 4.5, apartmentZ], [31.5, 9.0, 1.0], materials.brick);
  solidBox([-19.0, 4.0, 25.5], [1.0, 8.0, 8.4], materials.brick);
  solidBox([13.0, 4.0, 25.5], [1.0, 8.0, 8.4], materials.brick);
  visualBox(scene, [-3, 8.78, apartmentZ - 0.56], [32.0, 0.34, 0.32], dirtyWhite);
  visualBox(scene, [-3, 0.72, apartmentZ - 0.56], [31.8, 0.28, 0.24], stylizedMaterial(0x4a3631));
  addFacadeWindows(
    scene,
    [-3, 2.25, apartmentZ - 0.54],
    8,
    3,
    [3.35, 2.15],
    Math.PI,
    litWindow,
    darkWindow,
    darkMetal,
  );
  for (const x of [-12.8, -3, 6.8]) {
    visualBox(scene, [x, 3.2, apartmentZ - 1.0], [3.2, 0.12, 1.05], darkMetal);
    visualBox(scene, [x, 5.35, apartmentZ - 1.0], [3.2, 0.12, 1.05], darkMetal);
    for (const y of [3.65, 5.8]) {
      visualBox(scene, [x - 1.45, y, apartmentZ - 1.48], [0.06, 0.9, 0.06], darkMetal);
      visualBox(scene, [x + 1.45, y, apartmentZ - 1.48], [0.06, 0.9, 0.06], darkMetal);
      visualBox(scene, [x, y + 0.42, apartmentZ - 1.48], [2.95, 0.06, 0.06], darkMetal);
    }
  }
  addFireEscape(scene, [10.6, 2.05, apartmentZ - 1.05], 2.8, 3, Math.PI, darkMetal);
  solidBox([-3, 0.18, 24.35], [6.5, 0.36, 1.6], materials.concrete);
  visualBox(scene, [-3, 1.45, apartmentZ - 0.62], [2.4, 2.3, 0.18], darkWindow);
  addSign(
    scene,
    "RIDGEWAY",
    "APARTMENTS / 1986",
    [-3, 1.65, apartmentZ - 0.75],
    [4.4, 0.82],
    Math.PI,
    nightEmissives,
    "#f0b05e",
    "#211915",
  );
  // Roof vents/water tank.
  for (const x of [-13.0, -8.2, 2.7, 8.8]) {
    visualBox(scene, [x, 9.25, apartmentZ], [1.35, 0.45, 1.05], darkMetal, (x % 3) * 4);
    visualBox(scene, [x + 0.45, 9.74, apartmentZ], [0.14, 0.8, 0.14], darkMetal);
  }

  // Courtyard trees, seats and laundry lines.
  addProp(buildTree([-14.5, 0, 24.2], 1.15), scene, physics.world);
  addProp(buildTree([8.3, 0, 24.0], 1.0), scene, physics.world);
  addProp(buildBench([-10.6, 0, 24.6], 0.12), scene, physics.world);
  addProp(buildBench([4.4, 0, 24.2], Math.PI - 0.12), scene, physics.world);
  addPowerLine(scene, new THREE.Vector3(-16, 4.1, 23.0), new THREE.Vector3(10.5, 4.0, 23.2), 1.0);

  // ---------------------------------------------------------------------------
  // Enterable abandoned building and mission wall
  // ---------------------------------------------------------------------------
  const abandonedX = 30;
  const abandonedZ = 12;
  solidBox([abandonedX + 6.3, 3.4, abandonedZ], [0.65, 6.8, 16.5], materials.brick);
  solidBox([abandonedX, 3.4, abandonedZ + 8.0], [13.0, 6.8, 0.65], materials.brick);
  solidBox([abandonedX, 3.4, abandonedZ - 8.0], [13.0, 6.8, 0.65], materials.brick);
  // Broken west facade: staggered chunks leave two real entrances.
  solidBox([abandonedX - 6.1, 1.55, abandonedZ - 5.9], [0.65, 3.1, 4.1], materials.brick);
  solidBox([abandonedX - 6.1, 4.85, abandonedZ - 5.9], [0.65, 1.7, 4.1], materials.brick);
  solidBox([abandonedX - 6.1, 4.6, abandonedZ + 1.3], [0.65, 2.2, 4.8], materials.brick);
  solidBox([abandonedX - 6.1, 2.9, abandonedZ + 6.9], [0.65, 5.8, 2.2], materials.brick);
  solidBox([abandonedX, 6.9, abandonedZ], [13.0, 0.34, 16.5], materials.concrete);
  solidBox([abandonedX, -0.01, abandonedZ], [12.1, 0.1, 15.4], stylizedMaterial(0x68645e, { roughness: 0.96 }));

  // Interior rooms, columns, mezzanine and climbable stair.
  solidBox([abandonedX + 2.7, 1.65, abandonedZ + 1.5], [0.35, 3.3, 10.4], stylizedMaterial(0x71625c));
  solidBox([abandonedX + 3.8, 3.45, abandonedZ + 2.4], [4.3, 0.24, 9.2], materials.concrete);
  for (let step = 0; step < 9; step++) {
    const height = 0.34 * (step + 1);
    solidBox(
      [abandonedX - 3.4 + step * 0.48, height / 2, abandonedZ + 5.5],
      [0.52, height, 2.0],
      materials.concrete,
    );
  }
  for (const z of [abandonedZ - 5.2, abandonedZ + 5.2]) {
    visualBox(scene, [abandonedX + 4.5, 3.2, z], [1.9, 2.4, 0.12], darkWindow);
    addWindow(scene, [abandonedX + 4.5, 3.2, z + (z < abandonedZ ? -0.07 : 0.07)], [1.75, 2.2], z < abandonedZ ? 0 : Math.PI, darkWindow, darkMetal, false);
  }
  addFireEscape(scene, [abandonedX - 6.5, 1.25, abandonedZ + 5.3], 2.7, 3, -Math.PI / 2, darkMetal);
  addGraffiti(scene, 1, [abandonedX - 6.44, 2.2, abandonedZ - 5.0], [3.0, 2.4], -Math.PI / 2);
  addGraffiti(scene, 3, [abandonedX - 6.44, 1.8, abandonedZ + 1.8], [2.7, 2.0], -Math.PI / 2);
  addPoster(scene, "BURN BRIDGES", "ENTER AT YOUR OWN RISK", [abandonedX - 6.46, 4.25, abandonedZ + 6.2], [2.0, 2.7], -Math.PI / 2, "#d94b82");
  addProp(buildTrashBags([abandonedX - 4.8, 0, abandonedZ - 3.9]), scene, physics.world);
  addProp(buildCrate([abandonedX - 3.7, 0, abandonedZ + 2.4], 0.2), scene, physics.world);
  addProp(buildPipes([abandonedX + 4.9, 3.55, abandonedZ + 4.1], Math.PI / 2), scene, physics.world);
  const graffitiWall = {
    position: new THREE.Vector3(abandonedX - 6.44, 2.0, abandonedZ - 1.0),
    normal: new THREE.Vector3(-1, 0, 0),
  };

  // ---------------------------------------------------------------------------
  // West loading zone, vacant lot and south-east parking
  // ---------------------------------------------------------------------------
  solidBox([-36.2, 3.5, 5.5], [0.8, 7.0, 22], materials.concrete);
  solidBox([-32.6, 1.05, 0.0], [6.5, 2.1, 6.2], materials.concrete);
  visualBox(scene, [-35.75, 3.5, 5.5], [0.14, 6.5, 20.0], stylizedMaterial(0x4e5050));
  addSign(
    scene,
    "LOADING",
    "AUTHORIZED REBELS ONLY",
    [-35.72, 4.4, 2.0],
    [1.1, 5.0],
    Math.PI / 2,
    nightEmissives,
    "#e2b75a",
    "#171615",
  );
  addProp(buildTruck([-31.0, 0, -2.2], 0.1), scene, physics.world);
  addProp(buildCrate([-30.6, 0, 4.5], -0.15, 1.25), scene, physics.world);
  addProp(buildPallet([-33.4, 0, 8.8], 0.2), scene, physics.world);
  addProp(buildDumpster([-31.2, 0, 10.8], -0.08), scene, physics.world);
  addGraffiti(scene, 2, [-35.74, 2.2, 9.8], [3.6, 2.8], Math.PI / 2);

  // Vacant lot with patchy ground, trees and improvised lounge.
  solidBox([-27.2, -0.045, 22.5], [15.0, 0.1, 13.0], stylizedMaterial(0x51483b, { roughness: 1 }));
  addGroundMark(scene, [-27.0, 0.025, 22.5], [12.4, 0.12], 0x756a55, 0.22, 0.28);
  addGroundMark(scene, [-26.0, 0.026, 20.2], [0.12, 9.6], 0x756a55, -0.36, 0.24);
  addProp(buildTree([-31.7, 0, 25.1], 0.92), scene, physics.world);
  addProp(buildTree([-23.0, 0, 24.7], 0.68), scene, physics.world);
  addProp(buildTireStack([-29.5, 0, 18.5]), scene, physics.world);
  addProp(buildBench([-25.8, 0, 23.2], 0.4), scene, physics.world);
  addProp(buildTrashBags([-22.2, 0, 19.4]), scene, physics.world);
  addPuddle(scene, [-28.1, 0.035, 20.7], [2.1, 0.65], 0.32);

  // Parking lot, parked cars, cones and accessible loading ramp.
  for (const x of [24.5, 29.0, 33.5]) {
    addGroundMark(scene, [x, 0.028, -15], [0.1, 12.0], 0xd6d0c2, 0, 0.56);
  }
  addGroundMark(scene, [29, 0.029, -21], [13.0, 0.1], 0xd6d0c2, 0, 0.56);
  addProp(buildParkedCar([26.8, 0, -16.8], 0.05, 1), scene, physics.world);
  addProp(buildParkedCar([32.0, 0, -12.6], Math.PI + 0.08, 3), scene, physics.world);
  addProp(buildTireStack([35.2, 0, -20.2]), scene, physics.world);
  addProp(buildTrafficCone([24.1, 0, -9.5]), scene, physics.world);
  addProp(buildTrafficCone([25.0, 0, -9.9]), scene, physics.world);
  addPiece(buildRamp([23.6, 0, -4.0], 4.3, 3.2, 0.92, materials.concrete, -90));

  // ---------------------------------------------------------------------------
  // Street life: poles, wires, lamps, fences, steam and distant city mass
  // ---------------------------------------------------------------------------
  const lampPositions: [number, number, number][] = [
    [-28, 0, -10.8],
    [-5, 0, -10.8],
    [11, 0, -10.8],
    [24, 0, -1.0],
    [24, 0, 21.5],
    [-20.5, 0, 21.4],
  ];
  for (const position of lampPositions) {
    nightEmissives.push(...addProp(buildStreetLamp(position), scene, physics.world));
  }
  // A handful of real local lights give wet pavement and faces a readable night response;
  // the remaining lamp props stay emissive-only to keep the scene performant.
  for (const position of [lampPositions[1], lampPositions[2], lampPositions[3], lampPositions[5]]) {
    const pool = new THREE.PointLight(0xffc875, 18, 10, 1.9);
    pool.position.set(position[0] + 0.92, 4.0, position[2]);
    pool.castShadow = false;
    scene.add(pool);
  }

  const poles = [
    new THREE.Vector3(-38, 0, -3),
    new THREE.Vector3(-12, 0, -3),
    new THREE.Vector3(12, 0, -3),
    new THREE.Vector3(38, 0, -3),
  ];
  for (const pole of poles) {
    visualBox(scene, [pole.x, 3.2, pole.z], [0.22, 6.4, 0.22], stylizedMaterial(0x4b3326), 0);
    visualBox(scene, [pole.x, 5.85, pole.z], [2.7, 0.14, 0.14], stylizedMaterial(0x4b3326), 0);
  }
  for (let i = 0; i < poles.length - 1; i++) {
    for (const offset of [-0.65, 0.65]) {
      addPowerLine(
        scene,
        new THREE.Vector3(poles[i].x + offset, 5.9, poles[i].z),
        new THREE.Vector3(poles[i + 1].x + offset, 5.9, poles[i + 1].z),
        0.75,
      );
    }
  }
  addPowerLine(scene, new THREE.Vector3(24, 6.0, -26), new THREE.Vector3(24, 6.2, 32), 1.25);

  // Steam from a broken alley vent.
  const steamMaterial = new THREE.MeshBasicMaterial({
    color: 0xdbe2df,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const steamPuffs: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.22 + i * 0.025, 10, 7), steamMaterial.clone());
    puff.position.set(24.3, 0.3 + i * 0.34, 3.0);
    puff.scale.set(1.5, 0.8, 1.0);
    scene.add(puff);
    steamPuffs.push(puff);
  }
  animators.push((time) => {
    steamPuffs.forEach((puff, index) => {
      const phase = (time * 0.22 + index / steamPuffs.length) % 1;
      puff.position.y = 0.25 + phase * 2.4;
      puff.position.x = 24.3 + Math.sin(time * 0.9 + index) * 0.22;
      puff.scale.set(1.2 + phase, 0.7 + phase * 0.7, 1.0 + phase * 0.5);
      (puff.material as THREE.MeshBasicMaterial).opacity = 0.16 * (1 - phase);
    });
  });

  // Perimeter fences leave the city readable while keeping physics inside the block.
  const fenceHalf = 40;
  addProp(buildFencePanel([0, 0, -fenceHalf], 80, 0), scene, physics.world);
  addProp(buildFencePanel([0, 0, fenceHalf], 80, 0), scene, physics.world);
  addProp(buildFencePanel([-fenceHalf, 0, 0], 80, Math.PI / 2), scene, physics.world);
  addProp(buildFencePanel([fenceHalf, 0, 0], 80, Math.PI / 2), scene, physics.world);

  // Distant skyline silhouettes close the horizon.
  const skyline: Array<[number, number, number, number, number]> = [
    [-48, -46, 17, 12, 0x66524d],
    [-27, -49, 15, 9, 0x74605a],
    [4, -52, 21, 15, 0x5c5052],
    [35, -49, 19, 11, 0x705b52],
    [49, 18, 16, 14, 0x60565a],
    [-48, 28, 20, 10, 0x6c5950],
  ];
  for (const [x, z, width, height, color] of skyline) {
    visualBox(scene, [x, height / 2, z], [width, height, 4.5], stylizedMaterial(color, { roughness: 1 }), 0, false);
    for (let column = 0; column < Math.floor(width / 2.2); column++) {
      for (let row = 0; row < Math.floor(height / 2.0); row++) {
        if ((column * 3 + row * 5) % 4 !== 0) continue;
        visualBox(
          scene,
          [x - width / 2 + 1.2 + column * 2.2, 1.2 + row * 2.0, z + 2.28],
          [0.62, 0.78, 0.04],
          litWindow,
          0,
          false,
        );
      }
    }
  }

  // Draggable pieces remain integrated with parkour and improvised spot building.
  const draggableProps: DraggableProp[] = [
    makeDraggableCrate(scene, physics.world, new THREE.Vector3(-13.8, 0.28, -10.0), 0.15),
    makeDraggablePallet(scene, physics.world, new THREE.Vector3(-12.5, 0.09, -9.5), -0.24),
    makeDraggableDumpster(scene, physics.world, new THREE.Vector3(-10.2, 0.75, -10.2), 0.02),
    makeDraggableCrate(scene, physics.world, new THREE.Vector3(-30.2, 0.28, 12.8), 0.34),
  ];

  // Quest/story anchors.
  const vhsSpots = [
    { itemId: "vhs1", position: new THREE.Vector3(shopX + 8.8, 3.2, shopZ - 0.8) },
    { itemId: "vhs2", position: new THREE.Vector3(-3.0, 8.95, apartmentZ) },
    { itemId: "vhs3", position: new THREE.Vector3(abandonedX + 3.8, 3.75, abandonedZ + 4.0) },
  ];
  const npcSpawn = new THREE.Vector3(-1.5, 0, 10.0);
  const rosaSpawn = new THREE.Vector3(shopX - 5.8, 0, frontZ + 2.0);
  const otisSpawn = new THREE.Vector3(8.2, 0, 17.2);

  return {
    rails,
    npcSpawn,
    rosaSpawn,
    otisSpawn,
    shopCounter,
    shopExit,
    shopkeeper,
    graffitiWall,
    vhsSpots,
    draggableProps,
    nightEmissives,
    update: (dt: number) => {
      elapsed += dt;
      for (const animate of animators) animate(elapsed, dt);
    },
  };
}
