export interface StateHandlers<TContext> {
  enter?: (ctx: TContext) => void;
  exit?: (ctx: TContext) => void;
  update?: (ctx: TContext, dt: number) => void;
}

export class StateMachine<TState extends string, TContext = void> {
  private states = new Map<TState, StateHandlers<TContext>>();
  private current: TState;
  private ctx: TContext;

  constructor(initial: TState, ctx: TContext) {
    this.current = initial;
    this.ctx = ctx;
  }

  register(state: TState, handlers: StateHandlers<TContext>): this {
    this.states.set(state, handlers);
    return this;
  }

  get state(): TState {
    return this.current;
  }

  is(state: TState): boolean {
    return this.current === state;
  }

  transition(next: TState): void {
    if (next === this.current) return;
    this.states.get(this.current)?.exit?.(this.ctx);
    this.current = next;
    this.states.get(this.current)?.enter?.(this.ctx);
  }

  update(dt: number): void {
    this.states.get(this.current)?.update?.(this.ctx, dt);
  }
}
