'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64B5F6', // J - blue
  '#ffb74d', // L - orange
  '#b0bec5', // N - tuerca (silver)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca (agujero central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

// Valor de celda para bloques "comodín" generados por el power-up Tinte.
// Es distinto de 0 (vacío) y de 1-8 (colores de piezas) para no pisar el sistema de colores.
const WILDCARD = -1;

// ---- Configuración de power-ups (agrupada para fácil tuning) ----
const POWERUP_CONFIG = {
  linesInterval: 10,       // cada cuántas líneas completadas se arma la siguiente pieza especial
  resetAfterTrigger: true, // si false, el excedente de líneas se arrastra al próximo ciclo
  freezeDurationMs: 5000,
  weights: { bomb: 1, lightning: 1, tint: 1, gravity: 1, freeze: 1 }, // pesos de probabilidad
  bonuses: { bomb: 150, lightning: 200, tint: 250, gravity: 100, freeze: 50 },
};

const POWERUP_ICONS = {
  bomb: { icon: '💣', label: 'BOMBA' },
  lightning: { icon: '⚡', label: 'RAYO' },
  tint: { icon: '🎨', label: 'TINTE' },
  gravity: { icon: '🌀', label: 'GRAVEDAD' },
  freeze: { icon: '❄️', label: 'CONGELAR' },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const freezeTimerEl = document.getElementById('freeze-timer');
const powerupToast = document.getElementById('powerup-toast');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let linesSincePowerUp, freezeUntil;

// Hook público: reasignable para engancharle efectos visuales/sonoros externos.
let onPowerUpTriggered = (type) => showPowerUpToast(type);

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0, powerUp: null };
}

function pickPowerUpType() {
  const entries = Object.entries(POWERUP_CONFIG.weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    if (r < w) return type;
    r -= w;
  }
  return entries[0][0];
}

// Celdas absolutas (tablero) ocupadas por una pieza en su posición actual.
function getPieceCells(piece) {
  const cells = [];
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) cells.push({ x: piece.x + c, y: piece.y + r });
  return cells;
}

// Punto de contacto = centroide de la pieza aterrizada, usado como pivote para bomba/rayo/tinte.
function getContactPoint(piece) {
  const cells = getPieceCells(piece);
  const sum = cells.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: Math.round(sum.x / cells.length), y: Math.round(sum.y / cells.length) };
}

// Gravedad por columna: compacta cada columna hacia abajo sin tocar el orden de los bloques.
function collapseColumns(targetBoard) {
  for (let c = 0; c < COLS; c++) {
    const colVals = [];
    for (let r = 0; r < ROWS; r++) if (targetBoard[r][c]) colVals.push(targetBoard[r][c]);
    const gap = ROWS - colVals.length;
    for (let r = 0; r < ROWS; r++) targetBoard[r][c] = r < gap ? 0 : colVals[r - gap];
  }
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

// ---- Estrategias de power-up (Strategy sin clases: mapa tipo -> función pura) ----
// Cada estrategia recibe (board, piece) ya fusionada en el tablero y devuelve el bonus de puntaje.

function applyBomb(targetBoard, piece) {
  const { x, y } = getContactPoint(piece);
  for (let r = y - 1; r <= y + 1; r++)
    for (let c = x - 1; c <= x + 1; c++)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) targetBoard[r][c] = 0;
  collapseColumns(targetBoard); // caso borde: bordes del tablero ya quedan recortados por el clamp de arriba
  return POWERUP_CONFIG.bonuses.bomb;
}

function applyLightning(targetBoard, piece) {
  const { x, y } = getContactPoint(piece); // caso borde: bordes del tablero -> x/y ya están dentro de rango
  for (let c = 0; c < COLS; c++) targetBoard[y][c] = 0;
  for (let r = 0; r < ROWS; r++) targetBoard[r][x] = 0;
  return POWERUP_CONFIG.bonuses.lightning;
}

function applyTint(targetBoard, piece) {
  const point = getContactPoint(piece);
  let color = targetBoard[point.y]?.[point.x];
  if (!color || color === WILDCARD) {
    const filled = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (targetBoard[r][c] && targetBoard[r][c] !== WILDCARD) filled.push(targetBoard[r][c]);
    if (!filled.length) return POWERUP_CONFIG.bonuses.tint; // caso borde: tablero sin bloques del color elegido
    color = filled[Math.floor(Math.random() * filled.length)];
  }

  const wildcardCells = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (targetBoard[r][c] === color) {
        targetBoard[r][c] = WILDCARD;
        wildcardCells.push({ r, c });
      }

  // Autocompleta filas casi llenas moviendo comodines de OTRAS filas (mover uno de la
  // misma fila solo trasladaría el hueco, no la cerraría).
  for (let r = ROWS - 1; r >= 0 && wildcardCells.length; r--) {
    const emptyCols = [];
    for (let c = 0; c < COLS; c++) if (!targetBoard[r][c]) emptyCols.push(c);
    if (!emptyCols.length) continue;
    const candidates = wildcardCells.filter(cell => cell.r !== r);
    if (emptyCols.length > candidates.length) continue;
    emptyCols.forEach(c => {
      const idx = wildcardCells.findIndex(cell => cell.r !== r);
      const source = wildcardCells.splice(idx, 1)[0];
      targetBoard[source.r][source.c] = 0;
      targetBoard[r][c] = WILDCARD;
    });
  }
  return POWERUP_CONFIG.bonuses.tint;
}

function applyGravity(targetBoard) {
  collapseColumns(targetBoard); // caso borde: tablero vacío -> collapseColumns es un no-op seguro
  return POWERUP_CONFIG.bonuses.gravity;
}

function applyFreeze() {
  freezeUntil = performance.now() + POWERUP_CONFIG.freezeDurationMs; // congelar sobre congelar: reinicia el timer
  return POWERUP_CONFIG.bonuses.freeze;
}

const POWERUP_STRATEGIES = {
  bomb: applyBomb,
  lightning: applyLightning,
  tint: applyTint,
  gravity: applyGravity,
  freeze: applyFreeze,
};

function triggerPowerUp(type, piece) {
  const bonus = POWERUP_STRATEGIES[type](board, piece);
  return { type, bonus };
}

function showPowerUpToast(type) {
  const info = POWERUP_ICONS[type];
  if (!info) return;
  powerupToast.textContent = `${info.icon} ${info.label}`;
  powerupToast.classList.remove('hidden');
  powerupToast.classList.add('show');
  clearTimeout(showPowerUpToast.timer);
  showPowerUpToast.timer = setTimeout(() => powerupToast.classList.remove('show'), 1200);
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);

    linesSincePowerUp += cleared;
    if (linesSincePowerUp >= POWERUP_CONFIG.linesInterval && !next.powerUp) {
      next.powerUp = pickPowerUpType();
      linesSincePowerUp = POWERUP_CONFIG.resetAfterTrigger
        ? 0
        : linesSincePowerUp - POWERUP_CONFIG.linesInterval;
      drawNext();
    }

    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  if (current.powerUp) {
    const result = triggerPowerUp(current.powerUp, current);
    score += result.bonus;
    onPowerUpTriggered(result.type, result);
  }
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha, special) {
  if (!colorIndex) return;
  const color = colorIndex === WILDCARD ? '#ffffff' : COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  if (special) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    context.strokeStyle = `rgba(255,255,255,${pulse})`;
    context.lineWidth = 2;
    context.strokeRect(x * size + 2, y * size + 2, size - 4, size - 4);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  const currentSpecial = !!current.powerUp;
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK, 1, currentSpecial);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const nextSpecial = !!next.powerUp;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB, 1, nextSpecial);

  if (nextSpecial) {
    nextCtx.font = '16px sans-serif';
    nextCtx.fillText(POWERUP_ICONS[next.powerUp].icon, 4, 18);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function updateFreezeHUD(remainingMs) {
  freezeTimerEl.textContent = `${(remainingMs / 1000).toFixed(1)}s`;
  freezeTimerEl.classList.remove('hidden');
}

function hideFreezeHUD() {
  freezeTimerEl.classList.add('hidden');
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;

  if (freezeUntil && ts < freezeUntil) {
    updateFreezeHUD(freezeUntil - ts); // el descenso automático está en pausa, pero mover/rotar sigue activo
  } else {
    if (freezeUntil) {
      freezeUntil = null;
      hideFreezeHUD();
    }
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  linesSincePowerUp = 0;
  freezeUntil = null;
  hideFreezeHUD();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

const themeToggle = document.getElementById('theme-toggle');

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
  localStorage.setItem('theme', theme);
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

applyTheme(localStorage.getItem('theme') ?? 'dark');

init();
