import { useEffect, useRef } from 'react';
import { mountMermaidViewer } from '../utils/mermaidViewer';

type ThemeMode = 'terminal' | 'vscode' | 'modern';

interface MermaidDiagramProps {
  code: string;
  theme: ThemeMode;
}

/**
 * Mermaid diagram with zoom / pan / fullscreen controls.
 * Replaces ```mermaid code fences in the markdown preview
 * (wired via the `pre` component override on ReactMarkdown).
 */
export function MermaidDiagram({ code, theme }: MermaidDiagramProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    // terminal/vscode are dark themes, modern is light
    const dark = theme === 'terminal' || theme === 'vscode';
    mountMermaidViewer(host, code, { dark }).then((fn) => {
      if (cancelled) fn();
      else cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [code, theme]);

  return <div ref={hostRef} />;
}
