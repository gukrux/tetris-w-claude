# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tetris** is a classic Tetris game implemented in vanilla JavaScript, HTML5 Canvas, and CSS with zero dependencies. It requires no build process, bundler, or transpilation—just open the HTML file or serve it with a local server.

### Tech Stack
- **HTML5 Canvas** for all rendering
- **ES6+ JavaScript** (no transpilation)
- **CSS3** with flexbox, backdrop-filter, and CSS variables
- **`requestAnimationFrame`** for the game loop
- No external dependencies, frameworks, or build tools

---

## Getting Started

### Running the Game

**Option 1: Direct file open** (may have CORS issues with some resources)
```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

**Option 2: Local server** (recommended)
```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .

# PHP
php -S localhost:8000
```
Then open `http://localhost:8000` in your browser.

---

## Architecture & Key Concepts

### Three-File Structure

1. **`index.html`**
   - DOM structure: canvas `#board` (300×600px), sidebar panel with score/lines/level/next-piece preview
   - Game-over and pause overlays
   - No build output—links directly to `style.css` and `game.js`

2. **`style.css`**
   - Dark/retro arcade aesthetic
   - Flexbox layout for the board + sidebar
   - CSS variables for colors (`--dark-bg`, `--light-text`, etc.)
   - `backdrop-filter: blur()` for overlay effects
   - Monospace font (`monospace`) for numeric displays

3. **`game.js`**
   - All game logic in one ~300-line file
   - Global state: `board` (2D matrix), `current` (active piece), `next` (queued piece), `score`, `lines`, `level`, `paused`, `gameOver`
   - **No OOP or classes**—pure functional style with global state

### Game Loop & Update Cycle

```
init()
  ├─ createBoard()      → 20×10 matrix filled with 0s
  ├─ next = randomPiece()
  ├─ spawn()            → move next→current, generate new next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)       [runs every frame]
     ├─ dt = timestamp - lastTime
     ├─ dropAccum += dt
     ├─ if dropAccum ≥ dropInterval → tryDropPiece() or lockPiece()
     ├─ draw()           [renders everything]
     └─ requestAnimationFrame(loop)

   keydown events
     ├─ ← / → → move piece left/right
     ├─ ↑ or X → rotate (with wall-kick logic)
     ├─ ↓ → soft drop (faster fall, 1 point/row)
     ├─ Space → hard drop (instant fall, 2 points/cell)
     └─ P → toggle pause
```

### Board Representation

- **`board`**: 2D array `[ROWS][COLS]` where each cell is `0` (empty) or `1–7` (piece color index)
- **Coordinates**: `(y, x)` with `y=0` at top, `y=19` at bottom
- **Collision check**: `collide(piece, x, y)` returns `true` if any block overlaps a filled cell or goes out-of-bounds

### Piece System

- **7 tetromino shapes** (I, O, T, S, Z, J, L) defined as 4×4 matrices with `0` (empty) or color index (1–7)
- **Rotation**: `rotateCW(piece)` transposes then reverses rows (90° clockwise)
- **Wall kicks**: `tryRotate()` attempts rotation at positions `[0, -1, +1, -2, +2]` (columns offset) before failing

### Line Clearing

- **`clearLines()`**: Scans board bottom-to-top; if a row is full (no zeros), remove it and insert empty row at top
- **Scoring**: `LINE_SCORES = [0, 100, 300, 500, 800]` for 0, 1, 2, 3, or 4 lines; multiply by current `level`
- **Level progression**: Every 10 lines cleared → `level++`; fall speed increases as `max(100, 1000 - (level - 1) × 90)` ms

### Ghost Piece (Preview)

- **`ghostY`**: Computed by simulating piece fall until collision; drawn at 20% opacity
- Renders with `globalAlpha = 0.2` before drawing the piece outline

---

## Customization Points

Edit these constants in `game.js` to tune the game:

| Constant      | Default | Purpose                                |
|---------------|---------|----------------------------------------|
| `COLS`        | `10`    | Board width (cells)                    |
| `ROWS`        | `20`    | Board height (cells)                   |
| `BLOCK`       | `30`    | Pixel size per cell                    |
| `COLORS`      | Array   | Color hex values for each piece type   |
| `LINE_SCORES` | `[0,100,300,500,800]` | Points per line(s) cleared |

**⚠️ If you change `COLS`, `ROWS`, or `BLOCK`, also update `<canvas id="board" width="..." height="...">` in `index.html` to match (`COLS × BLOCK` and `ROWS × BLOCK`).**

---

## Common Dev Tasks

### Adding a Feature

1. **New game mechanic** (e.g., hold piece, bag randomizer):
   - Add state variable at the top of `game.js`
   - Implement logic in the loop or key handlers
   - Update `draw()` to render new UI if needed

2. **Tweaking difficulty**:
   - Modify `dropInterval` calculation (currently `max(100, 1000 - (level - 1) × 90)`)
   - Adjust `LINE_SCORES` multipliers or level-up frequency (currently every 10 lines)

3. **Color scheme**:
   - Edit `COLORS` array in `game.js`
   - Edit CSS variables in `style.css` (`:root { --dark-bg: ...; ... }`)

### Debugging

- **Browser DevTools** (F12):
  - `console.log(board)` to inspect board state
  - Breakpoints in game loop
  - Canvas rendering is synchronous—no async issues to debug
- **Visual debugging**:
  - Temporarily increase `BLOCK` size to see cells clearly
  - Add `draw()` calls with `globalAlpha = 0.5` overlays to highlight collision zones

---

## Key Implementation Details

### Wall Kicks (Rotation Assist)

`tryRotate()` attempts rotation at these horizontal offsets (in order):
1. **0** (original position)
2. **-1, +1** (one cell left/right)
3. **-2, +2** (two cells left/right)

This allows pieces to rotate near walls without blocking rotation unnecessarily.

### Hard Drop Scoring

Hard drop (`Space`) awards **2 points per cell fallen**. The code calculates:
```javascript
const cellsFallen = current.y - ghostY;
score += cellsFallen * 2;
```

### Pause & Overlay

- **State**: `paused` boolean; when true, loop skips physics update (only draws)
- **Overlay**: `#overlay` div with `.hidden` class; removed on pause/resume or restart
- **Game Over**: Set `gameOver = true`; overlay shows final score; restart button calls `init()`

---

## Canvas & Rendering

- **Main canvas**: `#board` (300×600px) for game grid
- **Preview canvas**: `#next-canvas` (120×120px) for next piece
- **2D Context**: Uses `fillRect()`, `strokeRect()`, `fillText()` for rendering
- **No assets or images**—everything is drawn procedurally with colors

---

## Testing & Verification

No automated tests in this project. Manual verification:

1. **Piece movement & rotation**: Arrow keys and `↑` / `X` respond correctly
2. **Line clearing**: Completing rows removes them and shifts remaining blocks down
3. **Level progression**: Score and level increment correctly; pieces fall faster at higher levels
4. **Ghost piece**: Outline shows correct landing position
5. **Hard/soft drops**: Both calculate score and lock piece at board boundary
6. **Game over**: Spawning a piece in an occupied cell triggers game over
7. **Pause toggle**: `P` key pauses and resumes mid-game

---

## File Dependencies

```
index.html
  ├─ links to style.css
  ├─ links to game.js
  └─ contains canvas elements

style.css (standalone)

game.js (standalone)
  └─ queries DOM elements by ID (canvas, score, lines, level, overlay, etc.)
```

No circular dependencies or module imports; all three files are independent and can be loaded in any order (though HTML must load first).

---

## Performance Considerations

- **Canvas rendering**: Redraw entire board every frame (60 FPS target via `requestAnimationFrame`)
- **Collision detection**: `O(16)` cells per check (4×4 piece) against board
- **No optimization needed** at current scope—performance is not a bottleneck
- **Memory**: Static board (20×10 matrix) + one active piece object; garbage collection is negligible

---

## Language Note

The README and UI text are in Spanish (`es`). Comments in `game.js` are minimal (intentional). When extending, maintain the existing code style: terse, functional, no docstrings.
