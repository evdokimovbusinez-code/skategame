import * as THREE from "three";
import { TRICK } from "../../config/constants";
import { gameEvents } from "../../core/GameEvents";
import type { PlayerController, SkatePopStyle } from "./PlayerController";

export type TrickType =
  | "none"
  | "charge"
  | "ollie"
  | "kickflip"
  | "heelflip"
  | "pop-shove-it"
  | "fs-pop-shove-it"
  | "360-pop-shove-it"
  | "fs-360-shove-it"
  | "varial-kickflip"
  | "hardflip"
  | "inward-heelflip"
  | "360-flip"
  | "laser-flip";

type TrickPhase = "idle" | "charging" | "air";
type SpinDir = "frontside" | "backside" | null;

interface BoardMove {
  id: Exclude<TrickType, "none" | "charge" | "ollie">;
  label: string;
  rollTurns: number;
  shoveTurns: number;
  duration: number;
  score: number;
}

interface TrickState {
  phase: TrickPhase;
  charge: number;
  flickWindow: number;
  boardMove: BoardMove | null;
  boardElapsed: number;
  bodySpinRad: number;
  bodySpinTargetRad: number;
  bodySpinDir: SpinDir;
  emittedOllie: boolean;
}

const state: TrickState = {
  phase: "idle",
  charge: 0,
  flickWindow: 0,
  boardMove: null,
  boardElapsed: 0,
  bodySpinRad: 0,
  bodySpinTargetRad: 0,
  bodySpinDir: null,
  emittedOllie: false,
};

const MOVES: Record<BoardMove["id"], BoardMove> = {
  kickflip: {
    id: "kickflip",
    label: "KICKFLIP",
    rollTurns: 1,
    shoveTurns: 0,
    duration: 0.5,
    score: TRICK.scores.kickflip,
  },
  heelflip: {
    id: "heelflip",
    label: "HEELFLIP",
    rollTurns: -1,
    shoveTurns: 0,
    duration: 0.52,
    score: TRICK.scores.heelflip,
  },
  "pop-shove-it": {
    id: "pop-shove-it",
    label: "POP SHOVE-IT",
    rollTurns: 0,
    shoveTurns: 0.5,
    duration: 0.46,
    score: TRICK.scores.shove,
  },
  "fs-pop-shove-it": {
    id: "fs-pop-shove-it",
    label: "FRONTSIDE POP SHOVE-IT",
    rollTurns: 0,
    shoveTurns: -0.5,
    duration: 0.48,
    score: TRICK.scores.shove,
  },
  "360-pop-shove-it": {
    id: "360-pop-shove-it",
    label: "360 POP SHOVE-IT",
    rollTurns: 0,
    shoveTurns: 1,
    duration: 0.62,
    score: TRICK.scores.threeShove,
  },
  "fs-360-shove-it": {
    id: "fs-360-shove-it",
    label: "FRONTSIDE 360 SHOVE-IT",
    rollTurns: 0,
    shoveTurns: -1,
    duration: 0.64,
    score: TRICK.scores.threeShove,
  },
  "varial-kickflip": {
    id: "varial-kickflip",
    label: "VARIAL KICKFLIP",
    rollTurns: 1,
    shoveTurns: 0.5,
    duration: 0.62,
    score: TRICK.scores.varial,
  },
  hardflip: {
    id: "hardflip",
    label: "HARDFLIP",
    rollTurns: 1,
    shoveTurns: -0.5,
    duration: 0.66,
    score: TRICK.scores.varial + 20,
  },
  "inward-heelflip": {
    id: "inward-heelflip",
    label: "INWARD HEELFLIP",
    rollTurns: -1,
    shoveTurns: 0.5,
    duration: 0.66,
    score: TRICK.scores.varial + 20,
  },
  "360-flip": {
    id: "360-flip",
    label: "360 FLIP",
    rollTurns: 1,
    shoveTurns: 1,
    duration: 0.78,
    score: TRICK.scores.threeSixtyFlip,
  },
  "laser-flip": {
    id: "laser-flip",
    label: "LASER FLIP",
    rollTurns: -1,
    shoveTurns: -1,
    duration: 0.82,
    score: TRICK.scores.threeSixtyFlip + 40,
  },
};

function resetState(ctx: PlayerController): void {
  state.phase = "idle";
  state.charge = 0;
  state.flickWindow = 0;
  state.boardMove = null;
  state.boardElapsed = 0;
  state.bodySpinRad = 0;
  state.bodySpinTargetRad = 0;
  state.bodySpinDir = null;
  state.emittedOllie = false;
  ctx.trickType = "none";
  ctx.trickTimer = 0;
  ctx.trickDuration = 0;
  ctx.trickYawOffset = 0;
  ctx.trickPopStyle = "ollie";
  ctx.model.board.rotation.set(0, 0, 0);
}

function intendedPopStyle(ctx: PlayerController): SkatePopStyle {
  return ctx.input.isDown("KeyS") || ctx.input.isDown("ArrowDown") ? "nollie" : "ollie";
}

function stancePrefix(ctx: PlayerController, popStyle = ctx.trickPopStyle): string {
  const parts: string[] = [];
  if (ctx.switchStance) parts.push("SWITCH");
  if (ctx.isFakie) parts.push("FAKIE");
  if (popStyle === "nollie") parts.push("NOLLIE");
  return parts.join(" ");
}

function formatMoveLabel(ctx: PlayerController, label: string): string {
  const prefix = stancePrefix(ctx);
  return prefix ? `${prefix} ${label}` : label;
}

function formatPopLabel(ctx: PlayerController, boned: boolean): string {
  if (ctx.trickPopStyle === "nollie") {
    const prefix = stancePrefix(ctx).replace(/\bNOLLIE\b/, "").trim();
    return `${boned ? "BONED " : ""}${prefix ? `${prefix} ` : ""}NOLLIE`;
  }
  return formatMoveLabel(ctx, boned ? "BONED OLLIE" : "OLLIE");
}

function moveById(id: BoardMove["id"]): BoardMove {
  return MOVES[id];
}

function combineMove(current: BoardMove | null, next: BoardMove): BoardMove {
  if (!current) return next;
  const ids = new Set([current.id, next.id]);

  if (ids.has("360-flip") || ids.has("laser-flip")) return current;
  if (ids.has("kickflip") && ids.has("360-pop-shove-it")) return moveById("360-flip");
  if (ids.has("heelflip") && ids.has("fs-360-shove-it")) return moveById("laser-flip");
  if (ids.has("kickflip") && ids.has("pop-shove-it")) return moveById("varial-kickflip");
  if (ids.has("kickflip") && ids.has("fs-pop-shove-it")) return moveById("hardflip");
  if (ids.has("heelflip") && ids.has("pop-shove-it")) return moveById("inward-heelflip");
  if (ids.has("heelflip") && ids.has("fs-pop-shove-it")) return moveById("inward-heelflip");
  if (ids.has("pop-shove-it") && ids.has("360-pop-shove-it")) return moveById("360-pop-shove-it");
  if (ids.has("fs-pop-shove-it") && ids.has("fs-360-shove-it")) return moveById("fs-360-shove-it");

  return current.score >= next.score ? current : next;
}

function emitBoardMove(ctx: PlayerController, move: BoardMove): void {
  const changed = state.boardMove?.id !== move.id;
  state.boardMove = move;
  state.boardElapsed = 0;
  ctx.trickType = move.id;
  ctx.trickDuration = move.duration;
  ctx.trickTimer = move.duration;
  if (changed) gameEvents.emit("trick", { name: formatMoveLabel(ctx, move.label), score: move.score });
}

function collectBoardInput(ctx: PlayerController): void {
  const input = ctx.input;
  let next: BoardMove | null = null;
  const shift = input.isDown("ShiftLeft") || input.isDown("ShiftRight");

  if (input.justPressed("KeyV")) next = moveById(shift ? "laser-flip" : "360-flip");
  if (input.justPressed("KeyF")) next = combineMove(next, moveById("kickflip"));
  if (input.justPressed("KeyG")) next = combineMove(next, moveById("heelflip"));
  if (input.justPressed("KeyC")) next = combineMove(next, moveById(shift ? "360-pop-shove-it" : "pop-shove-it"));
  if (input.justPressed("KeyZ")) next = combineMove(next, moveById(shift ? "fs-360-shove-it" : "fs-pop-shove-it"));

  if (!next) return;
  emitBoardMove(ctx, combineMove(state.boardMove, next));
}

function collectBodySpinInput(ctx: PlayerController): void {
  const input = ctx.input;
  const shift = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
  const amount = THREE.MathUtils.degToRad(shift ? 360 : 180);
  if (input.justPressed("KeyQ")) {
    state.bodySpinTargetRad -= amount;
    state.bodySpinDir = "frontside";
  }
  if (input.justPressed("KeyE")) {
    state.bodySpinTargetRad += amount;
    state.bodySpinDir = "backside";
  }
}

function pop(ctx: PlayerController): void {
  const v = ctx.body.linvel();
  if (ctx.trickPopStyle !== "nollie") ctx.trickPopStyle = intendedPopStyle(ctx);
  const chargeFrac = THREE.MathUtils.clamp(state.charge / TRICK.chargeSeconds, 0, 1);
  const popImpulse = THREE.MathUtils.lerp(TRICK.ollieImpulse, TRICK.ollieMaxImpulse, chargeFrac);
  ctx.body.setLinvel({ x: v.x, y: Math.max(v.y, popImpulse), z: v.z }, true);

  state.phase = "air";
  state.flickWindow = TRICK.flickWindowSeconds;
  state.boardElapsed = 0;
  ctx.timeSinceGrounded = TRICK.coyoteTime + 1;
  ctx.jumpBufferTimer = 0;

  if (!state.emittedOllie) {
    ctx.trickType = "ollie";
    ctx.trickDuration = TRICK.ollieTiltDuration;
    ctx.trickTimer = TRICK.ollieTiltDuration;
    gameEvents.emit("trick", { name: formatPopLabel(ctx, chargeFrac > 0.72), score: TRICK.scores.ollie });
    state.emittedOllie = true;
  }

  if (state.boardMove) {
    ctx.trickType = state.boardMove.id;
    ctx.trickDuration = state.boardMove.duration;
    ctx.trickTimer = state.boardMove.duration;
  }

  if (state.bodySpinTargetRad === 0) {
    if (ctx.input.isDown("KeyQ")) {
      state.bodySpinTargetRad = -THREE.MathUtils.degToRad(180);
      state.bodySpinDir = "frontside";
    } else if (ctx.input.isDown("KeyE")) {
      state.bodySpinTargetRad = THREE.MathUtils.degToRad(180);
      state.bodySpinDir = "backside";
    }
  }
}

function startCharge(ctx: PlayerController): void {
  state.phase = "charging";
  state.charge = 0;
  state.flickWindow = TRICK.flickWindowSeconds;
  state.boardElapsed = 0;
  state.bodySpinRad = 0;
  state.bodySpinTargetRad = 0;
  state.bodySpinDir = null;
  state.emittedOllie = false;
  state.boardMove = null;
  ctx.trickYawOffset = 0;
  ctx.trickPopStyle = intendedPopStyle(ctx);
  ctx.trickType = "charge";
}

function updateBodySpin(ctx: PlayerController, dt: number): void {
  if (ctx.grounded) return;
  collectBodySpinInput(ctx);
  const speedBonus = THREE.MathUtils.clamp(Math.abs(ctx.skateSpeed) / 12, 0, 1) * 0.22;
  const maxStep = THREE.MathUtils.degToRad(TRICK.bodySpinRateDegPerSec * (1 + speedBonus)) * dt;

  if (state.bodySpinTargetRad !== 0) {
    if (Math.abs(state.bodySpinTargetRad - state.bodySpinRad) <= 0.001) return;
    const remaining = state.bodySpinTargetRad - state.bodySpinRad;
    const delta = THREE.MathUtils.clamp(remaining, -maxStep, maxStep);
    ctx.trickYawOffset += delta;
    state.bodySpinRad += delta;
    return;
  }

  let spinInput = 0;
  let dir: SpinDir = null;
  if (ctx.input.isDown("KeyQ")) {
    spinInput -= 1;
    dir = "frontside";
  }
  if (ctx.input.isDown("KeyE")) {
    spinInput += 1;
    dir = "backside";
  }
  if (spinInput === 0) return;

  const delta = maxStep * spinInput;
  ctx.trickYawOffset += delta;
  state.bodySpinRad += delta;
  state.bodySpinDir = dir ?? state.bodySpinDir;
}

function applyBoardVisual(ctx: PlayerController, dt: number): void {
  const board = ctx.model.board;
  if (state.boardMove) {
    state.boardElapsed = Math.min(state.boardMove.duration, state.boardElapsed + dt);
    const t = THREE.MathUtils.clamp(state.boardElapsed / state.boardMove.duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 2);
    const popPitch = Math.sin(Math.min(1, t * 1.35) * Math.PI) * -0.34;
    board.rotation.x = popPitch;
    board.rotation.y = state.boardMove.shoveTurns * Math.PI * 2 * eased;
    board.rotation.z = state.boardMove.rollTurns * Math.PI * 2 * eased;
    ctx.trickTimer = Math.max(0, state.boardMove.duration - state.boardElapsed);
  } else if (state.phase === "air") {
    ctx.trickTimer = Math.max(0, ctx.trickTimer - dt);
    const t = ctx.trickDuration > 0 ? 1 - ctx.trickTimer / ctx.trickDuration : 1;
    board.rotation.x = Math.sin(THREE.MathUtils.clamp(t, 0, 1) * Math.PI) * -0.52;
  } else if (state.phase === "charging") {
    const chargeFrac = THREE.MathUtils.clamp(state.charge / TRICK.chargeSeconds, 0, 1);
    board.rotation.x = 0.12 * chargeFrac;
  }
}

function finalizeBodySpin(ctx: PlayerController): boolean {
  const absDeg = Math.abs(THREE.MathUtils.radToDeg(state.bodySpinRad));
  if (absDeg < 70) return true;

  const rounded = THREE.MathUtils.clamp(Math.round(absDeg / 180) * 180, 180, 720);
  const miss = Math.abs(absDeg - rounded);
  if (miss > TRICK.bodySpinLandingToleranceDeg) return false;

  const sign = Math.sign(state.bodySpinRad) || 1;
  const snapped = THREE.MathUtils.degToRad(rounded) * sign;
  ctx.trickYawOffset += snapped - state.bodySpinRad;
  state.bodySpinRad = snapped;
  const changesStance = Math.round(rounded / 180) % 2 === 1;
  if (changesStance) ctx.commitBodySpinLanding(snapped);

  const labelDir = state.bodySpinDir === "frontside" ? "FRONTSIDE" : "BACKSIDE";
  const score = rounded >= 360 ? TRICK.scores.body360 + (rounded - 360) : TRICK.scores.body180;
  const stanceSuffix = changesStance ? ` TO ${ctx.stanceLabel}` : "";
  gameEvents.emit("trick", { name: `${labelDir} ${rounded}${stanceSuffix}`, score });
  return true;
}

function finalizeLanding(ctx: PlayerController): void {
  const move = state.boardMove;
  if (move) {
    const remaining = move.duration - state.boardElapsed;
    if (remaining > TRICK.landingForgiveness) {
      ctx.pendingBail = true;
      ctx.bailReason = "bad-landing";
      resetState(ctx);
      return;
    }
  }

  if (!finalizeBodySpin(ctx)) {
    ctx.pendingBail = true;
    ctx.bailReason = "bad-landing";
    resetState(ctx);
    return;
  }

  if (state.emittedOllie || move || Math.abs(state.bodySpinRad) > 0.01) {
    gameEvents.emit("cleanLanding", { airTime: ctx.airTimeAtLanding, hard: ctx.airTimeAtLanding > 0.6 });
    gameEvents.emit("trick", { name: "CLEAN LANDING", score: TRICK.scores.cleanLanding });
  }
  resetState(ctx);
}

export const TrickSystem = {
  update(ctx: PlayerController, dt: number): void {
    const wasGrounded = ctx.groundedLastFrame;
    const input = ctx.input;

    if (ctx.grounded) {
      ctx.timeSinceGrounded = 0;
      ctx.airTime = 0;
    } else {
      ctx.timeSinceGrounded += dt;
      ctx.airTime += dt;
    }

    const canPop = ctx.grounded || ctx.timeSinceGrounded <= TRICK.coyoteTime;
    if (state.phase === "idle" && input.justPressed("Space")) startCharge(ctx);

    if (state.phase === "charging") {
      state.charge = Math.min(TRICK.chargeSeconds, state.charge + dt);
      if (intendedPopStyle(ctx) === "nollie") ctx.trickPopStyle = "nollie";
      collectBoardInput(ctx);
      collectBodySpinInput(ctx);
      applyBoardVisual(ctx, dt);
      if (input.justReleased("Space")) {
        if (canPop) pop(ctx);
        else {
          ctx.jumpBufferTimer = TRICK.jumpBufferTime;
          resetState(ctx);
        }
      }
    } else if (state.phase === "idle" && ctx.grounded && ctx.jumpBufferTimer > 0) {
      startCharge(ctx);
      state.charge = TRICK.chargeSeconds * 0.45;
      pop(ctx);
    }
    ctx.jumpBufferTimer = Math.max(0, ctx.jumpBufferTimer - dt);

    if (state.phase === "air") {
      if (state.flickWindow > 0) {
        state.flickWindow = Math.max(0, state.flickWindow - dt);
        collectBoardInput(ctx);
      }
      updateBodySpin(ctx, dt);
      applyBoardVisual(ctx, dt);
    } else if (!ctx.grounded && state.phase === "idle") {
      // Rolled off a ledge/ramp without an explicit pop: still allow body spins and a
      // short late-flip window so drops are not dead time.
      state.phase = "air";
      state.charge = 0;
      state.flickWindow = TRICK.flickWindowSeconds * 0.55;
      state.emittedOllie = false;
    }

    if (!wasGrounded && ctx.grounded) {
      if (state.phase === "air") finalizeLanding(ctx);
      else if (state.phase === "charging") resetState(ctx);
    }

    if (!ctx.grounded) ctx.airTimeAtLanding = ctx.airTime;
    ctx.groundedLastFrame = ctx.grounded;
  },

  forceReset(ctx: PlayerController): void {
    resetState(ctx);
  },
};
