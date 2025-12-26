# Power Mode Typer - Developer Guide & Architecture
## Theme System
The app supports **three** visual themes that can be toggled via the header in a cyclic rotation:

1. **Retro Terminal Theme:**
   - Colors: Green monochrome (#00ff00, #006600, etc.)
   - Effects: CRT scanlines, screen curvature, flicker, text glow
   - Font: System default with terminal styling
   - UI Elements: ASCII borders, block cursor, retro buttons
   - Scrollbar: Green styled with glow effects

2. **VS Code Modern Theme:**
   - Colors: VS Code dark theme (#1e1e1e, #252526, #007acc, #d4d4d4)
   - Effects: Clean flat design, subtle shadows, rounded corners
   - Font: Monospace with modern styling
   - UI Elements: Thin cursor, rounded buttons, hover transitions
   - Scrollbar: Modern dark gray with rounded thumb

3. **Modern Wild White Theme:**
   - Colors: High-contrast white (#ffffff) with dark text (#1a1a1a)
   - Accent Colors: Neon pink (#ff006e), cyan (#00d9ff), yellow (#ffea00)
   - Effects: 3D button tilt, geometric background patterns, gradient waves
   - Font: Sans-serif with modern styling
   - UI Elements: Rounded buttons with 3D hover effects, neon glow accents
   - Scrollbar: Gradient (pink to cyan) with clean white track
   - Particles: Random neon colors regardless of power level

**Theme Implementation:**
- `themeMode` state controls current theme (`'terminal' | 'vscode' | 'modern'`)
- Theme-specific color arrays: `TERMINAL_LEVEL_COLORS`, `VSCODE_LEVEL_COLORS`, and `MODERN_LEVEL_COLORS`
- Helper function `getLevelColors(theme, level)` returns appropriate colors
- All UI components use conditional classes based on theme flags (`isTerminal`, `isVSCode`, `isModern`)
- Particle system dynamically switches color palettes based on theme
- Modern theme uses `MODERN_NEON_COLORS` for random particle colors

**Theme Switching:**
- Cyclic rotation: Terminal → VS Code → Modern → Terminal
- Button icons change based on current theme (Monitor → Sun → Terminal)
- All settings and features persist across theme switches

---

## Project Overview
**Power Mode Typer** is a gamified, high-octane web-based text editor built with React and TypeScript. It mimics the "Power Mode" found in some IDE plugins and the "Many Power" meme from Google Colab.

**Core Features:**
- **Particle System:** Exploding particles spawn at the caret position upon typing.
- **Screen Shake:** The UI shakes with increasing intensity based on the "Power Level".
- **Combo System:** Tracks continuous typing streaks.
- **Dynamic HUD:** A heads-up display showing the combo count that follows the cursor's vertical position and flips sides based on horizontal position.
- **Configuration:** A settings panel to tweak physics, colors, and intensity.
- **Theme System:** Two visual themes - Retro Terminal (green) and VS Code Modern (blue).
- **Markdown Preview:** Toggle between edit and preview modes with markdown rendering.
- **Copy to Clipboard:** One-click copy of editor content.
- **Send to Server:** Send editor content to an external API server via nginx proxy.
- **Responsive Design:** Mobile-friendly header with essential buttons only.

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
The visual intensity scales based on `combo` count:

**Terminal Theme (Green):**
| Level | Threshold | Visuals |
| :--- | :--- | :--- |
| **None** | 0-9 | Dim Green. Minimal effects. |
| **POWER** | 10-29 | Green shades. Light screen shake (`shake-level-1`). |
| **SUPER POWER** | 30-59 | Bright Green/White-ish. Moderate shake (`shake-level-2`). |
| **MANY POWER** | 60+ | Intense Green/White. Intense shake (`shake-level-3`). "Use with caution" warning. |

**VS Code Theme (Blue):**
| Level | Threshold | Visuals |
| :--- | :--- | :--- |
| **None** | 0-9 | Dim Gray. Minimal effects. |
| **POWER** | 10-29 | Blue shades. Light screen shake. |
| **SUPER POWER** | 30-59 | Bright Blue/White-ish. Moderate shake. |
| **MANY POWER** | 60+ | Intense Blue/White. Intense shake. |

**Modern Wild White Theme (Neon):**
| Level | Threshold | Visuals |
| :--- | :--- | :--- |
| **None** | 0-9 | Light Gray (#cccccc). Minimal effects. |
| **POWER** | 10-29 | Random Neon Pink/Cyan/Yellow. Light screen shake. |
| **SUPER POWER** | 30-59 | Expanded neon palette (includes magenta). Moderate shake. |
| **MANY POWER** | 60+ | Full neon spectrum with white. Intense shake + neon pulse animation. "⚠ use with caution" warning. |

**Note:** Modern theme particles use random neon colors from `MODERN_NEON_COLORS` regardless of power level, creating a wild, unpredictable visual effect.

---

### Markdown Preview
- Uses `react-markdown` library for rendering
- Toggle between edit and preview modes via Eye/Edit icons
- Theme-specific styling: `.markdown-preview` (terminal), `.vscode-markdown-preview` (VS Code), and `.modern-markdown-preview` (Modern Wild White)
- Supports headings, lists, code blocks, tables, blockquotes, links, etc.

### Copy to Clipboard
- One-click copy button in header (left of preview toggle)
- Uses `navigator.clipboard.writeText(text)` API
- Visual feedback: Check icon appears for 2 seconds after successful copy
- Theme-specific icon colors (terminal: white, VS Code: blue, Modern: cyan)

### Send to Server
- Send button in header (left of copy button)
- Sends editor content to an external API server via POST request
- Uses nginx proxy to avoid CORS issues - requests to `/api/messages` are proxied
- API endpoint URL is configured via `VITE_POST_HOST` environment variable (see `.env.example`)
- Visual feedback: Send icon (idle), pulsing (sending), checkmark (success), alert (error)
- The proxy URL is NOT hardcoded in code - loaded from `.env` at container build time

### Responsive Design
- **Desktop:** Full header with logo, title, subtitle, MAX STREAK counter, and all buttons
- **Mobile:** Compact header showing only essential buttons (Copy, Preview, Theme, Settings)
- Hidden elements on mobile: Logo/title section, MAX STREAK counter
- Header uses flexbox for responsive layout

---

## Infrastructure & Docker

### 1. Docker Setup
The project is containerized using a multi-stage `Dockerfile`:
- **Stage 1 (Build):** Uses `node:20-alpine` to install dependencies and build the React app via Vite.
- **Stage 2 (Serve):** Uses `nginx:alpine` to serve the static production build.

### 2. Nginx Configuration
- **Path:** `nginx/default.conf`
- **Logic:** Configured to handle Single Page Application (SPA) routing by using `try_files $uri $uri/ /index.html` to redirect all requests to `index.html`.
- **API Proxy:** `/api/` requests are proxied to the external API server to avoid CORS issues. The target URL is set via `POST_HOST` environment variable from `.env`.
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

3.  **Adding New Themes:**
    - Update `ThemeMode` type in `App.tsx` to include new theme (e.g., `'terminal' | 'vscode' | 'modern' | 'newtheme'`)
    - Create new color constant array: `NEWTHEME_LEVEL_COLORS` following existing pattern
    - For random particle colors (like Modern theme), create a separate `NEWTHEME_NEON_COLORS` array
    - Update `getLevelColors()` function to handle the new theme
    - Update all color helper functions (`getPrimaryColor()`, `getBgColor()`, etc.) to return new theme colors
    - Add theme flag: `isNewTheme = themeMode === 'newtheme'`
    - Update all class helper functions (`bodyContainerClass`, `headerClass`, etc.) to handle new theme
    - Update all conditional rendering throughout the component (use ternary chains or helper functions)
    - Update `ControlGroup` component to accept and handle the new theme
    - Update theme toggle button logic to include new theme in cycle
    - Add corresponding icon to imports and update button icon logic
    - Add Tailwind color extensions in `index.html`
    - Add comprehensive CSS styles in `index.html` (cursor, buttons, scrollbar, markdown preview, etc.)
    - Test all features with new theme (particles, combo system, markdown preview, settings panel, etc.)

4.  **Layout Changes:**
    - The app relies on `relative` positioning for the `main` container and `absolute` for the HUD.
    - If changing the layout, ensure `getCaretCoordinates` handles offsets correctly. Specifically, watch out for `scrollTop` and `window.scrollY` interactions.

5.  **Performance:**
    - The app is optimized for high-frequency `keydown` events. Avoid heavy computations inside `handleInput`.
    - The `utils/caret.ts` DOM read/write is the most expensive operation; keep it efficient.