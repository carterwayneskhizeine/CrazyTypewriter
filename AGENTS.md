# AGENTS.md - Developer Guidelines

## Build Commands

This project uses Docker for development. **DO NOT use npm directly.**

```bash
# Start development environment
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop environment
docker-compose down

# Rebuild if changes don't appear
docker-compose up -d --build --force-recreate
```

No test or lint scripts are configured in package.json. If you need to add tests, set them up first.

## Project Overview

React 19 + TypeScript + Vite + Tailwind CSS (CDN). Gamified text editor with particle effects, screen shake, and combo tracking.

## Code Style Guidelines

### Imports and Organization
- Import React hooks: `useState, useEffect, useRef, useCallback`
- Third-party: `lucide-react` icons, `react-markdown`, `rehypeRaw`, `remarkMermaid`
- Local imports first, then third-party
- Path alias `@/` maps to root directory

### Naming Conventions
- **Constants:** UPPER_CASE (`DEFAULT_CONFIG`, `COMBO_THRESHOLDS`, `TERMINAL_LEVEL_COLORS`)
- **Components:** PascalCase (`App`, `ControlGroup`)
- **Variables/Functions:** camelCase (`getPowerLevel`, `spawnParticles`, `handleInput`)
- **State variables:** prefixed with use (`text`, `combo`, `config`, `caretY`)
- **Refs:** `ref` suffix (`canvasRef`, `particlesRef`, `lastTimeRef`)
- **Type names:** PascalCase (`PowerConfig`, `Particle`, `Coordinates`)

### TypeScript
- No explicit return types on components unless complex
- Use `interface` for object shapes (export from `types.ts`)
- Use `enum` for fixed sets of values (`PowerLevel`)
- Type literals for simple unions: `ViewMode = 'edit' | 'preview'`, `ThemeMode = 'terminal' | 'vscode' | 'modern'`
- Use `@ts-ignore` sparingly when unavoidable (e.g., setTimeout return type browser mismatch)
- No `strict` mode enabled - be explicit where types matter

### State Management Patterns
- **UI state:** `useState` (`text`, `combo`, `showConfig`, `caretY`)
- **Performance-critical data:** `useRef` - NEVER useState for particles (`particlesRef.current`)
- **Computed values:** `useCallback` for memoization (`getPowerLevel`, `updateAndDraw`)
- **Cleanup:** Return cleanup functions from `useEffect` (cancelAnimationFrame)

### Performance Critical
- Particles MUST be stored in `particlesRef.current` - using `useState` causes input lag
- DOM reads in `utils/caret.ts` are expensive - minimize calls
- Avoid heavy computations in high-frequency handlers like `handleInput`

### Helper Functions
- Define before main component when possible
- Use descriptive names: `getLevelColors`, `getPowerLevel`, `triggerShake`
- Theme helpers use pattern: `getPrimaryColor()`, `getBgColor()`, etc.
- Class helpers use pattern: `isTerminal`, `isVSCode`, `isModern` booleans

### Error Handling
- Use try/catch for async operations with `console.error`
- Set error states for user feedback (`sendStatus`: 'idle' | 'sending' | 'success' | 'error')
- Show visual feedback (icons, animations)

### Formatting
- No semicolons (consistent with existing code)
- 2-space indentation
- Arrow functions for event handlers
- Use template literals for strings
- CSS-in-JS: Tailwind classes via className prop
- Inline styles sparingly for dynamic values

### Component Structure
```tsx
// 1. Imports
// 2. Constants (UPPER_CASE)
// 3. Helper functions
// 4. Main component
//   - State declarations
//   - useEffect hooks
//   - Refs
//   - Derived state (useCallback)
//   - Handlers
//   - Render helpers
//   - Return JSX
// 5. Sub-components (after main)
```

### Theme System
Three themes cycle: Terminal → VS Code → Modern
- Use `themeMode` state: `'terminal' | 'vscode' | 'modern'`
- Theme colors in constants: `THEME_LEVEL_COLORS`, `THEME_NEON_COLORS`
- Helper: `getLevelColors(theme, level)`
- Flags: `isTerminal`, `isVSCode`, `isModern` for conditional rendering
- Update all color helpers, class helpers, and CSS styles when adding themes

### Adding New Features
1. Read existing patterns before implementing
2. Follow the same structure and conventions
3. Add types to `types.ts` if new data structures needed
4. Use utility functions for reusable logic
5. Consider performance impact - use refs for render-critical data
6. Test in Docker environment, not npm

### File Organization
```
/
├── App.tsx              # Main component (700+ lines, consider splitting)
├── types.ts             # Type definitions
├── utils/
│   └── caret.ts         # Cursor position tracking
├── index.html           # Tailwind CDN, CSS animations
├── vite.config.ts       # Vite config, path aliases
└── docker-compose.yml   # Development environment
```
