# Power Mode Typer - Developer Guide

**Startup:** `docker compose up -d --build` (do NOT use npm)

## Project Overview
Gamified text editor with particle effects, screen shake, and combo tracking. Built with React 19, TypeScript, Tailwind CSS.

## Core Features
- Particle System (canvas-based, spawns at caret position)
- Screen Shake (intensity scales with combo count)
- Combo System with Dynamic HUD (follows cursor position)
- 3 Themes: Retro Terminal, VS Code Modern, Modern Wild White
- Markdown Preview, Copy to Clipboard, Send to Server
- **User Authentication**: Login/logout with cookie-based session management
- Responsive Design

## Tech Stack
- React 19 + TypeScript
- Tailwind CSS (CDN) + Lucide React Icons
- HTML5 Canvas for particles (`requestAnimationFrame`)
- CSS Keyframes for UI shake
- Deployment: Docker + Nginx (multi-stage build)

## Core Architecture

### State Management (App.tsx)
- Uses `useState` + `useRef` for performance
- **Critical:** Particles stored in `particlesRef.current` NOT `useState` to avoid render cycle overhead
- Key state: `text`, `combo`, `config`, `caretY`, `hudSide`
- **Authentication state**: `user`, `showLoginModal`, `loginForm`, `loginError`, `isLoggingIn`

### Authentication System
**Cookie-based authentication** with localStorage session persistence:

**Login Flow:**
1. User clicks Lock icon → modal opens
2. Submit credentials to `/api/auth/login` (proxied via nginx)
3. Backend sets HttpOnly cookie + returns user info
4. User info stored in `localStorage` for session persistence
5. Modal closes, Send button becomes visible

**Session Management:**
- On app mount: check `localStorage` for stored user data
- On logout: clear `localStorage` and call `/api/auth/logout`
- Send API requires authentication (401 triggers re-login prompt)
- All authenticated requests use `credentials: 'include'` to send cookies

**UI Components:**
- **Login Button**: Lock icon (logged out) → Username + X icon (logged in)
- **Send Button**: Only visible when `user` state exists
- **Login Modal**: Theme-specific styling (Terminal/VS Code/Modern), backdrop blur, Enter key support

### Caret Tracking (utils/caret.ts)
Uses **Mirror Div Strategy** to get exact cursor position:
1. Creates hidden `<div>` copying textarea's computed styles
2. Inserts text up to cursor (`selectionStart`)
3. Appends `<span>` for cursor
4. Calculates span coordinates relative to viewport

### Dynamic HUD
- Vertical: Follows `caretY`
- Horizontal: Flips side based on cursor X position (left 50% → shows right, right 50% → shows left)

## Theme System
Three themes in cyclic rotation: Terminal → VS Code → Modern → Terminal
- **Terminal:** Green monochrome, CRT effects, block cursor
- **VS Code:** Dark theme, clean flat design, thin cursor
- **Modern:** White background, neon pink/cyan/yellow accents, random particle colors

**Implementation:**
- `themeMode` state: `'terminal' | 'vscode' | 'modern'`
- Theme-specific color arrays: `TERMINAL_LEVEL_COLORS`, `VSCODE_LEVEL_COLORS`, `MODERN_LEVEL_COLORS`
- Helper function: `getLevelColors(theme, level)`
- Theme flags: `isTerminal`, `isVSCode`, `isModern`
- Modern theme uses `MODERN_NEON_COLORS` for random particles regardless of power level

## Power Levels (Combo Thresholds)
| Level | Threshold | Effects |
|-------|-----------|---------|
| None | 0-9 | Minimal effects |
| Power | 10-29 | Light screen shake |
| Super Power | 30-59 | Moderate shake |
| Many Power | 60+ | Intense shake + "use with caution" warning |

Colors differ per theme (green/blue/neon), Modern theme has expanded neon palette at higher levels.

## Key Files
- `App.tsx` - Main component, state management, particle physics, authentication logic
- `types.ts` - TypeScript interfaces (PowerConfig, Particle, User, LoginResponse)
- `utils/caret.ts` - Cursor position tracking
- `nginx/default.conf` - SPA routing + API proxy (`/api/` → external server via `POST_HOST` env var)
- `docker-compose.yml` - Port mapping `5111:80`

## Important Development Notes

### Performance
- Particles MUST use `particlesRef.current` - never `useState` (causes input lag)
- `utils/caret.ts` DOM read/write is expensive - keep efficient
- Avoid heavy computations in `handleInput` (high-frequency keydown events)

### Adding New Themes
1. Update `ThemeMode` type
2. Create color constant array (e.g., `NEWTHEME_LEVEL_COLORS`, `NEWTHEME_NEON_COLORS`)
3. Update `getLevelColors()` and all color helper functions
4. Add theme flag and update all conditional rendering
5. Update theme toggle button logic
6. Add CSS styles in `index.html` (cursor, buttons, scrollbar, markdown preview)

### Adding New Levels
1. Update `PowerLevel` enum in `types.ts`
2. Update `LEVEL_COLORS` and `COMBO_THRESHOLDS` in `App.tsx`
3. Add shake keyframe in `index.html` if needed

### Layout Changes
- Main container uses `relative`, HUD uses `absolute`
- Watch `scrollTop` and `window.scrollY` interactions when modifying layout

### Authentication Security
**DO:**
- Use `credentials: 'include'` for all authenticated requests (enables cookie handling)
- Store only non-sensitive user info in `localStorage` (`{id, username}`)
- Use `type="password"` for password inputs (masks input)
- Let browser handle HttpOnly cookies automatically

**DON'T:**
- Store passwords or session tokens in `localStorage` (security risk)
- Manually extract or set cookies in JavaScript
- Send credentials in URL parameters
- Log passwords to console

## Multi-Device Real-Time Sync

**Architecture:** WebSocket-based real-time synchronization (similar to Google Docs)

### How It Works
When 2+ devices login with the same account:
1. **Auto-sync**: Content syncs automatically after typing stops (configurable debounce, default 5s)
2. **Real-time updates**: WebSocket pushes changes instantly to other devices
3. **Persistence**: Content saved to SQLite database, survives browser closure
4. **Conflict resolution**: Optimistic locking with version numbers (Last-Write-Wins)

### Tech Stack
- **Backend**: Node.js + Express + Socket.io + SQLite (sql.js)
- **Frontend**: socket.io-client + custom `useSync` hook
- **Deployment**: Docker container at `sync-server:3001`

### Key Files
- `sync-server/` - Backend sync service
  - `src/config/database.ts` - SQLite database management
  - `src/models/UserDocument.ts` - Document model with version tracking
  - `src/socket/index.ts` - WebSocket event handlers
  - `src/services/syncService.ts` - Sync logic and conflict resolution
  - `src/routes/documents.ts` - REST API endpoints
- `hooks/useSync.ts` - React hook for WebSocket connection and sync logic
- `nginx/default.conf` - WebSocket proxy configuration (`/socket.io/`)

### Configuration
Environment variables (`.env`):
- `VITE_SYNC_DEBOUNCE_MS` - Debounce delay in ms (default: 5000)
  - Controls how long after typing stops before auto-sync
  - Lower values = faster sync but more server requests
  - Higher values = less frequent sync but better performance

### WebSocket Events
**Client → Server:**
- `content:update` - Send updated content with version
- `sync:request` - Request current document content

**Server → Client:**
- `content:loaded` - Initial document content on connection
- `content:updated` - Real-time update from another device
- `sync:success` - Update successful, includes new version
- `sync:conflict` - Version conflict detected
- `sync:error` - Sync operation failed

### Sync Status Indicators
Visual feedback in header (visible when logged in):
- **Green dot** - Connected to sync server
- **Red dot** - Disconnected from server
- **Yellow dot (pulsing)** - Pending changes waiting to sync
- **Cloud icon (pulsing)** - Currently syncing

### Important Implementation Notes
**Critical: Stable Function References**
- All callbacks passed to `useSync` MUST be wrapped in `useCallback`
- Prevents WebSocket reconnection on every render
- Example: `const handleContentReceived = useCallback((content) => setText(content), []);`

**Device Identification:**
- Each device gets unique ID stored in `localStorage` (`sync_device_id`)
- Prevents sync loops when receiving own updates
- Generated automatically on first visit

**Conflict Detection:**
- Client sends content with current version number
- Server checks version before updating
- Mismatch returns conflict error with server content
- Current implementation: Server wins (can be enhanced with user prompt)

**Performance:**
- Debouncing reduces server load significantly
- WebSocket connection persists for duration of session
- Updates only triggered on text changes, not every keystroke
