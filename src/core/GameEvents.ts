/**
 * Tiny typed pub/sub bus decoupling gameplay (tricks, grinds, bails, missions) from
 * presentation (HUD popups, audio). Systems emit; UI/audio subscribe.
 */
export interface GameEventMap {
  trick: { name: string; score: number };
  cleanLanding: { airTime: number; hard: boolean };
  bail: { reason: "bad-landing" | "hard-impact" | "big-fall" };
  grindStart: undefined;
  grindTick: { meters: number };
  grindEnd: undefined;
  missionComplete: { title: string };
  ui: { kind: "click" | "spray-start" | "spray-stop" | "purchase" };
  comboBanked: { score: number };
  moneyChanged: { balance: number; delta: number };
  repChanged: { rep: number; delta: number; levelName: string; levelFrac: number };
  repLevelUp: { levelName: string };
  healthChanged: { health: number; maxHealth: number; delta: number };
  playerDamaged: { amount: number; source?: string };
  playerDefeated: { source?: string };
  combatHit: { target: string; damage: number };
  enemyDefeated: { enemy: string; cash: number };
  itemAdded: { id: string; name: string };
  itemRemoved: { id: string };
  itemUsed: { id: string; name: string };
  campaignComplete: undefined;
}

type Handler<T> = (payload: T) => void;

class EventBus {
  private handlers = new Map<keyof GameEventMap, Set<Handler<never>>>();

  on<K extends keyof GameEventMap>(event: K, handler: Handler<GameEventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => set!.delete(handler as Handler<never>);
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => (h as Handler<GameEventMap[K]>)(payload));
  }
}

export const gameEvents = new EventBus();
