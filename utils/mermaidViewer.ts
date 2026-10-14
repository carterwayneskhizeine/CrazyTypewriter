/**
 * Mermaid diagram viewer (plain DOM, framework-agnostic).
 *
 * Renders mermaid source to SVG with zoom (buttons / ctrl+wheel),
 * drag-to-pan, and native fullscreen (Esc to exit).
 *
 * Used by components/MermaidDiagram.tsx (ReactMarkdown `pre` override).
 * mermaid is dynamically imported so it never enters the main bundle.
 */

export interface MermaidViewerOptions {
  dark?: boolean
  maxHeight?: string
}

type ViewerCleanup = () => void

type MermaidAPI = typeof import('mermaid').default

// ── Styles (injected once, self-contained) ───────────────────────────────────

const STYLE_ID = 'mermaid-viewer-style'

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.mermaid-viewer-host { margin: 0.5em 0; }
.mermaid-viewer-box {
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}
.mermaid-viewer-box.dark { border-color: #3c3c3c; background: #1e1e1e; }
.mermaid-viewer-viewport {
  overflow: auto;
  padding: 14px;
  cursor: grab;
}
.mermaid-viewer-viewport.dragging { cursor: grabbing; user-select: none; }
.mermaid-viewer-stage { width: max-content; margin: 0 auto; line-height: 0; }
.mermaid-viewer-stage svg { display: block; }
.mermaid-viewer-toolbar {
  position: absolute;
  top: 8px;
  right: 24px; /* clear of the viewport scrollbar */
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.85);
  z-index: 5;
  opacity: 0.85;
  transition: opacity 0.15s;
}
.mermaid-viewer-box.dark .mermaid-viewer-toolbar { background: rgba(30, 30, 44, 0.85); }
.mermaid-viewer-box:hover .mermaid-viewer-toolbar { opacity: 1; }
.mv-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border: 1px solid rgba(120, 120, 140, 0.45);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.92);
  color: #333;
  cursor: pointer;
  font: 600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.mv-btn:hover { border-color: #7c8cf8; color: #4f6ef7; }
.mermaid-viewer-box.dark .mv-btn { background: rgba(30, 30, 44, 0.92); color: #ddd; }
.mermaid-viewer-box.dark .mv-btn:hover { border-color: #7c8cf8; color: #a5b4fc; }
.mermaid-viewer-box.is-fs {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  max-width: none;
  border: none;
  border-radius: 0;
  background: #0b0f19;
  z-index: 9999;
}
.mermaid-viewer-box.is-fs .mermaid-viewer-viewport {
  max-height: none;
  height: 100%;
  display: flex;
  align-items: safe center;
  justify-content: safe center;
}
.mermaid-viewer-error {
  padding: 12px 14px;
  font-size: 13px;
  color: #b91c1c;
  background: #fef2f2;
  border-top: 1px solid #fecaca;
  white-space: pre-wrap;
  word-break: break-word;
}
.mermaid-viewer-box.dark .mermaid-viewer-error { color: #fca5a5; background: #2a1215; border-top-color: #7f1d1d; }
`
  document.head.appendChild(style)
}

// ── mermaid singleton loader ─────────────────────────────────────────────────

let mermaidPromise: Promise<MermaidAPI> | null = null
let activeTheme: 'dark' | 'default' | null = null

async function loadMermaid(dark: boolean): Promise<MermaidAPI> {
  if (!mermaidPromise) mermaidPromise = import('mermaid').then((m) => m.default)
  const mermaid = await mermaidPromise
  const theme = dark ? 'dark' : 'default'
  if (activeTheme !== theme) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme })
    activeTheme = theme
  }
  return mermaid
}

let renderSeq = 0

// ── Icons ────────────────────────────────────────────────────────────────────

const ICONS = {
  minus: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
}

// ── Mount ────────────────────────────────────────────────────────────────────

/**
 * Renders a mermaid diagram into `host` and attaches the viewer UI.
 * Returns a cleanup function (removes listeners, exits fullscreen, clears DOM).
 */
export async function mountMermaidViewer(
  host: HTMLElement,
  code: string,
  options: MermaidViewerOptions = {}
): Promise<ViewerCleanup> {
  injectStyles()
  const dark = options.dark ?? false

  host.classList.add('mermaid-viewer-host')
  host.innerHTML = ''

  const box = document.createElement('div')
  box.className = 'mermaid-viewer-box' + (dark ? ' dark' : '')
  box.innerHTML = `
    <div class="mermaid-viewer-viewport"><div class="mermaid-viewer-stage"></div></div>
    <div class="mermaid-viewer-toolbar">
      <button type="button" class="mv-btn" data-mv="out" title="Zoom out">${ICONS.minus}</button>
      <button type="button" class="mv-btn" data-mv="reset" title="Reset zoom">100%</button>
      <button type="button" class="mv-btn" data-mv="in" title="Zoom in">${ICONS.plus}</button>
      <button type="button" class="mv-btn" data-mv="fs" title="Fullscreen">${ICONS.fullscreen}</button>
    </div>
    <div class="mermaid-viewer-error" hidden></div>`
  host.appendChild(box)

  const viewport = box.querySelector<HTMLDivElement>('.mermaid-viewer-viewport')!
  const stage = box.querySelector<HTMLDivElement>('.mermaid-viewer-stage')!
  const label = box.querySelector<HTMLButtonElement>('[data-mv="reset"]')!
  const errorBox = box.querySelector<HTMLDivElement>('.mermaid-viewer-error')!
  const maxHeight = options.maxHeight ?? '460px'
  viewport.style.maxHeight = maxHeight

  const abort = new AbortController()
  const signal = abort.signal

  let width = 0
  let height = 0
  let scale = 1
  let scaleBeforeFs = 1

  const apply = (): void => {
    stage.style.width = `${Math.round(width * scale)}px`
    const svg = stage.querySelector('svg')
    if (svg) {
      svg.style.width = `${Math.round(width * scale)}px`
      svg.style.height = `${Math.round(height * scale)}px`
    }
    label.textContent = `${Math.round(scale * 100)}%`
  }

  const setScale = (next: number): void => {
    scale = Math.min(4, Math.max(0.25, next))
    apply()
  }

  // ── Render diagram ──
  try {
    const mermaid = await loadMermaid(dark)
    const { svg } = await mermaid.render(`mmd-viewer-${Date.now().toString(36)}-${renderSeq++}`, code)
    stage.innerHTML = svg
  } catch (err) {
    errorBox.hidden = false
    errorBox.textContent = `Mermaid render failed: ${err instanceof Error ? err.message : String(err)}\n\n${code}`
    return () => abort.abort()
  }

  const svgEl = stage.querySelector('svg')
  if (!svgEl) {
    errorBox.hidden = false
    errorBox.textContent = 'Mermaid render failed: empty output'
    return () => abort.abort()
  }

  const viewBox = svgEl.viewBox.baseVal
  width = viewBox.width || svgEl.getBoundingClientRect().width || 600
  height = viewBox.height || svgEl.getBoundingClientRect().height || 400
  svgEl.style.maxWidth = 'none'
  svgEl.style.width = '100%'
  svgEl.style.height = 'auto'

  // Initially fit the WHOLE diagram into the viewport (width and height), never above 100%
  const fitInitial = (): number => {
    const availW = viewport.clientWidth - 28
    const availH = viewport.clientHeight - 28
    const fits = [availW > 0 ? availW / width : 1, availH > 0 ? availH / height : 1]
    return Math.min(1, ...fits)
  }
  scale = fitInitial()
  apply()

  // ── Toolbar ──
  box.querySelector('[data-mv="in"]')?.addEventListener('click', () => setScale(scale * 1.25), { signal })
  box.querySelector('[data-mv="out"]')?.addEventListener('click', () => setScale(scale / 1.25), { signal })
  label.addEventListener('click', () => setScale(1), { signal })

  // ctrl/⌘ + wheel zoom
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setScale(scale * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
    },
    { signal, passive: false }
  )

  // ── Drag to pan ──
  let drag: { x: number; y: number; sl: number; st: number } | null = null
  viewport.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return
      drag = { x: e.clientX, y: e.clientY, sl: viewport.scrollLeft, st: viewport.scrollTop }
      viewport.classList.add('dragging')
      viewport.setPointerCapture(e.pointerId)
    },
    { signal }
  )
  viewport.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return
      viewport.scrollLeft = drag.sl - (e.clientX - drag.x)
      viewport.scrollTop = drag.st - (e.clientY - drag.y)
    },
    { signal }
  )
  const endDrag = (): void => {
    drag = null
    viewport.classList.remove('dragging')
  }
  viewport.addEventListener('pointerup', endDrag, { signal })
  viewport.addEventListener('pointercancel', endDrag, { signal })

  // ── Fullscreen ──
  const fullscreenBtn = box.querySelector<HTMLButtonElement>('[data-mv="fs"]')!
  fullscreenBtn.addEventListener(
    'click',
    () => {
      if (document.fullscreenElement === box) void document.exitFullscreen()
      else void box.requestFullscreen()
    },
    { signal }
  )
  document.addEventListener(
    'fullscreenchange',
    () => {
      const isFs = document.fullscreenElement === box
      box.classList.toggle('is-fs', isFs)
      // Inline max-height beats the .is-fs CSS rule, so switch it here too
      viewport.style.maxHeight = isFs ? 'none' : maxHeight
      if (isFs) {
        scaleBeforeFs = scale
        // Fit diagram to the window in fullscreen, zoom cap widened to 3x
        const fit = Math.min((window.innerWidth - 64) / width, (window.innerHeight - 96) / height)
        setScale(Math.min(3, Math.max(0.25, fit)))
      } else {
        setScale(scaleBeforeFs)
      }
    },
    { signal }
  )

  return () => {
    if (document.fullscreenElement === box) void document.exitFullscreen()
    abort.abort()
  }
}
