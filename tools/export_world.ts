import { createCanvas, Image, ImageData } from "@napi-rs/canvas";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";

Object.assign(globalThis, {
  self: globalThis,
  Image,
  ImageData,
  document: {
    createElement: (tag: string) => {
      if (tag !== "canvas") throw new Error(`Unsupported DOM element: ${tag}`);
      return createCanvas(256, 256);
    },
    createElementNS: (_namespace: string, tag: string) => {
      if (tag !== "canvas") throw new Error(`Unsupported DOM element: ${tag}`);
      return createCanvas(256, 256);
    },
  },
});

class NodeFileReader {
  result: string | ArrayBuffer | null = null;
  onloadend: null | (() => void) = null;
  onerror: null | ((error: unknown) => void) = null;

  async readAsArrayBuffer(blob: Blob): Promise<void> {
    try {
      this.result = await blob.arrayBuffer();
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }

  async readAsDataURL(blob: Blob): Promise<void> {
    try {
      const buffer = Buffer.from(await blob.arrayBuffer());
      this.result = `data:${blob.type};base64,${buffer.toString("base64")}`;
      this.onloadend?.();
    } catch (error) {
      this.onerror?.(error);
    }
  }
}

Object.assign(globalThis, { FileReader: NodeFileReader });

const THREE = await import("three");
const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
const { PhysicsWorld } = await import("../src/core/PhysicsWorld.ts");
const { buildLevel } = await import("../src/world/Level.ts");

const scene = new THREE.Scene();
const physics = await PhysicsWorld.create();
buildLevel(scene, physics);
scene.updateMatrixWorld(true);

const colliderData: Array<Record<string, unknown>> = [];
physics.world.forEachCollider((collider) => {
  const type = collider.shapeType();
  const translation = collider.translation();
  const rotation = collider.rotation();
  const item: Record<string, unknown> = {
    type,
    position: [translation.x, translation.y, translation.z],
    rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
  };
  if (type === 1) {
    const half = collider.halfExtents();
    item.halfExtents = [half.x, half.y, half.z];
  } else if (type === 6 || type === 9) {
    item.vertices = Array.from(collider.vertices());
    const indices = collider.indices();
    if (indices) item.indices = Array.from(indices);
  } else if (type === 0 || type === 2 || type === 10) {
    item.radius = collider.radius();
    if (type !== 0) item.halfHeight = collider.halfHeight();
  }
  colliderData.push(item);
});
await writeFile("godot/assets/world/sk8town_colliders.json", JSON.stringify(colliderData));

// Godot owns the runtime sun, night lights and time-of-day cycle. Export only the exact
// authored Three.js geometry/material hierarchy so lighting is not duplicated.
const runtimeLights: THREE.Object3D[] = [];
scene.traverse((node) => {
  if ((node as THREE.Light).isLight) runtimeLights.push(node);
});
for (const light of runtimeLights) light.removeFromParent();

const exporter = new GLTFExporter();
const result = await exporter.parseAsync(scene, {
  binary: true,
  onlyVisible: true,
  trs: true,
  maxTextureSize: 1024,
});

if (!(result instanceof ArrayBuffer)) throw new Error("Expected binary GLB output");
const chunkDir = "godot/assets/world/chunks";
await mkdir(chunkDir, { recursive: true });
for (const name of await readdir(chunkDir)) {
  if (name.startsWith("sk8town_world.glb.part")) await unlink(`${chunkDir}/${name}`);
}
const worldBuffer = Buffer.from(result);
const chunkSize = 600 * 1024;
for (let offset = 0, index = 0; offset < worldBuffer.length; offset += chunkSize, index++) {
  await writeFile(
    `${chunkDir}/sk8town_world.glb.part${index.toString().padStart(2, "0")}`,
    worldBuffer.subarray(offset, offset + chunkSize),
  );
}
console.log(`Exported ${scene.children.length} world roots, ${colliderData.length} colliders, ${result.byteLength} bytes`);
