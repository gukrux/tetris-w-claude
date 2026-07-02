'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PIECES, TETROMINO_TYPES, PENTOMINO_TYPES, SINGLE_TYPE,
  collide, rotateCW, getRotationKicks,
  randomPieceType, pickPentominoType, computeSpawnX, computePreviewOffset,
  countClearedRows, shouldForceSingle,
} = require('./pieces.js');

const COLS = 10;
const ROWS = 20;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

// ---- Rotación ----

test('plus (+) es no-op visual en sus 4 estados', () => {
  let shape = PIECES[9];
  for (let i = 0; i < 4; i++) {
    shape = rotateCW(shape);
    assert.deepEqual(shape, PIECES[9]);
  }
});

test('U alterna 2x3/3x2 y cicla en 4 pasos', () => {
  const original = PIECES[10];
  let shape = original;
  const dims = [];
  for (let i = 0; i < 4; i++) {
    shape = rotateCW(shape);
    dims.push([shape.length, shape[0].length]);
  }
  assert.deepEqual(dims[0], [3, 2]);
  assert.deepEqual(dims[1], [2, 3]);
  assert.deepEqual(dims[2], [3, 2]);
  assert.deepEqual(dims[3], [2, 3]);
  assert.deepEqual(shape, original);
});

test('Y produce 4 formas distintas sin reflexión especular y cicla en 4 pasos', () => {
  const original = PIECES[11];
  let shape = original;
  const states = [];
  for (let i = 0; i < 4; i++) {
    shape = rotateCW(shape);
    states.push(shape);
  }
  for (let i = 0; i < states.length - 1; i++) {
    assert.notDeepEqual(states[i], states[i + 1]);
  }
  assert.deepEqual(states[3], original);
});

test('single es no-op trivial', () => {
  assert.deepEqual(rotateCW(PIECES[SINGLE_TYPE]), PIECES[SINGLE_TYPE]);
});

// ---- Colisión / spawn ----

test('Y (4 filas) no colisiona en oy=0 sobre tablero vacío', () => {
  const board = emptyBoard();
  const shape = PIECES[11];
  const x = computeSpawnX(shape, COLS);
  assert.equal(collide(board, shape, x, 0, COLS, ROWS), false);
});

test('U (3 columnas) respeta bordes izquierdo/derecho', () => {
  const board = emptyBoard();
  const shape = PIECES[10]; // 2 filas x 3 columnas
  assert.equal(collide(board, shape, -1, 0, COLS, ROWS), true);
  assert.equal(collide(board, shape, COLS - 3, 0, COLS, ROWS), false);
  assert.equal(collide(board, shape, COLS - 2, 0, COLS, ROWS), true);
});

test('computeSpawnX mantiene cada pentominó dentro de [0, COLS)', () => {
  for (const type of PENTOMINO_TYPES) {
    const shape = PIECES[type];
    const x = computeSpawnX(shape, COLS);
    assert.ok(x >= 0 && x + shape[0].length <= COLS);
  }
});

test('single sobre fila llena da game over (collide -> true)', () => {
  const board = emptyBoard();
  board[0] = new Array(COLS).fill(1);
  const shape = PIECES[SINGLE_TYPE];
  const x = computeSpawnX(shape, COLS);
  assert.equal(collide(board, shape, x, 0, COLS, ROWS), true);
});

// ---- Randomizer ----

test('randomPieceType respeta el umbral spawnChance de forma determinística', () => {
  const alwaysHigh = () => 0.99;
  const alwaysLow = () => 0.01;
  for (let i = 0; i < 50; i++) {
    assert.ok(TETROMINO_TYPES.includes(randomPieceType(alwaysHigh)));
  }
  for (let i = 0; i < 50; i++) {
    assert.ok(PENTOMINO_TYPES.includes(randomPieceType(alwaysLow)));
  }
});

test('proporción de pentominós cae dentro de tolerancia con Math.random real', () => {
  const spawnChance = 0.12;
  const iterations = 10000;
  let pentominoCount = 0;
  for (let i = 0; i < iterations; i++) {
    if (PENTOMINO_TYPES.includes(randomPieceType())) pentominoCount++;
  }
  const ratio = pentominoCount / iterations;
  assert.ok(Math.abs(ratio - spawnChance) < 0.03, `ratio ${ratio} fuera de tolerancia`);
});

test('pickPentominoType distribuye ~uniforme entre los 3 tipos con pesos iguales', () => {
  const iterations = 10000;
  const counts = {};
  for (let i = 0; i < iterations; i++) {
    const type = pickPentominoType();
    counts[type] = (counts[type] || 0) + 1;
  }
  for (const type of PENTOMINO_TYPES) {
    const ratio = (counts[type] || 0) / iterations;
    assert.ok(Math.abs(ratio - 1 / 3) < 0.05, `tipo ${type}: ratio ${ratio} fuera de tolerancia`);
  }
});

// ---- Recompensa ----

test('countClearedRows detecta 4 líneas simultáneas', () => {
  const board = emptyBoard();
  for (let r = 0; r < 4; r++) board[r] = new Array(COLS).fill(1);
  assert.equal(countClearedRows(board, COLS), 4);
});

test('shouldForceSingle solo es true con exactamente 4 líneas', () => {
  assert.equal(shouldForceSingle(4), true);
  assert.equal(shouldForceSingle(0), false);
  assert.equal(shouldForceSingle(1), false);
  assert.equal(shouldForceSingle(2), false);
  assert.equal(shouldForceSingle(3), false);
});

test('un segundo trigger de single sobrescribe sin acumular', () => {
  let forcedNextType = null;
  if (shouldForceSingle(4)) forcedNextType = SINGLE_TYPE;
  if (shouldForceSingle(4)) forcedNextType = SINGLE_TYPE;
  assert.equal(forcedNextType, SINGLE_TYPE);
});

// ---- Wall kicks ----

test('getRotationKicks incluye el kick nulo primero y offsets verticales para techo', () => {
  const kicks = getRotationKicks();
  assert.deepEqual(kicks[0], { dx: 0, dy: 0 });
  assert.ok(kicks.some(k => k.dy === -1));
});

test('computePreviewOffset centra correctamente en una caja de 4', () => {
  const { offX, offY } = computePreviewOffset(PIECES[11], 4); // Y: 4x2
  assert.equal(offX, 1);
  assert.equal(offY, 0);
});
