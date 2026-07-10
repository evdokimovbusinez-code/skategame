import * as THREE from "three";
import { ps2Material, faceted } from "../../rendering/ps2Materials";
import type { HumanoidBones } from "./HumanoidRig";

export type Accessory =
  | "cap"
  | "bandana"
  | "beanie"
  | "mohawk"
  | "streetHair"
  | "vest"
  | "streetJacket"
  | "localSkater"
  | "none";

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, pos: [number, number, number]): THREE.Mesh {
  const m = new THREE.Mesh(faceted(geometry), material);
  m.position.set(...pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function patchMaterial(kind: "front-skull" | "back-skull" | "pants-tag" | "anarchy"): THREE.Material {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#3a332d";
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 118);

  if (kind === "front-skull" || kind === "back-skull") {
    ctx.fillStyle = "#d8d0c5";
    ctx.fillRect(42, 42, 44, 48);
    ctx.beginPath();
    ctx.arc(64, 42, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(37, 50, 54, 36);
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(52, 40, 9, 0, Math.PI * 2);
    ctx.arc(76, 40, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(60, 47, 8, 16);
    ctx.fillRect(46, 72, 36, 5);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 3;
    for (let x = 53; x <= 75; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, 68);
      ctx.lineTo(x, 88);
      ctx.stroke();
    }
    ctx.fillStyle = "#bf463e";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(kind === "front-skull" ? "OIL FOO" : "DIE FAST", 64, 18);
    ctx.fillStyle = "#d8d0c5";
    ctx.font = "bold 10px monospace";
    ctx.fillText("NO FUTURE", 64, 112);
  } else if (kind === "anarchy") {
    ctx.strokeStyle = "#a43a88";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 64, 32, 0, Math.PI * 2);
    ctx.moveTo(38, 96);
    ctx.lineTo(64, 30);
    ctx.lineTo(90, 96);
    ctx.moveTo(47, 73);
    ctx.lineTo(82, 73);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#c94d43";
    ctx.fillRect(18, 18, 92, 92);
    ctx.fillStyle = "#111111";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SK8", 64, 58);
    ctx.fillText("DIY", 64, 82);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function patch(
  kind: "front-skull" | "back-skull" | "pants-tag" | "anarchy",
  size: [number, number],
  pos: [number, number, number],
  rotY = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), patchMaterial(kind));
  m.position.set(...pos);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.renderOrder = 5;
  return m;
}

function stud(pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]): THREE.Mesh {
  const s = mesh(new THREE.ConeGeometry(0.018, 0.045, 4), ps2Material(0xd8d4c8), pos);
  s.rotation.set(...rot);
  return s;
}

/** Attaches one accessory's meshes onto an already-built rig's bones — shared by NPC.ts
 * and the player model so the punk-preset pieces (mohawk, vest) don't have to be built
 * twice. Head accessories (cap/bandana/beanie/mohawk) and the torso one (vest) don't
 * conflict, so callers can apply more than one for a combo look. */
export function applyAccessory(bones: HumanoidBones, accessory: Accessory): void {
  if (accessory === "none") return;
  if (accessory === "cap") {
    const capMat = ps2Material(0x163d46);
    const shadowMat = ps2Material(0x0f252b);
    const patchMat = ps2Material(0xd8d4c8);
    const crown = mesh(new THREE.BoxGeometry(0.32, 0.13, 0.29), capMat, [0, 0.285, 0.005]);
    crown.rotation.x = -0.04;
    const top = mesh(new THREE.BoxGeometry(0.28, 0.035, 0.25), shadowMat, [0, 0.365, -0.005]);
    const brim = mesh(new THREE.BoxGeometry(0.36, 0.035, 0.22), capMat, [0, 0.24, 0.205]);
    brim.rotation.x = -0.08;
    const logo = mesh(new THREE.BoxGeometry(0.14, 0.035, 0.016), patchMat, [0, 0.302, 0.154]);
    const backBand = mesh(new THREE.BoxGeometry(0.22, 0.035, 0.018), patchMat, [0, 0.26, -0.15]);
    bones.head.add(crown, top, brim, logo, backBand);
  } else if (accessory === "bandana") {
    const mat = ps2Material(0xc0392b);
    const wrap = mesh(new THREE.CylinderGeometry(0.148, 0.152, 0.06, 8), mat, [0, 0.19, 0]);
    wrap.scale.z = 0.95;
    const tail = mesh(new THREE.BoxGeometry(0.06, 0.18, 0.035), mat, [0.13, 0.12, -0.12]);
    tail.rotation.z = -0.25;
    const knot = mesh(new THREE.SphereGeometry(0.045, 6, 4), mat, [0.115, 0.165, -0.12]);
    bones.head.add(wrap, tail, knot);
  } else if (accessory === "beanie") {
    const mat = ps2Material(0x5a5a52);
    const hat = mesh(new THREE.CylinderGeometry(0.13, 0.152, 0.12, 8), mat, [0, 0.24, 0]);
    hat.scale.z = 0.92;
    const cuff = mesh(new THREE.CylinderGeometry(0.154, 0.158, 0.04, 8), ps2Material(0x3c3d3a), [0, 0.195, 0]);
    cuff.scale.z = 0.94;
    const beard = mesh(new THREE.BoxGeometry(0.22, 0.115, 0.04), ps2Material(0xbdb8ad), [0, 0.055, 0.135]);
    bones.head.add(hat, cuff, beard);
  } else if (accessory === "mohawk") {
    const baseMat = ps2Material(0x1a1020);
    const spikeMat = ps2Material(0x5b1f65);
    const tipMat = ps2Material(0xb5368c);
    const cap = mesh(new THREE.BoxGeometry(0.285, 0.06, 0.255), baseMat, [0, 0.315, 0]);
    const fringe = mesh(new THREE.BoxGeometry(0.22, 0.07, 0.085), baseMat, [0, 0.27, 0.125]);
    fringe.rotation.x = 0.18;
    bones.head.add(cap, fringe);

    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const z = -0.15 + t * 0.3;
      const h = 0.16 + Math.sin(t * Math.PI) * 0.1;
      const tuft = mesh(new THREE.ConeGeometry(0.055, h, 4), i % 2 ? tipMat : spikeMat, [0, 0.365 + h / 2, z]);
      tuft.rotation.x = (0.5 - t) * 0.55;
      tuft.rotation.z = (i % 2 ? 0.18 : -0.18);
      bones.head.add(tuft);
    }
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < 3; i++) {
        const spike = mesh(new THREE.ConeGeometry(0.04, 0.14 + i * 0.025, 4), spikeMat, [side * (0.12 + i * 0.025), 0.36, -0.08 + i * 0.075]);
        spike.rotation.z = -side * 0.85;
        spike.rotation.x = 0.1;
        bones.head.add(spike);
      }
    }
    const sideburnL = mesh(new THREE.BoxGeometry(0.055, 0.16, 0.045), baseMat, [-0.14, 0.19, 0.02]);
    const sideburnR = mesh(new THREE.BoxGeometry(0.055, 0.16, 0.045), baseMat, [0.14, 0.19, 0.02]);
    bones.head.add(sideburnL, sideburnR);
  } else if (accessory === "streetHair") {
    // Asymmetrical black/magenta layered cut from the street-skater sheet. Small
    // overlapping blocks preserve a graphic silhouette but read as hair, not pixels.
    const rootMat = ps2Material(0x15131a);
    const darkMagenta = ps2Material(0x592044);
    const hotMagenta = ps2Material(0xa53070);
    const crown = mesh(new THREE.CylinderGeometry(0.145, 0.165, 0.12, 10), rootMat, [0, 0.285, -0.01]);
    crown.scale.z = 0.95;
    bones.head.add(crown);
    const locks: Array<[number, number, number, number, number]> = [
      [-0.13, 0.28, 0.05, -0.26, 0],
      [-0.16, 0.23, -0.02, -0.34, 1],
      [-0.18, 0.16, -0.05, -0.42, 0],
      [-0.11, 0.33, 0.10, -0.15, 2],
      [0.08, 0.34, 0.08, 0.24, 1],
      [0.15, 0.28, -0.02, 0.34, 0],
      [0.14, 0.2, -0.08, 0.45, 2],
      [0.02, 0.37, -0.1, 0.08, 1],
    ];
    for (const [x, y, z, rotZ, colorIndex] of locks) {
      const lock = mesh(
        new THREE.BoxGeometry(0.105, 0.22, 0.09),
        [rootMat, darkMagenta, hotMagenta][colorIndex],
        [x, y, z],
      );
      lock.rotation.z = rotZ;
      lock.rotation.x = z > 0 ? -0.14 : 0.12;
      bones.head.add(lock);
    }
    for (let i = 0; i < 4; i++) {
      const tail = mesh(
        new THREE.BoxGeometry(0.08, 0.22 + i * 0.025, 0.08),
        i % 2 ? darkMagenta : rootMat,
        [0.17 + i * 0.025, 0.12 - i * 0.045, -0.12],
      );
      tail.rotation.z = -0.28 - i * 0.08;
      bones.head.add(tail);
    }
    const earring = new THREE.Mesh(
      faceted(new THREE.TorusGeometry(0.04, 0.009, 6, 12)),
      ps2Material(0xc9c4bc),
    );
    earring.position.set(-0.16, 0.13, 0.02);
    earring.rotation.y = Math.PI / 2;
    bones.head.add(earring);
  } else if (accessory === "vest") {
    const vestMat = ps2Material(0x111112);
    const leatherEdge = ps2Material(0x2a2927);
    const leftPanel = mesh(new THREE.BoxGeometry(0.2, 0.43, 0.044), vestMat, [-0.115, 0.265, 0.15]);
    const rightPanel = mesh(new THREE.BoxGeometry(0.2, 0.43, 0.044), vestMat, [0.115, 0.265, 0.15]);
    const backPanel = mesh(new THREE.BoxGeometry(0.45, 0.43, 0.044), vestMat, [0, 0.265, -0.15]);
    const collar = mesh(new THREE.BoxGeometry(0.47, 0.06, 0.052), leatherEdge, [0, 0.465, 0.13]);
    const waist = mesh(new THREE.BoxGeometry(0.48, 0.05, 0.28), leatherEdge, [0, 0.06, 0]);
    bones.spine.add(leftPanel, rightPanel, backPanel, collar);
    bones.spine.add(waist);
    bones.spine.add(patch("front-skull", [0.31, 0.31], [0, 0.26, 0.205]));
    bones.spine.add(patch("back-skull", [0.37, 0.34], [0, 0.27, -0.205], Math.PI));
    bones.spine.add(patch("pants-tag", [0.09, 0.09], [-0.17, 0.14, 0.21]));
    bones.spine.add(patch("pants-tag", [0.075, 0.075], [0.18, 0.39, 0.21]));
    const zipper = mesh(new THREE.BoxGeometry(0.026, 0.38, 0.018), ps2Material(0xd8d4c8), [0, 0.265, 0.21]);
    bones.spine.add(zipper);
    for (const x of [-0.2, -0.12, 0.12, 0.2]) bones.spine.add(stud([x, 0.47, 0.165], [Math.PI / 2, 0, 0]));

    const bandMat = ps2Material(0x090909);
    for (const lower of [bones.leftLowerArm, bones.rightLowerArm]) {
      const wrist = mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.055, 8), bandMat, [0, -0.215, 0]);
      lower.add(wrist);
      const glove = mesh(new THREE.BoxGeometry(0.095, 0.07, 0.08), bandMat, [0, -0.3, 0.018]);
      lower.add(glove);
      for (const x of [-0.032, 0, 0.032]) lower.add(stud([x, -0.215, 0.062], [Math.PI / 2, 0, 0]));
    }

    for (const [leg, sign] of [[bones.leftUpperLeg, -1], [bones.rightUpperLeg, 1]] as const) {
      const pocket = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.028), ps2Material(0x202020), [0, -0.2, 0.078]);
      const strap = mesh(new THREE.BoxGeometry(0.13, 0.022, 0.032), ps2Material(0x777777), [0, -0.14, 0.083]);
      leg.add(pocket, strap);
      const sidePatch = patch("pants-tag", [0.08, 0.08], [sign * 0.045, -0.09, -0.085], Math.PI);
      leg.add(sidePatch);
    }
    for (const foot of [bones.leftFoot, bones.rightFoot]) {
      foot.add(mesh(new THREE.BoxGeometry(0.13, 0.04, 0.035), ps2Material(0xd8d4c8), [0, 0.055, 0.142]));
    }

    const chainMat = ps2Material(0xb7b2a9);
    for (let i = 0; i < 8; i++) {
      const link = new THREE.Mesh(faceted(new THREE.TorusGeometry(0.026, 0.006, 5, 8)), chainMat);
      const t = i / 7;
      link.position.set(0.235, 0.055 - Math.sin(t * Math.PI) * 0.2, -0.13 + t * 0.08);
      link.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0);
      link.castShadow = true;
      bones.hips.add(link);
    }
    bones.hips.add(mesh(new THREE.BoxGeometry(0.11, 0.16, 0.035), ps2Material(0x111111), [0.23, -0.12, -0.08]));
  } else if (accessory === "streetJacket") {
    const jacket = ps2Material(0x111318);
    const jacketSoft = ps2Material(0x242833);
    const magenta = ps2Material(0xa32f6e);
    const metal = ps2Material(0xc7c4bd);
    const belt = ps2Material(0x090a0b);

    // Cropped oversized jacket: wide shoulders and a short waist create a completely
    // different silhouette from the straight punk vest.
    bones.spine.add(mesh(new THREE.BoxGeometry(0.49, 0.34, 0.28), jacket, [0, 0.31, 0]));
    bones.spine.add(mesh(new THREE.BoxGeometry(0.61, 0.12, 0.3), jacketSoft, [0, 0.43, 0]));
    bones.spine.add(mesh(new THREE.BoxGeometry(0.18, 0.22, 0.035), magenta, [-0.12, 0.3, 0.16]));
    bones.spine.add(patch("anarchy", [0.18, 0.18], [0.11, 0.3, 0.17]));
    bones.spine.add(mesh(new THREE.BoxGeometry(0.025, 0.3, 0.025), metal, [0, 0.28, 0.17]));
    bones.spine.add(mesh(new THREE.BoxGeometry(0.47, 0.05, 0.3), belt, [0, 0.1, 0]));

    for (const [upper, lower, sign] of [
      [bones.leftUpperArm, bones.leftLowerArm, -1],
      [bones.rightUpperArm, bones.rightLowerArm, 1],
    ] as const) {
      upper.add(mesh(new THREE.BoxGeometry(0.15, 0.22, 0.15), jacket, [0, -0.1, 0]));
      lower.add(mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.065, 9), belt, [0, -0.215, 0]));
      lower.add(mesh(new THREE.BoxGeometry(0.075, 0.03, 0.025), magenta, [sign * 0.045, -0.22, 0.066]));
      for (const x of [-0.03, 0.03]) lower.add(stud([x, -0.215, 0.063], [Math.PI / 2, 0, 0]));
    }

    // Studded belt, thigh straps and torn-knee patches.
    bones.hips.add(mesh(new THREE.BoxGeometry(0.49, 0.06, 0.29), belt, [0, 0.13, 0]));
    for (const x of [-0.19, -0.095, 0, 0.095, 0.19]) bones.hips.add(stud([x, 0.15, 0.15], [Math.PI / 2, 0, 0]));
    for (const [leg, sign] of [[bones.leftUpperLeg, -1], [bones.rightUpperLeg, 1]] as const) {
      leg.add(mesh(new THREE.BoxGeometry(0.17, 0.055, 0.17), jacketSoft, [0, -0.2, 0]));
      leg.add(mesh(new THREE.BoxGeometry(0.04, 0.18, 0.025), magenta, [sign * 0.065, -0.18, 0.086]));
    }
    for (const lower of [bones.leftLowerLeg, bones.rightLowerLeg]) {
      lower.add(mesh(new THREE.BoxGeometry(0.14, 0.11, 0.04), jacketSoft, [0, -0.08, 0.075]));
    }

    const chainMat = ps2Material(0xb9b7b1);
    for (let i = 0; i < 10; i++) {
      const link = new THREE.Mesh(faceted(new THREE.TorusGeometry(0.024, 0.006, 5, 8)), chainMat);
      const t = i / 9;
      link.position.set(-0.235, 0.06 - Math.sin(t * Math.PI) * 0.22, -0.12 + t * 0.08);
      link.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0);
      bones.hips.add(link);
    }
  } else if (accessory === "localSkater") {
    const shirtEdge = ps2Material(0x142846);
    const denimDark = ps2Material(0x101a2a);
    const denimStitch = ps2Material(0x32435b);
    const sole = ps2Material(0xd8d4c8);

    bones.spine.add(mesh(new THREE.BoxGeometry(0.46, 0.045, 0.25), shirtEdge, [0, 0.06, 0]));
    bones.spine.add(mesh(new THREE.BoxGeometry(0.16, 0.035, 0.02), ps2Material(0x1f3557), [0, 0.42, 0.135]));

    for (const [leg, sign] of [[bones.leftUpperLeg, -1], [bones.rightUpperLeg, 1]] as const) {
      const pocket = mesh(new THREE.BoxGeometry(0.12, 0.11, 0.026), denimDark, [sign * 0.025, -0.16, -0.082]);
      const seam = mesh(new THREE.BoxGeometry(0.018, 0.24, 0.02), denimStitch, [sign * 0.072, -0.17, 0.074]);
      leg.add(pocket, seam);
    }
    for (const foot of [bones.leftFoot, bones.rightFoot]) {
      foot.add(mesh(new THREE.BoxGeometry(0.16, 0.035, 0.036), sole, [0, 0.055, 0.155]));
      foot.add(mesh(new THREE.BoxGeometry(0.11, 0.018, 0.035), ps2Material(0x555555), [0, 0.095, 0.24]));
    }

    const chainMat = ps2Material(0xb8b0a0);
    for (let i = 0; i < 9; i++) {
      const link = new THREE.Mesh(faceted(new THREE.TorusGeometry(0.024, 0.006, 5, 8)), chainMat);
      const t = i / 8;
      link.position.set(0.238, 0.06 - Math.sin(t * Math.PI) * 0.22, -0.115 + t * 0.08);
      link.rotation.set(Math.PI / 2, 0, i % 2 ? Math.PI / 2 : 0);
      link.castShadow = true;
      bones.hips.add(link);
    }
    bones.hips.add(mesh(new THREE.BoxGeometry(0.1, 0.15, 0.034), denimDark, [0.235, -0.12, -0.075]));
  }
}
