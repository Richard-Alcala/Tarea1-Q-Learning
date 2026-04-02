import { GRID_SIZE, Cell, QLearningAgent, cellAt } from './gridworld';
import type { StepResult, Pos } from './gridworld';
// ─── Rendering & UI ───────────────────────────────────────────────────────────

const CELL = 90;
const PAD  = 10;

const canvas   = document.getElementById('grid') as HTMLCanvasElement;
const ctx      = canvas.getContext('2d')!;
const logEl    = document.getElementById('log') as HTMLDivElement;
const rewardEl = document.getElementById('total-reward') as HTMLSpanElement;
const statusEl = document.getElementById('step-status') as HTMLSpanElement;
const navLabel = document.getElementById('nav-label') as HTMLSpanElement;
const btnPrev  = document.getElementById('btn-prev') as HTMLButtonElement;
const btnNext  = document.getElementById('btn-next') as HTMLButtonElement;
const trainingBar = document.getElementById('training-bar') as HTMLCanvasElement;
const trainingPct = document.getElementById('training-pct') as HTMLSpanElement;
const tCtx     = trainingBar.getContext('2d')!;

canvas.width  = GRID_SIZE * CELL + PAD * 2;
canvas.height = GRID_SIZE * CELL + PAD * 3;

// Training bar height matches grid canvas
function syncTrainingBarHeight(): void {
  trainingBar.height = canvas.height;
}
syncTrainingBarHeight();

function drawTrainingBar(): void {
  const level = agent.getTrainingLevel();
  const w = trainingBar.width;
  const h = trainingBar.height;
  tCtx.clearRect(0, 0, w, h);

  // Background track
  tCtx.fillStyle = '#1e293b';
  tCtx.beginPath();
  tCtx.roundRect(2, 0, w - 4, h, 4);
  tCtx.fill();

  // Filled portion (bottom to top)
  const fillH = Math.round(h * level);
  const gradient = tCtx.createLinearGradient(0, h, 0, h - fillH);
  gradient.addColorStop(0, '#16a34a');
  gradient.addColorStop(0.6, '#22c55e');
  gradient.addColorStop(1, '#86efac');
  tCtx.fillStyle = gradient;
  tCtx.beginPath();
  tCtx.roundRect(2, h - fillH, w - 4, fillH, 4);
  tCtx.fill();

  // Draw TRAINING label rotated inside the bar
  tCtx.save();
  tCtx.translate(w / 2, h / 2);
  tCtx.rotate(-Math.PI / 2);
  tCtx.fillStyle = 'rgba(255,255,255,0.6)';
  tCtx.font = 'bold 9px Arial';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText('TRAINING', 0, 0);
  tCtx.restore();

  // Draw percentage inside bar near the fill top
  const pctY = fillH > 20 ? h - fillH + 10 : h - 10;
  tCtx.fillStyle = '#fff';
  tCtx.font = 'bold 8px Arial';
  tCtx.textAlign = 'center';
  tCtx.textBaseline = 'middle';
  tCtx.fillText(`${Math.round(level * 100)}%`, w / 2, pctY);

  trainingPct.textContent = '';
}

const agent = new QLearningAgent();

let stepCounter = 0;

interface StepHistory {
  stepNum: number;
  agentPos: Pos;
  totalReward: number;
  stepResult: StepResult;
}

let stepHistory: StepHistory[] = [];
let currentHistoryIndex = -1;
let episodeDone = false;
// Load Mario image
const marioImg = new Image();
marioImg.src = './agent.png';
let marioImageLoaded = false;

marioImg.onload = () => { marioImageLoaded = true; drawGrid(); drawTrainingBar(); };
marioImg.onerror = () => { marioImageLoaded = false; drawGrid(); drawTrainingBar(); };

function drawGrid(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ccc';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let x = 0; x < GRID_SIZE; x++) {
    const px = PAD + x * CELL + CELL / 2;
    ctx.fillText(String.fromCharCode(65 + x), px, PAD + GRID_SIZE * CELL + PAD);
  }
  for (let y = 0; y < GRID_SIZE; y++) {
    ctx.fillText(String(5 - y), PAD / 2, PAD + y * CELL + CELL / 2);
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const px = PAD + x * CELL;
      const py = PAD + y * CELL;
      ctx.strokeStyle = '#444';
      ctx.strokeRect(px, py, CELL, CELL);
      const cell = cellAt({ x, y });
      if (cell === Cell.Food) {
        ctx.fillStyle = '#2ecc71';
        ctx.beginPath();
        ctx.arc(px + CELL / 2, py + CELL / 2, CELL * 0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (cell === Cell.Trap) {
        ctx.fillStyle = '#e74c3c';
        const s = CELL * 0.55;
        ctx.fillRect(px + (CELL - s) / 2, py + (CELL - s) / 2, s, s);
      }
    }
  }

  let displayPos = agent.pos;
  if (currentHistoryIndex >= 0) {
    const h = stepHistory.find(s => s.stepNum === currentHistoryIndex);
    if (h) displayPos = h.agentPos;
  }

  // Always draw START label at the bottom of the start cell
  const start = agent.startPos;
  const sx = PAD + start.x * CELL;
  const sy = PAD + start.y * CELL;
  ctx.fillStyle = '#aaa';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('START', sx + CELL / 2, sy + CELL - 4);

  const ax = PAD + displayPos.x * CELL;
  const ay = PAD + displayPos.y * CELL;

  if (marioImageLoaded && marioImg.complete) {
    const size = CELL * 0.5;
    ctx.drawImage(marioImg, ax + (CELL - size) / 2, ay + (CELL - size) / 2, size, size);
  } else {
    const cx = ax + CELL / 2;
    const cy = ay + CELL / 2;
    const size = CELL * 0.25;
    ctx.fillStyle = '#FFDBAC';
    ctx.beginPath(); ctx.arc(cx, cy, size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#DC143C';
    ctx.beginPath(); ctx.arc(cx, cy - size * 0.3, size * 0.9, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(cx - size * 0.8, cy - size * 0.1, size * 1.6, size * 0.2);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx - size * 0.3, cy - size * 0.1, size * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + size * 0.3, cy - size * 0.1, size * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.ellipse(cx, cy + size * 0.25, size * 0.4, size * 0.15, 0, 0, Math.PI * 2); ctx.fill();
  }
}

function appendLog(msg: string, stepNum?: number): void {
  const line = document.createElement('div');
  line.textContent = msg;
  if (stepNum !== undefined) {
    line.style.cursor = 'pointer';
    line.style.backgroundColor = '#1e3a8a';
    line.style.padding = '2px 4px';
    line.style.borderRadius = '3px';
    line.style.userSelect = 'none';
    line.addEventListener('click', () => { replayToStep(stepNum); updateNavControls(); });
    line.addEventListener('mouseenter', () => { line.style.backgroundColor = '#1d4ed8'; });
    line.addEventListener('mouseleave', () => {
      line.style.backgroundColor = currentHistoryIndex === stepNum ? '#059669' : '#1e3a8a';
    });
  }
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function toChessNotation(pos: Pos): string {
  return `${String.fromCharCode(65 + pos.x)}${5 - pos.y}`;
}

function replayToStep(stepNum: number): void {
  const h = stepHistory.find(s => s.stepNum === stepNum);
  if (h) {
    currentHistoryIndex = stepNum;
    rewardEl.textContent = h.totalReward.toFixed(3);
  } else {
    currentHistoryIndex = -1;
    rewardEl.textContent = agent.totalReward.toFixed(3);
  }
  updateLogHighlighting();
  drawGrid();
}

function updateLogHighlighting(): void {
  // Reset all lines
  for (const el of Array.from(logEl.children) as HTMLElement[]) {
    if (el.style.cursor === 'pointer') el.style.backgroundColor = '#1e3a8a';
    else el.style.backgroundColor = '';
  }
  if (currentHistoryIndex < 0) return;

  // Find the header line index and highlight header + its content lines
  const lines = Array.from(logEl.children) as HTMLElement[];
  let inStep = false;
  let headerEl: HTMLElement | null = null;
  for (const el of lines) {
    if (el.textContent?.includes(`PASO ${currentHistoryIndex}`) && el.style.cursor === 'pointer') {
      el.style.backgroundColor = '#059669';
      inStep = true;
      headerEl = el;
      continue;
    }
    if (currentHistoryIndex === 0 && el.textContent?.includes('INICIO') && el.style.cursor === 'pointer') {
      el.style.backgroundColor = '#059669';
      inStep = true;
      headerEl = el;
      continue;
    }
    if (inStep) {
      // Stop when we hit the next step header or a separator line
      if (el.style.cursor === 'pointer' || el.textContent?.startsWith('══')) break;
      el.style.backgroundColor = '#064e3b';
    }
  }
  if (headerEl) headerEl.scrollIntoView({ block: 'nearest' });
}

function updateNavControls(): void {
  const total = stepHistory.length;
  const idx = currentHistoryIndex;
  const lastStep = stepHistory[total - 1]?.stepNum ?? 0;
  btnPrev.disabled = total === 0 || idx === 0 || (idx === -1 && total === 0);
  btnNext.disabled = total === 0 || idx === -1 || idx === lastStep;
  navLabel.textContent = total === 0 ? '—' : idx === -1 ? `${lastStep} / ${lastStep}` : `${idx} / ${lastStep}`;
  (document.getElementById('btn-step') as HTMLButtonElement).disabled = episodeDone;
}

function statusLabel(cell: Cell, reward: number): string {
  if (cell === Cell.Food) return `¡Comida! (+${reward.toFixed(2)})`;
  if (cell === Cell.Trap) return `¡Trampa! (${reward.toFixed(2)})`;
  return `Paso vacío (${reward.toFixed(2)})`;
}

function runStep(): boolean {
  if (episodeDone) return true;
  const r = agent.step();
  stepCounter++;
  stepHistory.push({ stepNum: stepCounter, agentPos: { ...r.sNext }, totalReward: agent.totalReward, stepResult: r });
  currentHistoryIndex = -1;

  appendLog(`╭─── PASO ${stepCounter} ───`, stepCounter);
  appendLog(`│ [Critic] Estado: ${toChessNotation(r.s)}, Acción: ${r.action}, Recompensa: ${r.reward.toFixed(2)}`);
  appendLog(`│ [Learning Element] Q(${toChessNotation(r.s)}, ${r.action}) actualizado: ${r.oldVal.toFixed(4)} -> ${r.newVal.toFixed(4)}`);
  appendLog(r.exploring
    ? `│ [Problem Generator (exploración)] Acción tomada: ${r.action}`
    : `│ [Performance Element (política actual)] Acción tomada: ${r.action}`);
  appendLog(`╰─── Resultado: ${toChessNotation(r.s)} → ${toChessNotation(r.sNext)} ───`);

  rewardEl.textContent = agent.totalReward.toFixed(3);
  statusEl.textContent = statusLabel(r.cell, r.reward);
  if (r.done) episodeDone = true;
  replayToStep(stepCounter);
  drawTrainingBar();
  updateNavControls();
  return r.done;
}

function runEpisode(): void {
  agent.reset();
  stepCounter = 0;
  stepHistory = [];
  currentHistoryIndex = -1;
  episodeDone = false;
  appendLog(`╭─── INICIO ───`, 0);
  appendLog(`╰─── Posición inicial: ${toChessNotation(agent.pos)} ───`);
  stepHistory.push({ stepNum: 0, agentPos: { ...agent.pos }, totalReward: 0, stepResult: null as any });
  replayToStep(0);
  drawGrid();
  let done = false;
  let steps = 0;
  while (!done && steps < 200) { done = runStep(); steps++; }
  appendLog(`══════ EPISODIO TERMINADO (${steps} pasos) ══════`);
  updateNavControls();
}

document.getElementById('btn-step')!.addEventListener('click', () => {
  if (episodeDone) return;
  if (stepCounter === 0 && stepHistory.length === 0) {
    appendLog(`╭─── INICIO ───`, 0);
    appendLog(`╰─── Posición inicial: ${toChessNotation(agent.pos)} ───`);
    stepHistory.push({ stepNum: 0, agentPos: { ...agent.pos }, totalReward: 0, stepResult: null as any });
  }
  const done = runStep();
  if (done) {
    appendLog('══════ EPISODIO TERMINADO ══════');
    updateNavControls();
  }
});

document.getElementById('btn-episode')!.addEventListener('click', runEpisode);

document.getElementById('btn-clear')!.addEventListener('click', () => {
  agent.reset();
  stepCounter = 0;
  stepHistory = [];
  currentHistoryIndex = -1;
  episodeDone = false;
  logEl.innerHTML = '';
  rewardEl.textContent = '0.000';
  statusEl.textContent = '—';
  drawGrid();
  drawTrainingBar();
  appendLog('═══════ CLEAR (entrenamiento conservado) ═══════');
  appendLog(`╭─── INICIO ───`, 0);
  appendLog(`╰─── Posición inicial: ${toChessNotation(agent.pos)} ───`);
  stepHistory.push({ stepNum: 0, agentPos: { ...agent.pos }, totalReward: 0, stepResult: null as any });
  replayToStep(0);
  updateNavControls();
});

document.getElementById('btn-reset')!.addEventListener('click', () => {
  agent.fullReset();
  stepCounter = 0;
  stepHistory = [];
  currentHistoryIndex = -1;
  episodeDone = false;
  logEl.innerHTML = '';
  rewardEl.textContent = '0.000';
  statusEl.textContent = '—';
  drawGrid();
  drawTrainingBar();
  updateNavControls();
  appendLog('═══════ RESET COMPLETO ═══════');
  appendLog(`╭─── INICIO ───`, 0);
  appendLog(`╰─── Posición inicial: ${toChessNotation(agent.pos)} ───`);
  stepHistory.push({ stepNum: 0, agentPos: { ...agent.pos }, totalReward: 0, stepResult: null as any });
  replayToStep(0);
  updateNavControls();
});

btnPrev.addEventListener('click', () => {
  const target = currentHistoryIndex === -1 ? stepHistory[stepHistory.length - 1].stepNum : currentHistoryIndex - 1;
  if (target >= 0) replayToStep(target);
  updateNavControls();
});

btnNext.addEventListener('click', () => {
  if (currentHistoryIndex === -1) return;
  const target = currentHistoryIndex + 1;
  const last = stepHistory[stepHistory.length - 1]?.stepNum ?? 0;
  if (target > last) {
    currentHistoryIndex = -1;
    rewardEl.textContent = agent.totalReward.toFixed(3);
    updateLogHighlighting();
    drawGrid();
  } else {
    replayToStep(target);
  }
  updateNavControls();
});

drawGrid();
drawTrainingBar();
updateNavControls();
