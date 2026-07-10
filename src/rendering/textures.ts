import * as THREE from "three";

/** Procedural materials rendered at 4× their logical resolution.  The motifs remain
 * handmade and stylised, but mipmaps keep them stable on oblique streets and facades. */

function makeCanvas(size = 64): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const detailScale = 4;
  const canvas = document.createElement("canvas");
  canvas.width = size * detailScale;
  canvas.height = size * detailScale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(detailScale, detailScale);
  return [canvas, ctx];
}

function finalize(canvas: HTMLCanvasElement, repeat = 1): THREE.Texture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function noise(ctx: CanvasRenderingContext2D, size: number, amount: number, alpha: number): void {
  for (let i = 0; i < amount; i++) {
    const v = Math.floor(Math.random() * 60) - 30;
    ctx.fillStyle = `rgba(${128 + v},${128 + v},${128 + v},${alpha})`;
    ctx.fillRect(Math.floor(Math.random() * size), Math.floor(Math.random() * size), 1, 1);
  }
}

export function asphaltTexture(repeat = 8): THREE.Texture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#5b574f";
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 900, 0.12);
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(156,145,126,0.13)" : "rgba(22,24,23,0.18)";
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 3, 1);
  }
  // sparse cracks
  ctx.strokeStyle = "rgba(22,23,22,0.36)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    let x = Math.random() * 64;
    let y = Math.random() * 64;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 20;
      y += Math.random() * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finalize(canvas, repeat);
}

export function concreteTexture(repeat = 4): THREE.Texture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#a59c8d";
  ctx.fillRect(0, 0, 64, 64);
  noise(ctx, 64, 620, 0.1);
  // stains
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `rgba(83,78,68,${0.06 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 64, Math.random() * 64, 4 + Math.random() * 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // expansion joint lines
  ctx.fillStyle = "rgba(54,50,45,0.38)";
  ctx.fillRect(0, 31, 64, 2);
  ctx.fillRect(31, 0, 2, 64);
  ctx.strokeStyle = "rgba(35,38,36,0.42)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 50);
  ctx.lineTo(20, 43);
  ctx.lineTo(26, 46);
  ctx.lineTo(38, 35);
  ctx.stroke();
  return finalize(canvas, repeat);
}

export function brickTexture(repeat = 3): THREE.Texture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#7d4339";
  ctx.fillRect(0, 0, 64, 64);
  const brickH = 8;
  const brickW = 16;
  ctx.fillStyle = "#b28a78";
  for (let row = 0; row < 64 / brickH; row++) {
    ctx.fillRect(0, row * brickH, 64, 1);
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = 0; col < 64 / brickW + 1; col++) {
      ctx.fillRect(((col * brickW + offset) % 64), row * brickH, 1, brickH);
    }
  }
  noise(ctx, 64, 500, 0.14);
  return finalize(canvas, repeat);
}

export function woodTexture(repeat = 2): THREE.Texture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#8a6844";
  ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `rgba(60,42,25,${0.15 + Math.random() * 0.15})`;
    ctx.fillRect(0, i * 8 + Math.floor(Math.random() * 3), 64, 1 + Math.floor(Math.random() * 2));
  }
  noise(ctx, 64, 350, 0.12);
  return finalize(canvas, repeat);
}

export function metalTexture(repeat = 2): THREE.Texture {
  const [canvas, ctx] = makeCanvas();
  ctx.fillStyle = "#7d8589";
  ctx.fillRect(0, 0, 64, 64);
  // brushed streaks
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.05})`;
    ctx.fillRect(0, Math.floor(Math.random() * 64), 64, 1);
  }
  noise(ctx, 64, 250, 0.1);
  return finalize(canvas, repeat);
}

/** Warm evening windows: dark facade grid with a scatter of lit panes. */
export function windowsTexture(cols = 4, rows = 3): THREE.Texture {
  const [canvas, ctx] = makeCanvas(64);
  ctx.fillStyle = "#2a2622";
  ctx.fillRect(0, 0, 64, 64);
  const cellW = 64 / cols;
  const cellH = 64 / rows;
  for (let cx = 0; cx < cols; cx++) {
    for (let cy = 0; cy < rows; cy++) {
      const lit = Math.random() < 0.45;
      ctx.fillStyle = lit ? (Math.random() < 0.5 ? "#ffd98a" : "#e8b25c") : "#1a1816";
      ctx.fillRect(cx * cellW + 3, cy * cellH + 3, cellW - 6, cellH - 6);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** `variant` picks which tag design to stencil — 0 is the original default (used by
 * `GraffitiMission.ts`'s runtime decal, so it keeps its exact prior look), 1-3 are extra
 * designs for wall variety in the Back Alley / Apartments zones. */
export function graffitiTexture(variant = 0): THREE.Texture {
  const [canvas, ctx] = makeCanvas(128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const inkColor = variant === 3 ? "#e0e0dc" : "#1c1a18";
  const fillColor = ["#ffd23e", "#ff5a4e", "#8fd98a", "#ffffff"][variant % 4];

  if (variant === 0) {
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 14;
    drawSk8Tag(ctx);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 8;
    drawSk8Tag(ctx);
    ctx.fillStyle = fillColor;
    for (const x of [30, 58, 86]) ctx.fillRect(x, 88, 3, 10 + Math.random() * 14);
  } else if (variant === 1) {
    // Jagged lightning-bolt tag.
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 15;
    drawBoltTag(ctx);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 9;
    drawBoltTag(ctx);
    ctx.fillStyle = fillColor;
    for (const x of [20, 100]) ctx.fillRect(x, 92, 3, 8 + Math.random() * 12);
  } else if (variant === 2) {
    // Five-point star tag with a ring, common stencil motif.
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 12;
    drawStarTag(ctx);
    ctx.strokeStyle = fillColor;
    ctx.lineWidth = 6;
    drawStarTag(ctx);
  } else {
    // Stenciled word — angled bold sans, drop-shadow outline for a spray-through-stencil read.
    ctx.save();
    ctx.translate(64, 64);
    ctx.rotate(-0.08);
    ctx.font = "bold 30px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = 6;
    ctx.strokeText("ZERO", 0, 0);
    ctx.fillStyle = fillColor;
    ctx.fillText("ZERO", 0, 0);
    ctx.restore();
    ctx.fillStyle = fillColor;
    for (const x of [26, 100]) ctx.fillRect(x, 84, 3, 8 + Math.random() * 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawSk8Tag(ctx: CanvasRenderingContext2D): void {
  // stylized "SK8" squiggle
  ctx.beginPath();
  ctx.moveTo(24, 44);
  ctx.quadraticCurveTo(10, 60, 30, 70);
  ctx.quadraticCurveTo(50, 80, 36, 90);
  ctx.moveTo(56, 40);
  ctx.lineTo(56, 88);
  ctx.moveTo(78, 44);
  ctx.lineTo(56, 66);
  ctx.moveTo(60, 62);
  ctx.lineTo(80, 90);
  ctx.moveTo(100, 44);
  ctx.quadraticCurveTo(88, 56, 100, 64);
  ctx.quadraticCurveTo(112, 72, 100, 86);
  ctx.quadraticCurveTo(88, 78, 100, 64);
  ctx.stroke();
}

function drawBoltTag(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(70, 30);
  ctx.lineTo(38, 62);
  ctx.lineTo(58, 62);
  ctx.lineTo(34, 100);
  ctx.lineTo(92, 56);
  ctx.lineTo(66, 56);
  ctx.lineTo(88, 30);
  ctx.closePath();
  ctx.stroke();
}

function drawStarTag(ctx: CanvasRenderingContext2D): void {
  const cx = 64;
  const cy = 60;
  const outerR = 34;
  const innerR = 14;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.moveTo(cx + outerR + 10, cy);
  ctx.arc(cx, cy, outerR + 10, 0, Math.PI * 2);
  ctx.stroke();
}
