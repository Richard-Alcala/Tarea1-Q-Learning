// ─── Grid World Environment ───────────────────────────────────────────────────

export const GRID_SIZE = 5;

export enum Cell { Empty, Food, Trap }

export const ACTIONS = ['up', 'down', 'left', 'right'] as const;
export type Action = typeof ACTIONS[number];

export interface Pos { x: number; y: number; }

const FOOD_POS: Pos  = { x: 4, y: 0 };
const TRAP_POS: Pos  = { x: 2, y: 2 };

function randomEmptyPos(): Pos {
  let p: Pos;
  do {
    p = { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
  } while (cellAt(p) !== Cell.Empty);
  return p;
}

function posKey(p: Pos): string { return `${p.x},${p.y}`; }

export function cellAt(p: Pos): Cell {
  if (p.x === FOOD_POS.x && p.y === FOOD_POS.y) return Cell.Food;
  if (p.x === TRAP_POS.x && p.y === TRAP_POS.y) return Cell.Trap;
  return Cell.Empty;
}

function applyAction(p: Pos, a: Action): Pos {
  const n = { ...p };
  if (a === 'up')    n.y = Math.max(0, p.y - 1);
  if (a === 'down')  n.y = Math.min(GRID_SIZE - 1, p.y + 1);
  if (a === 'left')  n.x = Math.max(0, p.x - 1);
  if (a === 'right') n.x = Math.min(GRID_SIZE - 1, p.x + 1);
  return n;
}

// ─── Q-Learning Agent ─────────────────────────────────────────────────────────

const ALPHA = 0.1;   // learning rate
const GAMMA = 0.9;   // discount factor
const EPSILON = 0.2; // exploration rate

type QTable = Map<string, number>;

export class QLearningAgent {
  private q: QTable = new Map();
  pos: Pos = randomEmptyPos();
  startPos: Pos = { ...this.pos };
  totalReward = 0;

  private qKey(p: Pos, a: Action): string { return `${posKey(p)}|${a}`; }
  private qGet(p: Pos, a: Action): number  { return this.q.get(this.qKey(p, a)) ?? 0; }
  private qSet(p: Pos, a: Action, v: number): void { this.q.set(this.qKey(p, a), v); }

  private maxQ(p: Pos): number {
    return Math.max(...ACTIONS.map(a => this.qGet(p, a)));
  }

  // Problem Generator — random action (exploration)
  private problemGenerator(): Action {
    return ACTIONS[Math.floor(Math.random() * ACTIONS.length)];
  }

  // Performance Element — greedy action (exploitation)
  private performanceElement(): Action {
    let best: Action = ACTIONS[0];
    let bestVal = -Infinity;
    for (const a of ACTIONS) {
      const v = this.qGet(this.pos, a);
      if (v > bestVal) { bestVal = v; best = a; }
    }
    return best;
  }

  // Critic — assign reward based on next cell
  private critic(next: Pos): number {
    const cell = cellAt(next);
    if (cell === Cell.Food) return  1.0;
    if (cell === Cell.Trap) return -1.0;
    return -0.01;
  }

  // Learning Element — Bellman Q update
  private learningElement(s: Pos, a: Action, r: number, sNext: Pos): { oldVal: number; newVal: number } {
    const oldVal = this.qGet(s, a);
    const newVal = oldVal + ALPHA * (r + GAMMA * this.maxQ(sNext) - oldVal);
    this.qSet(s, a, newVal);
    return { oldVal, newVal };
  }

  step(): StepResult {
    const s = { ...this.pos };
    const exploring = Math.random() < EPSILON;
    const action = exploring ? this.problemGenerator() : this.performanceElement();
    const sNext = applyAction(s, action);
    const reward = this.critic(sNext);
    const { oldVal, newVal } = this.learningElement(s, action, reward, sNext);

    this.pos = sNext;
    this.totalReward += reward;

    const cell = cellAt(sNext);
    const done = cell === Cell.Food || cell === Cell.Trap;

    return { s, action, reward, sNext, oldVal, newVal, exploring, done, cell };
  }

  reset(): void {
    this.pos = randomEmptyPos();
    this.startPos = { ...this.pos };
    this.totalReward = 0;
  }

  fullReset(): void {
    this.q.clear();
    this.reset();
  }

  getTrainingLevel(): number {
    // Total possible (state, action) pairs for empty cells
    const emptyCells: Pos[] = [];
    for (let x = 0; x < GRID_SIZE; x++)
      for (let y = 0; y < GRID_SIZE; y++)
        if (cellAt({ x, y }) === Cell.Empty) emptyCells.push({ x, y });
    const total = emptyCells.length * ACTIONS.length;
    let learned = 0;
    for (const p of emptyCells)
      for (const a of ACTIONS)
        if (this.q.has(this.qKey(p, a))) learned++;
    return total === 0 ? 0 : learned / total;
  }
}

export interface StepResult {
  s: Pos; action: Action; reward: number; sNext: Pos;
  oldVal: number; newVal: number; exploring: boolean;
  done: boolean; cell: Cell;
}
