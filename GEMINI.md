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
- **Line-Number Gutter**: left gutter in edit mode; numbers only on non-empty lines, wrap-aware (hidden mirror div measures per-logical-line height), scroll-synced with the textarea
- **Effects Toggle**: settings panel "Power Mode / Plain Mode" switch (`config.effectsEnabled`, persisted in localStorage `powerConfig`) disables shake/combo/particles/HUD for a plain editing experience
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
- **Terminal:** Electronic blue (#00BFFF) monochrome, CRT effects, block cursor
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

Colors differ per theme (electronic blue/blue/neon), Modern theme has expanded neon palette at higher levels.

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
1. **Auto-sync**: Content syncs automatically after typing stops (configurable debounce, default 1.5s)
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
- `VITE_SYNC_DEBOUNCE_MS` - Debounce delay in ms (default: 1500)
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
- **Refresh Button** (RefreshCcw icon, logged in) - Force-reconnect a dead socket and pull latest content (`refreshSync` in `useSync`); connection also auto-revives on tab visibility change / network recovery (`visibilitychange` + `online` listeners; `reconnectionAttempts: Infinity`)

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

## Android APK（安卓打包）

APK 是线上站点的全屏 WebView 壳（Capacitor remote-URL mode），启动即加载 `https://type-node.goldie-rill.top`。网页版 / Docker / nginx 零改动——所有 API 都是同源相对路径，NextAuth Cookie 与 socket.io 在 WebView 里照常工作。

**新增文件：**
- `capacitor.config.ts` — appId `top.goldierill.crazytypewriter`、`server.url` 指向线上站点、SystemBars 深色
- `mobile-www/` — Capacitor 必需的 webDir 占位页（实际不显示）
- `android/` — 生成的安卓工程（manifest 已加 `adjustResize` 软键盘适配）
- `scripts/generate-android-icons.py` — 用 Pillow 重画全部 mipmap/启动图（站点蓝 #25AEF3 + 白色键盘图形）

**构建（一次性环境：JDK 21 + Android SDK `/root/Android/Sdk`）：**
```bash
python3 scripts/generate-android-icons.py   # 仅图标改动时需要
cd android && ./gradlew assembleRelease
# 产物: android/app/build/outputs/apk/release/app-release.apk
```

**升级发新版的两个硬性要求：**
1. 用**同一个 keystore** 签名：`android/crazytypewriter.keystore` + `android/keystore.properties`（均已 gitignore，**务必离线备份**；丢失则手机必须卸载重装才能装新版）
2. `android/app/build.gradle` 里 `versionCode` 递增（1 → 2 → …）
