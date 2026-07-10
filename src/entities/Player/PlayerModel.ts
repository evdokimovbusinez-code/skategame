import * as THREE from "three";
import { ps2Material, PALETTE, faceted } from "../../rendering/ps2Materials";
import { buildSixPackMesh } from "../../world/geometry/props";
import { buildHumanoidRig, LOWER_ARM_LEN } from "./HumanoidRig";
import type { HumanoidBones } from "./HumanoidRig";
import { applyAccessory } from "./Accessories";

export interface PlayerModelParts {
  group: THREE.Group;
  bones: HumanoidBones;
  board: THREE.Group;
  carriedSixPack: THREE.Group;
}

/** Main punk skater: layered streetwear, patched vest, wrist studs, chain and mohawk.
 * The silhouette follows the new character sheet while the shared rig keeps every
 * existing trick, parkour and ragdoll animation working. */
export function buildPlayerModel(): PlayerModelParts {
  const rig = buildHumanoidRig({
    skin: PALETTE.skin,
    shirt: 0x171519,
    sleeves: 0x171519,
    pants: 0x15171d,
    shoes: 0x101010,
  });
  applyAccessory(rig.bones, "mohawk");
  applyAccessory(rig.bones, "vest");

  const board = buildBoardMesh();
  board.position.set(0, 0.14, 0);
  rig.group.add(board);

  // Party snack bundle: parented to the lower-arm bone so it swings with the walk-cycle
  // arm animation instead of floating at a fixed world offset — hidden until a mission
  // (e.g. StealBeerMission) turns it on via PlayerController.setCarryingBeer().
  const carriedSixPack = buildSixPackMesh();
  carriedSixPack.visible = false;
  carriedSixPack.position.set(0, -LOWER_ARM_LEN + 0.02, 0.03);
  carriedSixPack.rotation.set(0, 0, Math.PI / 2);
  rig.bones.rightLowerArm.add(carriedSixPack);

  return { group: rig.group, bones: rig.bones, board, carriedSixPack };
}

function boardGraphicMaterial(kind: "top" | "bottom"): THREE.Material {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = kind === "top" ? "#151515" : "#123b43";
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = "#9b6a32";
  ctx.lineWidth = 6;
  ctx.strokeRect(7, 7, 242, 114);

  if (kind === "top") {
    ctx.fillStyle = "#b98248";
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BURNOUT", 128, 50);
    ctx.fillStyle = "#d8d0c5";
    ctx.font = "bold 13px monospace";
    ctx.fillText("SKATE SHOP", 128, 76);
  } else {
    ctx.fillStyle = "#d8d0c5";
    ctx.beginPath();
    ctx.arc(128, 52, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(106, 59, 44, 28);
    ctx.fillStyle = "#123b43";
    ctx.beginPath();
    ctx.arc(118, 50, 7, 0, Math.PI * 2);
    ctx.arc(138, 50, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(125, 56, 7, 11);
    ctx.fillRect(113, 76, 30, 5);
    ctx.fillStyle = "#b98248";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("BURNOUT", 128, 25);
    ctx.fillStyle = "#d8d0c5";
    ctx.font = "bold 12px monospace";
    ctx.fillText("SKATE SHOP", 128, 108);
    ctx.strokeStyle = "#b98248";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(52, 28);
    ctx.lineTo(86, 18);
    ctx.moveTo(170, 18);
    ctx.lineTo(205, 28);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
}

export function buildBoardMesh(): THREE.Group {
  const deckMat = ps2Material(0x123b43);
  const gripMat = ps2Material(PALETTE.boardGrip);
  const truckMat = ps2Material(0xd0c9bb);
  const axleMat = ps2Material(0x777777);
  const wheelMat = ps2Material(0xe9e0d2);
  const bearingMat = ps2Material(0x171717);

  const boardGroup = new THREE.Group();

  const deckShape = new THREE.Shape();
  const width = 0.31;
  const length = 1.02;
  const nose = 0.18;
  deckShape.moveTo(-width / 2, -length / 2 + nose);
  deckShape.quadraticCurveTo(-width / 2, -length / 2, 0, -length / 2);
  deckShape.quadraticCurveTo(width / 2, -length / 2, width / 2, -length / 2 + nose);
  deckShape.lineTo(width / 2, length / 2 - nose);
  deckShape.quadraticCurveTo(width / 2, length / 2, 0, length / 2);
  deckShape.quadraticCurveTo(-width / 2, length / 2, -width / 2, length / 2 - nose);
  deckShape.closePath();

  const deckGeo = faceted(new THREE.ExtrudeGeometry(deckShape, { depth: 0.04, bevelEnabled: false }));
  deckGeo.rotateX(-Math.PI / 2);
  deckGeo.translate(0, -0.02, 0);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.castShadow = true;
  boardGroup.add(deck);

  const grip = new THREE.Mesh(faceted(new THREE.BoxGeometry(0.22, 0.008, 0.66)), gripMat);
  grip.position.y = 0.026;
  grip.castShadow = true;
  boardGroup.add(grip);

  const topGraphic = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.72), boardGraphicMaterial("top"));
  topGraphic.position.set(0, 0.032, 0);
  topGraphic.rotation.x = -Math.PI / 2;
  boardGroup.add(topGraphic);

  const bottomGraphic = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.78), boardGraphicMaterial("bottom"));
  bottomGraphic.position.set(0, -0.043, 0);
  bottomGraphic.rotation.x = Math.PI / 2;
  boardGroup.add(bottomGraphic);

  const truckGeo = faceted(new THREE.BoxGeometry(0.25, 0.035, 0.07));
  for (const z of [-0.33, 0.33]) {
    const truck = new THREE.Mesh(truckGeo, truckMat);
    truck.position.set(0, -0.045, z);
    truck.castShadow = true;
    boardGroup.add(truck);

    const axle = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 6)), axleMat);
    axle.rotation.z = Math.PI / 2;
    axle.position.set(0, -0.06, z);
    axle.castShadow = true;
    boardGroup.add(axle);
  }

  const wheelGeo = faceted(new THREE.CylinderGeometry(0.058, 0.058, 0.07, 10));
  const wheelPositions: [number, number, number][] = [
    [-0.18, -0.067, 0.33],
    [0.18, -0.067, 0.33],
    [-0.18, -0.067, -0.33],
    [0.18, -0.067, -0.33],
  ];
  for (const p of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(...p);
    wheel.castShadow = true;
    const bearing = new THREE.Mesh(faceted(new THREE.CylinderGeometry(0.019, 0.019, 0.07, 8)), bearingMat);
    bearing.rotation.z = Math.PI / 2;
    bearing.position.copy(wheel.position);
    boardGroup.add(wheel);
    boardGroup.add(bearing);
  }

  return boardGroup;
}
