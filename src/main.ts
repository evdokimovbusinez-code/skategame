import { Engine } from "./core/Engine";
import { PhysicsWorld } from "./core/PhysicsWorld";
import { InputManager } from "./core/InputManager";
import { setupLighting } from "./rendering/lighting";
import { DayNightCycle } from "./rendering/DayNightCycle";
import { buildLevel } from "./world/Level";
import { PlayerController } from "./entities/Player/PlayerController";
import { FollowCamera } from "./camera/FollowCamera";
import { MouseLook } from "./camera/MouseLook";
import { CAMERA, SKATE, PLAYER } from "./config/constants";
import { HUD } from "./ui/HUD";
import { NPC } from "./entities/NPC";
import { DialogueSystem } from "./dialogue/DialogueSystem";
import {
  buildCrewIntroDialogue,
  buildCrewFollowUpDialogue,
  buildTrickChallengeDialogue,
  buildCrewFinalDialogue,
  buildJaxBusyDialogue,
  buildRosaDialogue,
  buildOtisDialogue,
} from "./dialogue/DialogueData";
import type { DialogueTree } from "./dialogue/DialogueData";
import { QuestSystem } from "./quests/QuestSystem";
import { StealBeerMission, STEAL_BEER_QUEST } from "./quests/missions/StealBeerMission";
import { GraffitiMission, GRAFFITI_QUEST } from "./quests/missions/GraffitiMission";
import { TrickChallengeMission } from "./quests/missions/TrickChallengeMission";
import { VhsCollectionMission } from "./quests/missions/VhsCollectionMission";
import { DeliveryMission } from "./quests/missions/DeliveryMission";
import { applyPS2VisualPolish } from "./rendering/PostFX";
import { ScoreSystem } from "./quests/ScoreSystem";
import { gameEvents } from "./core/GameEvents";
import { ParticleSystem } from "./rendering/Particles";
import { Menu } from "./ui/Menu";
import { AudioManager } from "./core/AudioManager";
import { DebugPanel } from "./ui/DebugPanel";
import { PlayerStats } from "./rpg/PlayerStats";
import { Inventory } from "./rpg/Inventory";
import type { ItemDef } from "./rpg/Inventory";
import { ShopUI } from "./ui/ShopUI";
import type { DraggableProp } from "./world/DraggableProp";
import { GangEnemy } from "./entities/GangEnemy";
import type { GangEnemyDefeatedEvent } from "./entities/GangEnemy";
import { LootDrop, MoneyDrop } from "./entities/MoneyDrop";
import type { LootDropPayload } from "./entities/MoneyDrop";
import type { HUDInventoryItem } from "./ui/HUD";
import * as THREE from "three";

// Story stages — which Tyler quest is next. Persisted in the save file.
const STAGE_INTRO = 0; // snack run available
const STAGE_GRAFFITI = 1;
const STAGE_TRICK = 2;
const STAGE_DONE = 3; // campaign finished

const RIVAL_LOOT = [
  { id: "convenience_snack", name: "Corner Store Snack", chance: 0.45, amount: 1 },
  { id: "first_aid_tape", name: "First Aid Tape", chance: 0.14, amount: 1 },
  { id: "lucky_sticker", name: "Lucky Sticker", chance: 0.18, amount: 1 },
] as const;

const COMBAT = {
  light: { key: "KeyJ", name: "Quick Punch", damage: 24, range: 1.75, cooldown: 0.34, arcDot: 0.18 },
  heavy: { key: "KeyK", name: "Heavy Shove", damage: 39, range: 2.0, cooldown: 0.68, arcDot: 0.02 },
  skateBonusSpeed: 5.2,
  skateBonusDamage: 9,
  rivalDamage: 12,
  rivalAttackCooldown: 1.15,
  defeatPenalty: 20,
};

async function boot() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const engine = new Engine(app);
  applyPS2VisualPolish(engine);
  const input = new InputManager();

  const physics = await PhysicsWorld.create();

  const lighting = setupLighting(engine.scene);
  const level = buildLevel(engine.scene, physics);
  const dayNight = new DayNightCycle(
    lighting.sun,
    lighting.hemi,
    lighting.ambient,
    lighting.fog,
    engine.scene,
    level.nightEmissives,
    lighting.skyMaterial,
  );

  const player = new PlayerController(physics, engine.scene, input, level.rails);
  const followCamera = new FollowCamera();
  const mouseLook = new MouseLook(engine.renderer.domElement);

  const hud = new HUD(app);

  // ---- RPG state (loaded before anything that reads it) ----
  const inventory = new Inventory();
  const stats = new PlayerStats(() => inventory.ids());
  const savedData = stats.load();
  if (savedData) inventory.restore(savedData.inventory);
  let inventoryOpen = false;
  let defeatRespawnTimer = 0;
  let combatMessageTimer = 0;

  const hudInventoryItems = (): HUDInventoryItem[] =>
    inventory.stacks().map(({ item, count }) => ({
      ...item,
      quantity: count > 1 ? count : undefined,
      rarity: item.type === "quest" ? "quest" : item.rarity,
      category: item.type ?? "item",
      tags: [
        ...(item.healAmount ? [`+${item.healAmount} HP`] : []),
        item.stackable ? "stackable" : "unique",
      ],
    }));

  const refreshInventoryHud = () => {
    if (inventoryOpen) hud.setInventoryOpen(true, hudInventoryItems());
  };

  gameEvents.on("moneyChanged", ({ balance, delta }) => hud.setMoney(balance, delta));
  gameEvents.on("repChanged", ({ levelName, levelFrac }) => hud.setRep(levelName, levelFrac));
  gameEvents.on("repLevelUp", ({ levelName }) => hud.toast(`Street cred up: ${levelName.toUpperCase()}!`, "success"));
  gameEvents.on("healthChanged", ({ health, maxHealth }) => hud.setHealth(health, maxHealth));
  gameEvents.on("playerDamaged", ({ amount, source }) => {
    hud.setCombatStatus({
      label: "HIT",
      hint: `${source ?? "Impact"} -${Math.round(amount)} HP`,
      tone: "danger",
    });
    combatMessageTimer = Math.max(combatMessageTimer, 0.75);
  });
  gameEvents.on("playerDefeated", ({ source }) => {
    const penalty = Math.min(COMBAT.defeatPenalty, stats.money);
    if (penalty > 0) stats.addMoney(-penalty);
    hud.toast(`${source ?? "The street"} dropped you. Lost $${penalty}.`, "default");
    hud.setCombatStatus({ label: "DOWN", hint: "Respawning at the block", tone: "danger" });
    combatMessageTimer = 1.25;
    defeatRespawnTimer = 1.25;
  });
  // Inventory changes must persist immediately: Inventory itself doesn't know about the
  // save file, and money/rep saves can land BEFORE the item was added (confirmed live —
  // buying an item saved the post-spend wallet but not the item, losing it on reload).
  gameEvents.on("itemAdded", ({ name }) => {
    hud.toast(`Got: ${name}`);
    stats.save();
    refreshInventoryHud();
  });
  gameEvents.on("itemRemoved", () => {
    stats.save();
    refreshInventoryHud();
  });
  gameEvents.on("itemUsed", ({ name }) => hud.toast(`Used: ${name}`, "success"));
  gameEvents.on("enemyDefeated", ({ enemy, cash }) => {
    hud.toast(`${enemy} dropped loot ($${cash})`, "success");
    stats.addRep(8);
  });
  gameEvents.on("comboBanked", ({ score }) => {
    const cash = Math.max(1, Math.round(score / 10));
    stats.addMoney(cash);
    stats.addRep(Math.max(1, Math.round(score / 25)));
  });
  hud.setMoney(stats.money);
  hud.setRep(stats.repLevel.name, stats.repLevelFrac);
  hud.setHealth(stats.health, stats.maxHealth);

  // ---- NPCs ----
  const jax = new NPC(engine.scene, level.npcSpawn, "Tyler", Math.PI, { skin: 0xd9a066, shirt: 0x2a2a2a, pants: 0x252a34, shoes: 0xd8d4c8 }, [
    "cap",
    "localSkater",
  ]);
  const rosa = new NPC(engine.scene, level.rosaSpawn, "Mia", Math.PI + 0.5, { skin: 0xc98f5f, shirt: 0x17151b, sleeves: 0x17151b, pants: 0x20212a, shoes: 0xd8d4c8 }, [
    "streetHair",
    "streetJacket",
  ]);
  const otis = new NPC(engine.scene, level.otisSpawn, "Dante", 0.6, { skin: 0xb5825e, shirt: 0x3f4a56, pants: 0x292724, shoes: 0xd8d4c8 }, [
    "beanie",
    "vest",
  ]);
  const npcs = [jax, rosa, otis];

  const dialogueSystem = new DialogueSystem(hud, input);
  const questSystem = new QuestSystem(hud);
  const scoreSystem = new ScoreSystem(hud);
  const shop = new ShopUI(app, stats, inventory);
  const drops: LootDrop[] = [];
  const enemyAttackCooldowns = new WeakMap<GangEnemy, number>();
  let playerAttackCooldown = 0;

  const rivalLootTable = () => RIVAL_LOOT.map((entry) => ({ ...entry }));
  const scatteredDropPosition = (position: THREE.Vector3, index = 0): THREE.Vector3 => {
    const angle = Math.random() * Math.PI * 2 + index * 1.7;
    const radius = 0.28 + Math.random() * 0.55;
    return new THREE.Vector3(position.x + Math.cos(angle) * radius, Math.max(0.12, position.y + 0.08), position.z + Math.sin(angle) * radius);
  };

  function spawnLootDrop(position: THREE.Vector3, payload: LootDropPayload, index = 0): void {
    drops.push(new LootDrop(engine.scene, { position: scatteredDropPosition(position, index), payload, lifeSeconds: 90 }));
  }

  function spawnEnemyDrops(event: GangEnemyDefeatedEvent): void {
    if (event.rewardMoney > 0) {
      drops.push(
        new MoneyDrop(engine.scene, {
          position: scatteredDropPosition(event.position, 0),
          amount: event.rewardMoney,
          lifeSeconds: 90,
        }),
      );
    }
    event.lootTable.forEach((entry, index) => {
      if (Math.random() > (entry.chance ?? 1)) return;
      spawnLootDrop(
        event.position,
        { type: "item", id: entry.id, name: entry.name, quantity: Math.max(1, entry.amount ?? 1) },
        index + 1,
      );
    });
    gameEvents.emit("enemyDefeated", { enemy: event.enemy.name, cash: event.rewardMoney });
  }

  const enemies: GangEnemy[] = [
    new GangEnemy(engine.scene, {
      position: new THREE.Vector3(27.0, 0, -17.0),
      name: "Razor",
      gangName: "Mall Rats",
      facingYaw: Math.PI,
      rewardMoney: 18,
      lootTable: rivalLootTable(),
      onDefeated: spawnEnemyDrops,
      accessory: ["beanie", "vest"],
    }),
    new GangEnemy(engine.scene, {
      position: new THREE.Vector3(24.8, 0, -7.8),
      name: "Vex",
      gangName: "Mall Rats",
      facingYaw: -Math.PI / 2,
      maxHealth: 72,
      rewardMoney: 24,
      accessory: ["streetHair", "streetJacket"],
      lootTable: rivalLootTable(),
      onDefeated: spawnEnemyDrops,
    }),
    new GangEnemy(engine.scene, {
      position: new THREE.Vector3(-27.0, 0, 21.5),
      name: "Knuckles",
      gangName: "Mall Rats",
      facingYaw: 0.2,
      colors: { skin: 0xb5825e, shirt: 0x66221f, sleeves: 0x331214, pants: 0x1d2328, shoes: 0xd8d4c8 },
      accessory: ["beanie", "vest"],
      maxHealth: 86,
      moveSpeed: 2.0,
      rewardMoney: 30,
      lootTable: rivalLootTable(),
      onDefeated: spawnEnemyDrops,
    }),
    new GangEnemy(engine.scene, {
      position: new THREE.Vector3(24.2, 0, 10.0),
      name: "Slash",
      gangName: "Mall Rats",
      facingYaw: -0.6,
      rewardMoney: 20,
      lootTable: rivalLootTable(),
      onDefeated: spawnEnemyDrops,
    }),
  ];

  // ---- Missions ----
  const stealBeerMission = new StealBeerMission(engine.scene, level, (carrying) => player.setCarryingBeer(carrying));
  const graffitiMission = new GraffitiMission(engine.scene, level);
  const trickChallenge = new TrickChallengeMission(hud);
  const vhsMission = new VhsCollectionMission(engine.scene, hud, inventory, level.vhsSpots);
  const deliveryMission = new DeliveryMission(hud, inventory, level.otisSpawn);

  const particles = new ParticleSystem(engine.scene);
  const debugPanel = new DebugPanel(app, player);
  const audio = new AudioManager();
  const menu = new Menu(app);
  input.setLocked(true);
  menu.onStateChange = (state) => {
    input.setLocked(state !== "playing");
    if (state !== "playing") mouseLook.exit();
  };
  menu.suppressEscape = () => shop.isOpen || inventoryOpen;

  gameEvents.on("cleanLanding", ({ hard }) => {
    if (hard) {
      followCamera.addShake(CAMERA.hardLandingShake);
      particles.emitDust(player.feetPosition, 6);
    }
  });
  gameEvents.on("bail", () => {
    followCamera.addShake(CAMERA.hardLandingShake * 1.8);
    particles.emitDust(player.feetPosition, 14);
    if (defeatRespawnTimer <= 0) stats.takeDamage(9, "bail");
  });

  // ---- Campaign wiring ----
  // Side-quest flags (persisted via completedQuests in the save).
  let vhsQuestActive = false;
  let vhsReadyToTurnIn = inventory.count("vhs") === 3 && !stats.isQuestComplete("vhs");
  let deliveryDone = stats.isQuestComplete("delivery");
  let jaxHaggled = false;

  const finaleOverlay = document.createElement("div");
  finaleOverlay.id = "finale-overlay";
  finaleOverlay.innerHTML = `
    <div class="finale-title">OPENING CREDITS</div>
    <div class="finale-sub">Tyler поднимает доску. Mia щёлкает кассой, Dante включает камеру.
    Ridgeway after-hours теперь и твой фильм тоже.<br><br>HOMECOMING JAM — campaign complete. Free skate unlocked.</div>`;
  app.appendChild(finaleOverlay);
  gameEvents.on("campaignComplete", () => {
    finaleOverlay.classList.add("visible");
    setTimeout(() => finaleOverlay.classList.remove("visible"), 7000);
  });

  function completeQuestRewards(id: string, cash: number, rep: number): void {
    stats.markQuestComplete(id);
    if (cash > 0) stats.addMoney(cash);
    if (rep > 0) stats.addRep(rep);
  }

  // --- Jax dialogue chain ---
  const introTree = buildCrewIntroDialogue({
    onAccept: () => {
      jaxHaggled = false;
      stealBeerMission.start();
      questSystem.start(STEAL_BEER_QUEST, () => {
        completeQuestRewards("beer", jaxHaggled ? 40 : 20, jaxHaggled ? 25 : 60);
        stats.storyStage = STAGE_GRAFFITI;
        stats.save();
      });
    },
    onHaggle: () => {
      jaxHaggled = true;
      stealBeerMission.start();
      questSystem.start(STEAL_BEER_QUEST, () => {
        completeQuestRewards("beer", 40, 25);
        stats.storyStage = STAGE_GRAFFITI;
        stats.save();
      });
    },
  });
  const graffitiTree = buildCrewFollowUpDialogue(() => {
    graffitiMission.start();
    questSystem.start(GRAFFITI_QUEST, () => {
      completeQuestRewards("graffiti", 15, 50);
      stats.storyStage = STAGE_TRICK;
      stats.save();
    });
  });
  const trickTree = buildTrickChallengeDialogue(() => {
    trickChallenge.start((passed) => {
      if (passed) {
        hud.toast("Mission Complete: Homecoming Line", "success");
        gameEvents.emit("missionComplete", { title: "Homecoming Line" });
        completeQuestRewards("trick", 50, 120);
        stats.storyStage = STAGE_DONE;
        stats.save();
        gameEvents.emit("campaignComplete", undefined);
      }
    });
  });
  const finalTree = buildCrewFinalDialogue();

  function jaxTree(): DialogueTree {
    if (questSystem.isActive(STEAL_BEER_QUEST.id)) return buildJaxBusyDialogue("FoodMart за парковкой. Снеки сами не исчезнут.");
    if (questSystem.isActive(GRAFFITI_QUEST.id)) return buildJaxBusyDialogue("Back alley ждёт афишу. Держи линию ровно.");
    if (trickChallenge.state === "running") return buildJaxBusyDialogue("Камера крутится! Дай Homecoming line!");
    switch (stats.storyStage) {
      case STAGE_INTRO:
        return introTree;
      case STAGE_GRAFFITI:
        return graffitiTree;
      case STAGE_TRICK:
        return trickTree;
      default:
        return finalTree;
    }
  }

  // --- Rosa: shop + delivery ---
  const rosaTree = () =>
    buildRosaDialogue({
      onOpenShop: () => shop.open(),
      onStartDelivery: () => {
        deliveryMission.start((passed) => {
          if (passed) {
            deliveryDone = true;
            hud.toast("Mission Complete: Mixtape Dash", "success");
            gameEvents.emit("missionComplete", { title: "Mixtape Dash" });
            completeQuestRewards("delivery", 35, 45);
          }
        });
      },
      deliveryAvailable: () => !deliveryDone && deliveryMission.state === "idle",
      deliveryDone: () => deliveryDone,
    });

  // --- Otis: VHS collectathon ---
  const otisTree = () => {
    const tree = buildOtisDialogue({
      onStartVhs: () => {
        vhsQuestActive = true;
        vhsMission.start(() => {
          vhsReadyToTurnIn = true;
        });
      },
      vhsCount: () => inventory.count("vhs"),
      onTurnIn: () => {
        vhsReadyToTurnIn = false;
        vhsQuestActive = false;
        inventory.remove("vhs1");
        inventory.remove("vhs2");
        inventory.remove("vhs3");
        hud.toast("Mission Complete: Missing Footage", "success");
        gameEvents.emit("missionComplete", { title: "Missing Footage" });
        completeQuestRewards("vhs", 45, 80);
      },
    });
    if (vhsReadyToTurnIn) tree.start = "otisTurnIn";
    else if (vhsQuestActive || stats.isQuestComplete("vhs")) tree.start = "otisProgress";
    return tree;
  };

  // --- Quest markers over NPC heads ---
  function updateMarkers(): void {
    // Jax
    if (questSystem.isActive(STEAL_BEER_QUEST.id) || questSystem.isActive(GRAFFITI_QUEST.id) || trickChallenge.state === "running") {
      jax.setMarker("none");
    } else if (stats.storyStage < STAGE_DONE) {
      jax.setMarker("available");
    } else {
      jax.setMarker("none");
    }
    // Mia: shop always open (!) until delivery done, then plain none unless delivering
    if (deliveryMission.state === "running") rosa.setMarker("none");
    else if (!deliveryDone) rosa.setMarker("available");
    else rosa.setMarker("none");
    // Dante
    if (vhsReadyToTurnIn) otis.setMarker("turnin");
    else if (!vhsQuestActive && !stats.isQuestComplete("vhs")) otis.setMarker("available");
    else otis.setMarker("none");
  }

  // ---- Inventory toggle ----

  // Toggle physics debug wireframe with `P` for QA.
  let debugOn = false;

  // ---- Draggable props (dumpster/crate/pallet) ----
  let draggedProp: DraggableProp | null = null;
  window.addEventListener("keydown", (e) => {
    if (e.code === "KeyP") {
      debugOn = !debugOn;
      physics.toggleDebugRender(engine.scene, debugOn);
    }
  });

  function resetPlayer(): void {
    player.teleportTo(new THREE.Vector3(...PLAYER.spawnPosition), 3.72);
  }

  const flatDistanceSq = (a: THREE.Vector3, b: THREE.Vector3): number => {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return dx * dx + dz * dz;
  };

  const playerForward = (): THREE.Vector3 => new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));

  function nearestEnemy(maxRange = Infinity): GangEnemy | null {
    const playerPos = player.position;
    let best: GangEnemy | null = null;
    let bestDistSq = maxRange * maxRange;
    for (const enemy of enemies) {
      if (enemy.isDefeated) continue;
      const distSq = flatDistanceSq(enemy.position, playerPos);
      if (distSq >= bestDistSq) continue;
      bestDistSq = distSq;
      best = enemy;
    }
    return best;
  }

  function findAttackTarget(attack: typeof COMBAT.light): GangEnemy | null {
    const origin = player.position;
    const forward = playerForward();
    let best: GangEnemy | null = null;
    let bestScore = Infinity;

    for (const enemy of enemies) {
      if (enemy.isDefeated) continue;
      const toEnemy = enemy.position.clone().sub(origin);
      toEnemy.y = 0;
      const distSq = toEnemy.lengthSq();
      if (distSq > attack.range * attack.range || distSq < 0.0001) continue;
      const dist = Math.sqrt(distSq);
      const dot = toEnemy.dot(forward) / dist;
      if (dot < attack.arcDot) continue;
      const score = dist - dot * 0.5;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  function showCombatStatus(label: string, hint: string, tone: "idle" | "ready" | "warning" | "danger", seconds: number): void {
    hud.setCombatStatus({ label, hint, tone });
    combatMessageTimer = seconds;
  }

  function performPlayerAttack(heavy: boolean): void {
    if (playerAttackCooldown > 0 || stats.health <= 0 || player.state === "Ragdoll") return;
    const attack = heavy ? COMBAT.heavy : COMBAT.light;
    playerAttackCooldown = attack.cooldown;
    player.playCombatSwing(heavy);

    const target = findAttackTarget(attack);
    if (!target) {
      showCombatStatus("MISS", `${attack.name} whiffed`, "idle", 0.45);
      return;
    }

    const speedBonus =
      player.state === "Skating" && Math.abs(player.skateSpeed) >= COMBAT.skateBonusSpeed ? COMBAT.skateBonusDamage : 0;
    const damage = attack.damage + speedBonus;
    const defeated = target.takeHit(damage, player.position);
    particles.emitDust(target.position.clone().add(new THREE.Vector3(0, 0.45, 0)), heavy ? 8 : 5);
    followCamera.addShake(heavy ? 0.11 : 0.06);
    gameEvents.emit("combatHit", { target: target.name, damage });
    showCombatStatus(defeated ? "CREW DROPPED" : "HIT", `${target.name} -${damage}${speedBonus ? " speed bonus" : ""}`, defeated ? "warning" : "ready", 0.8);
  }

  function useHealingItem(): void {
    if (stats.health >= stats.maxHealth) {
      showCombatStatus("HEALTH", "Already patched up", "idle", 0.65);
      return;
    }
    const stack = inventory.stacks().find(({ item }) => item.type === "consumable" && item.healAmount);
    if (!stack) {
      showCombatStatus("BACKPACK", "No snacks or tape", "warning", 0.85);
      return;
    }
    const used: ItemDef | null = inventory.use(stack.item.id);
    if (!used) return;
    stats.heal(used.healAmount ?? 0);
    showCombatStatus("PATCHED UP", `${used.name} +${used.healAmount ?? 0} HP`, "ready", 0.9);
  }

  function collectLoot(payload: LootDropPayload): void {
    if (payload.type === "money") {
      stats.addMoney(payload.amount);
      hud.toast(`Picked up $${payload.amount}`, "success");
      return;
    }
    const quantity = Math.max(1, payload.quantity ?? 1);
    for (let i = 0; i < quantity; i++) inventory.add(payload.id);
  }

  function updateDrops(dt: number): void {
    const playerPos = player.position;
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      drop.update(dt, playerPos);
      const reward = drop.collect(playerPos);
      if (reward) {
        collectLoot(reward.payload);
        drop.dispose();
        drops.splice(i, 1);
        continue;
      }
      if (drop.isExpired) {
        drop.dispose();
        drops.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt: number, allowCombat: boolean): void {
    const playerPos = player.position;
    for (const enemy of enemies) {
      enemy.update(dt, playerPos);
      const cooldown = Math.max(0, (enemyAttackCooldowns.get(enemy) ?? 0) - dt);
      enemyAttackCooldowns.set(enemy, cooldown);
      if (!allowCombat || enemy.isDefeated || enemy.state === "staggered" || !enemy.isPlayerInAttackRange() || cooldown > 0) continue;

      enemyAttackCooldowns.set(enemy, COMBAT.rivalAttackCooldown);
      const damage = COMBAT.rivalDamage + Math.floor(Math.random() * 5);
      stats.takeDamage(damage, enemy.name);
      const dir = player.position.sub(enemy.position);
      dir.y = 0;
      if (dir.lengthSq() > 0.0001) {
        dir.normalize();
        const v = player.body.linvel();
        player.body.setLinvel({ x: v.x + dir.x * 1.3, y: v.y, z: v.z + dir.z * 1.3 }, true);
      }
      particles.emitDust(player.feetPosition, 4);
      followCamera.addShake(0.08);
      showCombatStatus("AMBUSH", `${enemy.name} hit you -${damage}`, "danger", 0.9);
    }
  }

  function updateCombat(dt: number): void {
    playerAttackCooldown = Math.max(0, playerAttackCooldown - dt);
    combatMessageTimer = Math.max(0, combatMessageTimer - dt);
    const allowCombat = menu.state === "playing" && !dialogueSystem.isOpen && defeatRespawnTimer <= 0 && stats.health > 0;

    updateEnemies(dt, allowCombat);
    updateDrops(dt);

    if (allowCombat) {
      if (input.justPressed(COMBAT.light.key)) performPlayerAttack(false);
      if (input.justPressed(COMBAT.heavy.key)) performPlayerAttack(true);
      if (input.justPressed("KeyH")) useHealingItem();
    }

    if (combatMessageTimer > 0) return;
    const near = nearestEnemy(8);
    if (near && allowCombat) {
      const dist = Math.sqrt(flatDistanceSq(near.position, player.position));
      hud.setCombatStatus({
        label: near.state === "chasing" ? "RIVAL CREW" : "RIVAL NEARBY",
        hint: dist < 2.4 ? "J quick · K shove · H snack" : `${near.name} watching the block`,
        tone: dist < 2.4 ? "danger" : "warning",
      });
    } else if (stats.health < stats.maxHealth && inventory.stacks().some(({ item }) => item.type === "consumable")) {
      hud.setCombatHint("H use snack/tape", "idle");
    } else {
      hud.setCombatStatus(null);
    }
  }

  function tick(dt: number): void {
    if (menu.state === "paused") {
      input.endFrame();
      return;
    }

    dayNight.update(dt);
    level.update(dt);

    if (defeatRespawnTimer > 0) {
      defeatRespawnTimer = Math.max(0, defeatRespawnTimer - dt);
      if (defeatRespawnTimer <= 0) {
        resetPlayer();
        stats.restoreHealth();
        hud.toast("Back on your feet", "success");
      }
    }

    // Modal panels (inventory/shop) pause gameplay input but keep the world rendering.
    if (input.justPressedRaw("KeyI") && menu.state === "playing" && !shop.isOpen && !dialogueSystem.isOpen) {
      inventoryOpen = !inventoryOpen;
      hud.setInventoryOpen(inventoryOpen, hudInventoryItems());
      input.setLocked(inventoryOpen);
    }
    if (shop.isOpen && (input.justPressedRaw("Escape") || input.justPressedRaw("KeyE"))) {
      shop.close();
      input.setLocked(false);
    }
    if (inventoryOpen && input.justPressedRaw("Escape")) {
      inventoryOpen = false;
      hud.setInventoryOpen(false);
      input.setLocked(false);
    }
    if (inventoryOpen || shop.isOpen) {
      input.endFrame();
      return;
    }

    if (input.justPressedRaw("KeyR") && menu.state === "playing") resetPlayer();

    const yawDelta = mouseLook.consumeYawDelta();
    if (!dialogueSystem.isOpen) player.yaw += yawDelta;

    player.beforePhysics(dt);
    physics.step(dt);
    player.afterPhysics();
    updateCombat(dt);
    scoreSystem.update(dt);
    for (const npc of npcs) npc.update(dt);
    updateMarkers();

    trickChallenge.update(dt);
    vhsMission.update(dt, player.position);
    deliveryMission.update(dt, player.position);

    if (player.grinding) {
      const backward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      particles.emitSparks(player.feetPosition, backward);
    }
    particles.update(dt, engine.camera);

    const camParams =
      player.state === "Ragdoll"
        ? CAMERA.ragdoll
        : player.state === "Walking"
          ? CAMERA.walk
          : player.grinding
            ? CAMERA.grind
            : CAMERA.skate;
    const speedFrac =
      player.state === "Skating"
        ? Math.min(1, Math.abs(player.grinding ? player.grindSpeed : player.skateSpeed) / SKATE.maxSpeed)
        : player.state === "Walking"
          ? player.walkSpeedFrac
          : 0;
    followCamera.update(engine.camera, player.cameraTarget, player.yaw, camParams, dt, speedFrac, 0, mouseLook.pitch);

    hud.setMode(
      player.state === "Ragdoll"
        ? "RAGDOLL"
        : player.state === "Walking"
          ? "WALK"
          : player.grinding
            ? "GRIND"
            : player.stanceLabel,
    );
    hud.setSpeed(speedFrac);
    audio.setRollIntensity(player.state === "Skating" && player.grounded && !player.grinding ? speedFrac : 0);

    // Auto-release if the player left Walking mode mid-drag (ragdoll, Tab to skate, a
    // mission/dialogue force-teleport, etc.) — a kinematic dumpster stuck to a skater or
    // a ragdoll would be a much worse bug than just dropping it.
    if (draggedProp && player.state !== "Walking") {
      draggedProp.release();
      draggedProp = null;
    }

    // ---- Interactions: hanging off a ledge > dragging > an active mission zone >
    // nearby-NPC chat > grabbing a prop. (Mia's FoodMart spot sits close enough to the
    // checkout that her talk radius used to silently swallow the "grab the snacks"
    // prompt — see StealBeerMission.wantsPrompt.)
    if (player.hanging) {
      // Hanging owns Space/S internally (ParkourSystem.updateHang) — this is just the
      // prompt. Skipping the rest of the chain avoids a mission/NPC prompt fighting for
      // the HUD line while the player is dangling off a ledge, position-wise, right
      // above/near one.
      hud.showPrompt("Space to climb up · S to drop");
    } else if (dialogueSystem.isOpen) {
      hud.hidePrompt();
      dialogueSystem.update();
    } else if (draggedProp) {
      draggedProp.update(player.position, dt);
      hud.showPrompt("Press E to let go");
      if (input.justPressedRaw("KeyE")) {
        draggedProp.release();
        draggedProp = null;
      }
    } else {
      const missionWantsPrompt =
        stealBeerMission.wantsPrompt(player.position, questSystem) ||
        graffitiMission.wantsPrompt(player.position, questSystem);
      const near = missionWantsPrompt ? undefined : npcs.find((n) => n.isPlayerInRange(player.position));
      const nearbyProp =
        !missionWantsPrompt && !near && player.state === "Walking"
          ? level.draggableProps.find((p) => p.isNearby(player.position))
          : undefined;

      if (near) {
        hud.showPrompt(`Press E to talk to ${near.name}`);
        if (input.justPressedRaw("KeyE")) {
          const tree = near === jax ? jaxTree() : near === rosa ? rosaTree() : otisTree();
          dialogueSystem.start(tree, () => {
            // Shop can be opened from inside Rosa's dialogue; keep input locked for it.
            if (shop.isOpen) input.setLocked(true);
          });
        }
      } else if (nearbyProp) {
        hud.showPrompt("Press E to grab and drag");
        if (input.justPressedRaw("KeyE")) {
          nearbyProp.grab(player.position);
          draggedProp = nearbyProp;
        }
      } else {
        hud.hidePrompt();
      }
    }
    // Always runs (not just when nothing else claimed the prompt) so the shopkeeper bust
    // check and exit check are never silently skipped for a frame while passing an NPC.
    stealBeerMission.update(player.position, questSystem, hud, input, dt);
    graffitiMission.update(player.position, questSystem, hud, input, dt);
    level.draggableProps.forEach((p) => p.syncVisual());

    if (debugOn) physics.updateDebugRender();
    debugPanel.update(player);
    input.endFrame();
  }

  (window as any).__debug = {
    engine,
    physics,
    player,
    followCamera,
    mouseLook,
    hud,
    npcs: { jax, rosa, otis },
    enemies,
    drops,
    dialogueSystem,
    questSystem,
    stats,
    inventory,
    shop,
    missions: { stealBeerMission, graffitiMission, trickChallenge, vhsMission, deliveryMission },
    draggableProps: level.draggableProps,
    dayNight,
    tick,
  };

  engine.onUpdate(tick);
  engine.start();
}

boot().catch((err) => {
  console.error("[boot] failed:", err);
});
