'use strict';

// Lógica pura de piezas: sin DOM, sin timers, testeable con `node --test`.
// game.js la consume vía window.PiecesLogic (script plano); los tests vía require().
// Todo dentro de un IIFE: cargado como <script> plano, top-level const/function
// declaran en el scope global compartido con game.js — sin el IIFE, colisionan
// con los nombres que game.js necesita re-declarar (COLORS, collide, etc.).
(function () {

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
  '#f06292', // PLUS   - pink
  '#9575cd', // U      - violet
  '#4db6ac', // Y      - teal
  '#ffffff', // SINGLE - reward
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
  [[0,9,0],[9,9,9],[0,9,0]],                  // PLUS   (3x3, simétrica)
  [[10,0,10],[10,10,10]],                     // U      (2 filas x 3 cols)
  [[0,11],[11,11],[0,11],[0,11]],             // Y      (4 filas x 2 cols)
  [[12]],                                      // SINGLE (1x1, solo recompensa)
];

const TETROMINO_TYPES = [1,2,3,4,5,6,7,8];
const PENTOMINO_TYPES = [9,10,11];
const SINGLE_TYPE = 12;
const PENTOMINO_TYPE_BY_NAME = { plus: 9, u: 10, y: 11 };

const LINE_SCORES = [0, 100, 300, 500, 800];

const PENTOMINO_CONFIG = {
  spawnChance: 0.12,                  // 12% por spawn (rango pedido 10-15%)
  weights: { plus: 1, u: 1, y: 1 },   // pesos relativos dentro del pool de pentominós
  lockBonus: 250,                     // bonus de puntaje al fijar un pentominó
};

const WALL_KICKS = [
  { dx: 0, dy: 0 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  { dx: -2, dy: 0 }, { dx: 2, dy: 0 },
  { dx: 0, dy: -1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
];

function collide(board, shape, ox, oy, cols, rows) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= cols || ny >= rows) return true;
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

function getRotationKicks() {
  return WALL_KICKS;
}

function pickPentominoType(rng = Math.random) {
  const entries = Object.entries(PENTOMINO_CONFIG.weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng() * total;
  for (const [name, w] of entries) {
    if (r < w) return PENTOMINO_TYPE_BY_NAME[name];
    r -= w;
  }
  return PENTOMINO_TYPE_BY_NAME[entries[0][0]];
}

function randomPieceType(rng = Math.random) {
  if (rng() < PENTOMINO_CONFIG.spawnChance) return pickPentominoType(rng);
  return TETROMINO_TYPES[Math.floor(rng() * TETROMINO_TYPES.length)];
}

function computeSpawnX(shape, cols) {
  return Math.floor(cols / 2) - Math.floor(shape[0].length / 2);
}

function computePreviewOffset(shape, boxSize) {
  return {
    offX: Math.floor((boxSize - shape[0].length) / 2),
    offY: Math.floor((boxSize - shape.length) / 2),
  };
}

function countClearedRows(board, cols) {
  let cleared = 0;
  for (let r = 0; r < board.length; r++) {
    if (board[r].length === cols && board[r].every(v => v !== 0)) cleared++;
  }
  return cleared;
}

function shouldForceSingle(clearedCount) {
  return clearedCount === 4;
}

const PiecesLogic = {
  COLORS, PIECES,
  TETROMINO_TYPES, PENTOMINO_TYPES, SINGLE_TYPE, PENTOMINO_TYPE_BY_NAME,
  LINE_SCORES, PENTOMINO_CONFIG, WALL_KICKS,
  collide, rotateCW, getRotationKicks,
  randomPieceType, pickPentominoType,
  computeSpawnX, computePreviewOffset,
  countClearedRows, shouldForceSingle,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PiecesLogic;
} else {
  window.PiecesLogic = PiecesLogic;
}

})();
