# Power Mode Typer - Developer Guide & Architecture

## Project Overview
**Power Mode Typer** is a gamified, high-octane web-based text editor built with React and TypeScript. It mimics the "Power Mode" found in some IDE plugins and the "Many Power" meme from Google Colab.

**Core Features:**
- **Particle System:** Exploding particles spawn at the caret position upon typing.
- **Screen Shake:** The UI shakes with increasing intensity based on the "Power Level".
- **Combo System:** Tracks continuous typing streaks.
- **Dynamic HUD:** A heads-up display showing the combo count that follows the cursor's vertical position and flips sides based on horizontal position.
- **Configuration:** A settings panel to tweak physics, colors, and intensity.

---

## Tech Stack
- **Framework:** React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS (loaded via CDN in `index.html`), Lucide React (Icons).
- **Animation:** 
  - Particles: HTML5 Canvas (`requestAnimationFrame`).
  - UI Shake: CSS Keyframes.
  - Transitions: CSS Transitions.
- **Build/Env:** Standard ES modules structure (no complex bundler config required for the logic, assumes environment handles TSX/TS).
- **Deployment:** Docker, Nginx.

---

## Core Architecture

### 1. State Management (`App.tsx`)
The app uses local React state (`useState`, `useRef`) for performance-critical updates.
- **`text`**: The content of the textarea.
- **`combo`**: Current streak count. Reset via a debounce timer (`comboTimeoutRef`).
- **`config`**: User-defined settings (gravity, particle count, velocity).
- **`caretY` / `hudSide`**: Used to position the Combo HUD relative to the typing cursor.

### 2. The Physics Engine
Particles are rendered on a full-screen `<canvas>` overlaying the UI.
- **Loop:** Managed by `requestAnimationFrame` in `updateAndDraw`.
- **State:** `particlesRef` holds mutable particle objects to avoid React render cycle overhead.
- **Logic:**
  - Particles have `x`, `y`, `vx` (velocity x), `vy` (velocity y), `life`, `color`, and `size`.
  - Gravity is applied to `vy` every frame.
  - When `life <= 0`, the particle is spliced from the array.

### 3. Caret Tracking (`utils/caret.ts`)
**Crucial Logic:** To spawn particles exactly where the user is typing, we cannot simply use the mouse position.
- **Mirror Div Strategy:** 
  1. A hidden `<div>` is created copying *all* computed styles (font-family, padding, border, etc.) of the `<textarea>`.
  2. The text content *up to the cursor* (`selectionStart`) is inserted into this div.
  3. A `<span>` is appended to represent the cursor.
  4. The coordinates of this `<span>` are calculated relative to the viewport to determine `top` and `left`.

### 4. Dynamic HUD Positioning
The "Combo x" display floats near the text but avoids overlapping the current line.
- **Vertical:** Follows the `caretY` (calculated via `utils/caret.ts`).
- **Horizontal:** 
  - Calculates cursor X position relative to the textarea center.
  - **Left 50%:** HUD appears on the **Right**.
  - **Right 50%:** HUD appears on the **Left**.

---

## Power Level System
The visual intensity scales based on the `combo` count:

| Level | Threshold | Visuals |
| :--- | :--- | :--- |
| **None** | 0-9 | Gray/Slate UI. Minimal effects. |
| **POWER** | 10-29 | **Cyan/Blue**. Light screen shake (`shake-level-1`). |
| **SUPER POWER** | 30-59 | **Amber/Gold**. Moderate shake (`shake-level-2`). Increased particle count. |
| **MANY POWER** | 60+ | **Red/Rose**. Intense shake (`shake-level-3`). Max particles. "Use with caution" warning. |

---

## CSS & Animation Details
- **Shake Effects:** Defined in `index.html` as `@keyframes shake-1`, `shake-2`, `shake-3`. Applied via conditional classes.
- **Bar Drain:** The combo timer bar uses a CSS animation that resets (via React `key` prop) every time a key is pressed.

---

## Infrastructure & Docker

### 1. Docker Setup
The project is containerized using a multi-stage `Dockerfile`:
- **Stage 1 (Build):** Uses `node:20-alpine` to install dependencies and build the React app via Vite.
- **Stage 2 (Serve):** Uses `nginx:alpine` to serve the static production build.

### 2. Nginx Configuration
- **Path:** `nginx/default.conf`
- **Logic:** Configured to handle Single Page Application (SPA) routing by using `try_files $uri $uri/ /index.html` to redirect all requests to `index.html`.
- **Caching:** Basic cache-control headers are added for static assets.

### 3. Docker Compose
- **File:** `docker-compose.yml`
- **Service:** `app`
- **Port Mapping:** Host port `5111` -> Container port `80`.
- **Command:** `docker-compose up -d --build`

---

## Guide for AI Developers (Extending the project)

1.  **Modifying Physics:**
    - Always use `particlesRef.current` for logic updates. Do not move particle state into `useState` as it will cause severe input lag.
    - Update `updateAndDraw` in `App.tsx` for new movement patterns.

2.  **Adding New Levels:**
    - Update `PowerLevel` enum in `types.ts`.
    - Update `LEVEL_COLORS` and `COMBO_THRESHOLDS` in `App.tsx`.
    - Define a new Shake keyframe in `index.html` if necessary.

3.  **Layout Changes:**
    - The app relies on `relative` positioning for the `main` container and `absolute` for the HUD.
    - If changing the layout, ensure `getCaretCoordinates` handles offsets correctly. Specifically, watch out for `scrollTop` and `window.scrollY` interactions.

4.  **Performance:**
    - The app is optimized for high-frequency `keydown` events. Avoid heavy computations inside `handleInput`.
    - The `utils/caret.ts` DOM read/write is the most expensive operation; keep it efficient.