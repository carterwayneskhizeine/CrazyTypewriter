import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Zap, Flame, Crown, RefreshCcw, X, Eye, Edit, Copy, Check, Monitor, Terminal, Send, CheckCircle2, AlertCircle, Github, Sun } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { getCaretCoordinates } from './utils/caret';
import { PowerConfig, Particle, PowerLevel } from './types';

// Default Configurations
const DEFAULT_CONFIG: PowerConfig = {
  gravity: 0.8,
  particleCount: 12,
  baseRadius: 2,
  velocity: 5,
  life: 50,
  shakeIntensity: 5,
  spawnHeightOffset: 5,
};

// Colors for different levels - Terminal Green Theme
const TERMINAL_LEVEL_COLORS = {
  [PowerLevel.None]: ['#006600', '#008800'], // Dim Green
  [PowerLevel.Power]: ['#00cc00', '#00dd00', '#00ff00', '#33ff33'], // Green shades
  [PowerLevel.SuperPower]: ['#00ff00', '#33ff33', '#66ff66', '#aaffaa'], // Bright Green/White-ish
  [PowerLevel.ManyPower]: ['#00ff00', '#33ff33', '#aaffaa', '#ffffff'], // Intense Green/White
};

// Colors for different levels - VS Code Blue Theme
const VSCODE_LEVEL_COLORS = {
  [PowerLevel.None]: ['#424242', '#555555'], // Dim Gray
  [PowerLevel.Power]: ['#007acc', '#1a9fff', '#3794ff', '#4fc3f7'], // Blue shades
  [PowerLevel.SuperPower]: ['#1a9fff', '#4fc3f7', '#81d4fa', '#b3e5fc'], // Bright Blue/White-ish
  [PowerLevel.ManyPower]: ['#3794ff', '#4fc3f7', '#81d4fa', '#ffffff'], // Intense Blue/White
};

// Colors for different levels - Modern Wild White Theme
const MODERN_LEVEL_COLORS = {
  [PowerLevel.None]: ['#cccccc', '#dddddd'], // Light Gray
  [PowerLevel.Power]: ['#ff006e', '#00d9ff', '#ffea00', '#ff006e'], // Random Neon Pink/Cyan/Yellow
  [PowerLevel.SuperPower]: ['#ff006e', '#00d9ff', '#ffea00', '#ff00ff', '#00ffff'], // More neon variety
  [PowerLevel.ManyPower]: ['#ff006e', '#00d9ff', '#ffea00', '#ff00ff', '#00ffff', '#ffffff'], // Intense neon
};

// Random neon colors for Modern theme particles (used regardless of level)
const MODERN_NEON_COLORS = ['#ff006e', '#00d9ff', '#ffea00', '#ff00ff', '#00ffff', '#ff6b00'];

const getLevelColors = (theme: ThemeMode, level: PowerLevel): string[] => {
  if (theme === 'terminal') return TERMINAL_LEVEL_COLORS[level];
  if (theme === 'vscode') return VSCODE_LEVEL_COLORS[level];
  return MODERN_LEVEL_COLORS[level];
};

const COMBO_THRESHOLDS = {
  POWER: 10,
  SUPER: 30,
  MANY: 60,
};

// Helper for random range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

type ViewMode = 'edit' | 'preview';
type ThemeMode = 'terminal' | 'vscode' | 'modern';

export default function App() {
  const [text, setText] = useState<string>('Type here to unleash power...');
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [config, setConfig] = useState<PowerConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [shakeClass, setShakeClass] = useState('');
  const [caretY, setCaretY] = useState(0);
  const [hudSide, setHudSide] = useState<'left' | 'right'>('right');
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [copied, setCopied] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('terminal');
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  
  // Refs for engine
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const lastTimeRef = useRef<number>(0);
  const comboTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Derived State
  const getPowerLevel = useCallback((currentCombo: number): PowerLevel => {
    if (currentCombo >= COMBO_THRESHOLDS.MANY) return PowerLevel.ManyPower;
    if (currentCombo >= COMBO_THRESHOLDS.SUPER) return PowerLevel.SuperPower;
    if (currentCombo >= COMBO_THRESHOLDS.POWER) return PowerLevel.Power;
    return PowerLevel.None;
  }, []);

  const currentLevel = getPowerLevel(combo);

  // --- Particle Engine ---

  const spawnParticles = (x: number, y: number, level: PowerLevel) => {
    if (!canvasRef.current) return;

    // Scale quantity based on level
    let count = config.particleCount;
    if (level === PowerLevel.SuperPower) count *= 1.5;
    if (level === PowerLevel.ManyPower) count *= 2.5;

    const colors = getLevelColors(themeMode, level);

    for (let i = 0; i < count; i++) {
      const angle = random(0, Math.PI * 2);
      const velocity = random(config.velocity * 0.5, config.velocity * (level >= PowerLevel.ManyPower ? 2 : 1.2));

      // For modern theme, use random neon colors regardless of level
      const particleColor = themeMode === 'modern'
        ? MODERN_NEON_COLORS[Math.floor(random(0, MODERN_NEON_COLORS.length))]
        : colors[Math.floor(random(0, colors.length))];

      const particle: Particle = {
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1,
        color: particleColor,
        size: random(config.baseRadius, config.baseRadius * (level >= PowerLevel.ManyPower ? 2.5 : 1.5)),
        life: config.life,
        maxLife: config.life
      };

      particlesRef.current.push(particle);
    }
  };

  const updateAndDraw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resizing
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    
    // Config values usage
    // Gravity only applies strongly on higher levels or if configured explicitly
    const effectiveGravity = (currentLevel >= PowerLevel.ManyPower || config.gravity > 0.5) 
      ? config.gravity 
      : config.gravity * 0.2; // Reduced gravity for lower levels

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      
      p.x += p.vx;
      p.y += p.vy;
      p.vy += effectiveGravity;
      p.life--;
      p.alpha = p.life / p.maxLife;

      // Draw
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      ctx.globalAlpha = 1;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }

    lastTimeRef.current = requestAnimationFrame(updateAndDraw);
  }, [config, currentLevel, themeMode]);

  // Start Loop
  useEffect(() => {
    lastTimeRef.current = requestAnimationFrame(updateAndDraw);
    return () => cancelAnimationFrame(lastTimeRef.current);
  }, [updateAndDraw]);

  // --- Input Handling ---

  const triggerShake = (level: PowerLevel) => {
    let animClass = '';
    if (level === PowerLevel.Power) animClass = 'shake-level-1';
    if (level === PowerLevel.SuperPower) animClass = 'shake-level-2';
    if (level === PowerLevel.ManyPower) animClass = 'shake-level-3';

    if (animClass) {
      setShakeClass(''); // Reset to allow re-trigger
      // Force reflow/next tick
      setTimeout(() => setShakeClass(animClass), 0);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    setText(target.value);

    // Update Combo
    setCombo(prev => {
      const next = prev + 1;
      if (next > maxCombo) setMaxCombo(next);
      return next;
    });

    // Reset Combo Timer
    if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current);
    // @ts-ignore - setTimeout returns number in browser
    comboTimeoutRef.current = setTimeout(() => {
      setCombo(0);
    }, 1500 + (combo * 10)); // Higher combo gives slightly longer grace period

    // Logic for particles and effects
    const level = getPowerLevel(combo + 1); // +1 because state hasn't updated yet for render, but we know it's hit
    
    // Calculate spawn position
    const coords = getCaretCoordinates(target);
    const spawnX = coords.left;
    const spawnY = coords.top + config.spawnHeightOffset;

    // Calculate HUD position (Relative to the text area container)
    // coords.top is absolute page Y. We need Y relative to the container.
    // The container is the relative parent. The textarea is inside it.
    // We can assume the textarea top is roughly 0 relative to container, 
    // but better to be precise using bounding rects.
    const rect = target.getBoundingClientRect();
    const relativeY = coords.top - (rect.top + window.scrollY);
    
    // Determine which side to show the HUD
    // coords.left is page absolute X. rect.left is viewport X.
    // We want position relative to the element's start.
    const relativeX = coords.left - (rect.left + window.scrollX);
    const isRightHalf = relativeX > (rect.width / 2);
    
    // If cursor is on Right (>50%), HUD goes Left.
    // If cursor is on Left (<=50%), HUD goes Right.
    setHudSide(isRightHalf ? 'left' : 'right');

    // Textarea has padding (p-8 = 2rem = 32px).
    // The caret relativeY includes this padding.
    // We'll set the caretY state to this value to position the HUD.
    setCaretY(relativeY);

    // Trigger Effects
    spawnParticles(spawnX, spawnY, level);
    triggerShake(level);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSend = async () => {
    if (!text.trim()) return;

    setSendStatus('sending');
    try {
      // Use relative path - nginx will proxy to https://envsVITE_POST_HOST/api/messages
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: text }),
      });

      if (response.ok) {
        setSendStatus('success');
        setTimeout(() => setSendStatus('idle'), 2000);
      } else {
        setSendStatus('error');
        setTimeout(() => setSendStatus('idle'), 2000);
      }
    } catch (err) {
      console.error('Failed to send:', err);
      setSendStatus('error');
      setTimeout(() => setSendStatus('idle'), 2000);
    }
  };

  // --- Render Helpers ---

  const getLevelLabel = () => {
    switch (currentLevel) {
      case PowerLevel.ManyPower: return 'MANY POWER';
      case PowerLevel.SuperPower: return 'SUPER POWER';
      case PowerLevel.Power: return 'POWER';
      default: return '';
    }
  };

  const getLevelColorClass = () => {
    if (isTerminal) {
      switch (currentLevel) {
        case PowerLevel.ManyPower: return 'crt-glow text-white';
        case PowerLevel.SuperPower: return 'crt-glow text-[#aaffaa]';
        case PowerLevel.Power: return 'crt-glow-subtle text-terminal';
        default: return 'text-[#006600]';
      }
    } else if (isVSCode) {
      switch (currentLevel) {
        case PowerLevel.ManyPower: return 'text-white';
        case PowerLevel.SuperPower: return 'text-[#4fc3f7]';
        case PowerLevel.Power: return 'text-[#007acc]';
        default: return 'text-[#555555]';
      }
    } else {
      // Modern theme
      switch (currentLevel) {
        case PowerLevel.ManyPower: return 'text-[#ff006e] font-bold neon-pulse';
        case PowerLevel.SuperPower: return 'text-[#00d9ff] font-semibold';
        case PowerLevel.Power: return 'text-[#ffea00] font-medium';
        default: return 'text-[#cccccc]';
      }
    }
  };

  // Theme-based color helpers
  const getPrimaryColor = () => {
    if (themeMode === 'terminal') return '#33ff33';
    if (themeMode === 'vscode') return '#d4d4d4';
    return '#1a1a1a'; // Modern - dark gray-black
  };
  const getSecondaryColor = () => {
    if (themeMode === 'terminal') return '#008800';
    if (themeMode === 'vscode') return '#858585';
    return '#666666'; // Modern - medium gray
  };
  const getAccentColor = () => {
    if (themeMode === 'terminal') return '#00ff00';
    if (themeMode === 'vscode') return '#007acc';
    return '#ff006e'; // Modern - neon pink
  };
  const getBgColor = () => {
    if (themeMode === 'terminal') return '#000000';
    if (themeMode === 'vscode') return '#1e1e1e';
    return '#ffffff'; // Modern - pure white
  };
  const getBorderColor = () => {
    if (themeMode === 'terminal') return '#33ff33';
    if (themeMode === 'vscode') return '#3c3c3c';
    return '#e0e0e0'; // Modern - light gray border
  };
  const getHeaderBgColor = () => {
    if (themeMode === 'terminal') return '#050505';
    if (themeMode === 'vscode') return '#252526';
    return '#fafafa'; // Modern - off-white header
  };

  // Theme-based class helpers
  const isTerminal = themeMode === 'terminal';
  const isVSCode = themeMode === 'vscode';
  const isModern = themeMode === 'modern';

  const bodyContainerClass = (() => {
    if (isTerminal) return 'min-h-screen bg-terminal overflow-hidden flex flex-col crt-scanlines';
    if (isVSCode) return 'min-h-screen bg-[#1e1e1e] overflow-hidden flex flex-col';
    return 'min-h-screen bg-[#ffffff] overflow-hidden flex flex-col modern-pattern';
  })();

  const curvatureFlickerClass = isTerminal ? 'crt-curvature crt-flicker' : '';
  const headerClass = (() => {
    if (isTerminal) return 'relative z-10 flex p-2 justify-between items-center border-b-2 border-terminal bg-terminal-black';
    if (isVSCode) return 'relative z-10 flex px-3 py-2 justify-between items-center border-b border-[#3c3c3c] bg-[#252526]';
    return 'relative z-10 flex px-4 py-3 justify-between items-center border-b border-[#e0e0e0] bg-[#fafafa] shadow-sm';
  })();

  const themeBtnClass = (() => {
    if (isTerminal) return 'terminal-btn p-1';
    if (isVSCode) return 'vscode-btn p-1.5';
    return 'modern-btn p-2';
  })();

  const asciiBoxClass = (() => {
    if (isTerminal) return 'relative w-full h-full ascii-box bg-terminal-black';
    if (isVSCode) return 'relative w-full h-full vscode-box bg-[#1e1e1e]';
    return 'relative w-full h-full modern-box bg-[#ffffff]';
  })();

  const textareaClass = (() => {
    if (isTerminal) return 'block-cursor terminal-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-terminal text-terminal focus:outline-none resize-none leading-relaxed selection:bg-terminal selection:text-black';
    if (isVSCode) return 'vscode-cursor vscode-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-mono text-[#d4d4d4] focus:outline-none resize-none leading-relaxed selection:bg-[#007acc] selection:text-white rounded-md';
    return 'modern-cursor modern-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-sans text-[#1a1a1a] focus:outline-none resize-none leading-relaxed selection:bg-[#ff006e] selection:text-white rounded-lg';
  })();

  const previewClass = (() => {
    if (isTerminal) return 'terminal-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-terminal text-terminal leading-relaxed markdown-preview';
    if (isVSCode) return 'vscode-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-mono text-[#d4d4d4] leading-relaxed vscode-markdown-preview';
    return 'modern-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-sans text-[#1a1a1a] leading-relaxed modern-markdown-preview';
  })();

  const editorWrapperClass = (() => {
    const baseClass = 'w-full h-[85vh] sm:max-w-[calc(100vw-160px)] sm:h-[calc(100vh-120px)] relative z-20';
    return baseClass;
  })();

  const mainClass = `flex-1 flex flex-col items-center justify-start p-2 sm:px-[15px] sm:py-[15px] relative z-20 ${shakeClass}`;

  const configSidebarClass = (() => {
    if (isTerminal) return `fixed inset-y-0 right-0 w-80 bg-terminal border-l-2 border-terminal shadow-lg transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`;
    if (isVSCode) return `fixed inset-y-0 right-0 w-80 bg-[#252526] border-l border-[#3c3c3c] shadow-2xl transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`;
    return `fixed inset-y-0 right-0 w-80 bg-[#ffffff] border-l border-[#e0e0e0] shadow-2xl transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`;
  })();

  const rangeInputClass = (() => {
    if (isTerminal) return 'w-full terminal-range';
    if (isVSCode) return 'w-full vscode-range';
    return 'w-full modern-range';
  })();

  return (
    <div className={bodyContainerClass}>
      {isTerminal && <div className={curvatureFlickerClass} />}
      {/* Particle Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 pointer-events-none z-50 w-full h-full"
      />

      {/* Header - Show buttons on mobile, full header on desktop */}
      <header className={headerClass}>
        <div className="flex items-center gap-2 hidden sm:flex">
          <div className={`p-1 border-2 ${(() => {
            if (isTerminal) return currentLevel >= PowerLevel.ManyPower ? 'border-white animate-pulse' : 'border-terminal';
            if (isVSCode) return 'border-[#3c3c3c] rounded';
            return 'border-[#ff006e] rounded-lg';
          })()}`}>
             {currentLevel >= PowerLevel.ManyPower
              ? <Flame className={`w-4 h-4 ${isTerminal ? 'text-white crt-glow' : isVSCode ? 'text-white' : 'text-[#ff006e]'}`} />
              : <Zap className={`w-4 h-4 ${isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e]'}`} />
             }
          </div>
          <div>
            <h1 className={`font-terminal text-lg tracking-tight ${(() => {
              if (isTerminal) return 'text-terminal crt-glow';
              if (isVSCode) return 'text-[#d4d4d4] font-mono';
              return 'text-[#1a1a1a] font-sans font-bold';
            })()}`}>
              POWER
            </h1>
            <p className={`text-xs font-terminal ${(() => {
              if (isTerminal) return 'text-terminal-dim';
              if (isVSCode) return 'text-[#858585] font-mono';
              return 'text-[#666666] font-sans';
            })()}`}>
              {isTerminal ? 'TYPE FAST TO INCREASE POWER' : isVSCode ? 'Type fast to increase power' : 'Type fast to increase power'}
            </p>
          </div>
        </div>

        {/* Buttons - Show on both mobile and desktop */}
        <div className="flex items-center gap-2">
          <div className={`text-right hidden sm:block ${isTerminal ? 'font-terminal' : isVSCode ? 'font-mono' : 'font-sans'}`}>
            <div className={`text-xs uppercase tracking-wider ${isTerminal ? 'text-terminal-dim' : isVSCode ? 'text-[#858585]' : 'text-[#666666]'}`}>MAX STREAK</div>
            <div className={`text-base ${isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}`}>{maxCombo}</div>
          </div>
          <button
            onClick={handleSend}
            className={themeBtnClass}
            title={sendStatus === 'success' ? 'Sent!' : sendStatus === 'error' ? 'Failed!' : sendStatus === 'sending' ? 'Sending...' : 'Send'}
            disabled={sendStatus === 'sending'}
          >
            {sendStatus === 'success' ? (
              <CheckCircle2 className={`w-4 h-4 ${isTerminal ? 'text-terminal' : isVSCode ? 'text-[#007acc]' : 'text-[#00d9ff]'}`} />
            ) : sendStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : sendStatus === 'sending' ? (
              <Send className={`w-4 h-4 animate-pulse ${isTerminal ? 'text-terminal-dim' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
            ) : (
              <Send className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
            )}
          </button>
          <button
            onClick={handleCopy}
            className={themeBtnClass}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? <Check className={`w-4 h-4 ${isTerminal ? 'text-white' : isVSCode ? 'text-[#007acc]' : 'text-[#00d9ff]'}`} /> : <Copy className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className={themeBtnClass}
            title={viewMode === 'edit' ? 'Preview' : 'Edit'}
          >
            {viewMode === 'edit'
              ? <Eye className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
              : <Edit className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
            }
          </button>
          <button
            onClick={() => {
              if (themeMode === 'terminal') setThemeMode('vscode');
              else if (themeMode === 'vscode') setThemeMode('modern');
              else setThemeMode('terminal');
            }}
            className={themeBtnClass}
            title={`Switch to ${themeMode === 'terminal' ? 'VS Code Theme' : themeMode === 'vscode' ? 'Modern Theme' : 'Terminal Theme'}`}
          >
            {themeMode === 'terminal' ? <Monitor className="w-4 h-4" /> : themeMode === 'vscode' ? <Sun className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={themeBtnClass}
          >
            <Settings className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={mainClass}>

        {/* Text Editor Wrapper */}
        <div className={editorWrapperClass}>
          {isTerminal && <div className="absolute inset-0 bg-terminal/10 blur-xl transform scale-105 opacity-50" />}
          {isVSCode && <div className="absolute inset-0 bg-[#007acc]/5 blur-xl transform scale-105 opacity-30" />}
          {isModern && <div className="absolute inset-0 bg-[#ff006e]/5 blur-xl transform scale-105 opacity-20" />}

          {/* Dynamic Combo HUD */}
          <div
            className={`
              absolute z-40 pointer-events-none flex flex-col justify-center
              transition-all duration-300 ease-out
              ${hudSide === 'right' ? 'right-8 items-end' : 'left-8 items-start'}
              ${combo > 0 ? 'opacity-100' : 'opacity-0'}
            `}
            style={{
              top: caretY,
              transform: `translateY(-50%) translateX(${combo > 0 ? '0' : (hudSide === 'right' ? '2rem' : '-2rem')})`
            }}
          >
            <div className={`flex flex-col ${hudSide === 'right' ? 'items-end' : 'items-start'}`}>
              <div className={`relative flex items-center gap-2 ${hudSide === 'right' ? 'flex-row' : 'flex-row-reverse'}`}>
                {currentLevel >= PowerLevel.ManyPower && (
                  <span className="text-2xl animate-pulse">[**]</span>
                )}
                <span className={`font-terminal text-5xl sm:text-7xl leading-none ${getLevelColorClass()}`}>
                  {combo}x
                </span>
              </div>

              {currentLevel > PowerLevel.None && (
                <div className={`mt-1 flex flex-col ${hudSide === 'right' ? 'items-end' : 'items-start'}`}>
                   <div className={`font-terminal tracking-[0.2em] text-sm animate-pulse ${getLevelColorClass()}`}>
                    [{getLevelLabel()}]
                   </div>
                   {currentLevel === PowerLevel.ManyPower && (
                      <span className={`text-xs font-terminal ${isTerminal ? 'text-terminal-dim' : isVSCode ? 'text-[#858585]' : 'text-[#666666]'}`}>
                        {isTerminal ? 'USE WITH CAUTION' : isVSCode ? '<use with caution>' : '⚠ use with caution'}
                      </span>
                   )}
                </div>
              )}

            </div>
          </div>

          {/* Editor Box */}
          <div className={asciiBoxClass}>
            {/* Corner ASCII - Terminal only */}
            {isTerminal && (
              <>
                <div className="absolute -top-3 -left-3 text-terminal text-2xl font-terminal">+</div>
                <div className="absolute -top-3 -right-3 text-terminal text-2xl font-terminal">+</div>
                <div className="absolute -bottom-3 -left-3 text-terminal text-2xl font-terminal">+</div>
                <div className="absolute -bottom-3 -right-3 text-terminal text-2xl font-terminal">+</div>
              </>
            )}

            <textarea
              ref={inputRef}
              value={text}
              onChange={handleInput}
              spellCheck={false}
              className={textareaClass}
              placeholder={isTerminal ? "// START TYPING TO CHARGE YOUR POWER..." : isVSCode ? "// Start typing to charge your power..." : "// Start typing to unleash your power..."}
              style={{ display: viewMode === 'edit' ? 'block' : 'none' }}
            />
            <div
              className={previewClass}
              style={{ display: viewMode === 'preview' ? 'block' : 'none' }}
            >
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>

            <div className={`absolute bottom-4 right-4 text-sm font-mono pointer-events-none ${isTerminal ? 'text-terminal-dim' : isVSCode ? 'text-[#858585]' : 'text-[#999999]'}`}>
              [{text.length} CHARS]
            </div>
          </div>
        </div>
      </main>

      {/* Configuration Sidebar */}
      <div className={configSidebarClass}>
        <div className="p-6 h-full overflow-y-auto">
          <div className={`flex justify-between items-center mb-8 border-b ${isTerminal ? 'border-terminal-dim' : isVSCode ? 'border-[#3c3c3c]' : 'border-[#e0e0e0]'} pb-4`}>
            <h2 className={`text-xl flex items-center gap-2 ${(() => {
              if (isTerminal) return 'font-terminal text-terminal crt-glow';
              if (isVSCode) return 'font-mono text-[#d4d4d4]';
              return 'font-sans text-[#1a1a1a] font-bold';
            })()}`}>
              {isTerminal ? '[ CONFIG ]' : isVSCode ? 'Config' : 'Config'}
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfig(DEFAULT_CONFIG)} className={themeBtnClass}>
                <RefreshCcw className={`w-4 h-4 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className={themeBtnClass}
              >
                <X className={`w-5 h-5 ${isTerminal ? '' : isVSCode ? 'text-[#858585]' : 'text-[#cccccc]'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <ControlGroup label="PARTICLES PER KEY" themeMode={themeMode}>
              <input
                type="range" min="1" max="20" step="1"
                value={config.particleCount}
                onChange={(e) => setConfig({...config, particleCount: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-xs mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : isVSCode ? 'text-[#858585] font-mono' : 'text-[#999999] font-sans'}`}>
                <span>[1]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}>[{config.particleCount}]</span>
                <span>[20]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="GRAVITY" themeMode={themeMode}>
              <input
                type="range" min="0" max="2" step="0.05"
                value={config.gravity}
                onChange={(e) => setConfig({...config, gravity: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-xs mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : isVSCode ? 'text-[#858585] font-mono' : 'text-[#999999] font-sans'}`}>
                <span>[ZERO]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}>[{config.gravity.toFixed(2)}]</span>
                <span>[HEAVY]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="VELOCITY" themeMode={themeMode}>
              <input
                type="range" min="1" max="15" step="1"
                value={config.velocity}
                onChange={(e) => setConfig({...config, velocity: Number(e.target.value)})}
                className={rangeInputClass}
              />
               <div className={`flex justify-between text-xs mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : isVSCode ? 'text-[#858585] font-mono' : 'text-[#999999] font-sans'}`}>
                <span>[SLOW]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}>[{config.velocity}]</span>
                <span>[FAST]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="PARTICLE SIZE" themeMode={themeMode}>
              <input
                type="range" min="1" max="10" step="0.5"
                value={config.baseRadius}
                onChange={(e) => setConfig({...config, baseRadius: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-xs mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : isVSCode ? 'text-[#858585] font-mono' : 'text-[#999999] font-sans'}`}>
                <span>[SMALL]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}>[{config.baseRadius}]</span>
                <span>[LARGE]</span>
              </div>
            </ControlGroup>

            <div className={`pt-4 border-t-2 ${isTerminal ? 'border-terminal-dim' : isVSCode ? 'border-[#3c3c3c]' : 'border-[#e0e0e0]'}`}>
               <h3 className={`text-xs mb-2 ${isTerminal ? 'font-terminal text-terminal' : isVSCode ? 'font-mono text-[#858585]' : 'font-sans text-[#666666]'}`}>
                 {isTerminal ? 'THRESHOLDS:' : 'Thresholds:'}
               </h3>
               <div className={`text-xs space-y-1 ${isTerminal ? 'text-terminal-dim font-terminal' : isVSCode ? 'text-[#858585] font-mono' : 'text-[#999999] font-sans'}`}>
                 <div className="flex justify-between">
                   <span>POWER LEVEL</span>
                   <span className={isTerminal ? 'text-terminal' : isVSCode ? 'text-[#d4d4d4]' : 'text-[#1a1a1a]'}>[{COMBO_THRESHOLDS.POWER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>SUPER POWER</span>
                   <span className={isTerminal ? 'text-terminal crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#00d9ff] font-semibold'}>[{COMBO_THRESHOLDS.SUPER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>MANY POWER</span>
                   <span className={isTerminal ? 'text-white crt-glow' : isVSCode ? 'text-[#007acc]' : 'text-[#ff006e] font-bold'}>[{COMBO_THRESHOLDS.MANY}]</span>
                 </div>
                 <a
                   href="https://github.com/carterwayneskhizeine/CrazyTypewriter"
                   target="_blank"
                   rel="noopener noreferrer"
                   className={`flex items-center justify-center gap-2 mt-4 py-2 px-4 rounded transition-all duration-200 ${
                     isTerminal
                       ? 'border border-terminal text-terminal hover:bg-terminal hover:text-black'
                       : isVSCode
                       ? 'border border-[#007acc] text-[#007acc] hover:bg-[#007acc] hover:text-white'
                       : 'border border-[#ff006e] text-[#ff006e] hover:bg-[#ff006e] hover:text-white font-medium'
                   }`}
                 >
                   <Github size={18} />
                   <span>GitHub</span>
                 </a>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ControlGroup: React.FC<{ label: string; children: React.ReactNode; themeMode?: ThemeMode }> = ({ label, children, themeMode = 'terminal' }) => {
  const isTerminal = themeMode === 'terminal';
  const isVSCode = themeMode === 'vscode';
  const isModern = themeMode === 'modern';

  return (
    <div>
      <label className={`block text-xs mb-2 ${(() => {
        if (isTerminal) return 'font-terminal text-terminal crt-glow-subtle tracking-wider';
        if (isVSCode) return 'font-mono text-[#d4d4d4] tracking-wider';
        return 'font-sans text-[#1a1a1a] font-semibold tracking-wider';
      })()}`}>
        {isTerminal ? `[${label}]` : `${label}`}
      </label>
      {children}
    </div>
  );
};