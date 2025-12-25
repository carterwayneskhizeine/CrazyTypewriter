import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Zap, Flame, Crown, RefreshCcw, X, Eye, Edit, Copy, Check, Monitor, Terminal } from 'lucide-react';
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

const getLevelColors = (theme: ThemeMode, level: PowerLevel): string[] => {
  return theme === 'terminal' ? TERMINAL_LEVEL_COLORS[level] : VSCODE_LEVEL_COLORS[level];
};

const COMBO_THRESHOLDS = {
  POWER: 10,
  SUPER: 30,
  MANY: 60,
};

// Helper for random range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

type ViewMode = 'edit' | 'preview';
type ThemeMode = 'terminal' | 'vscode';

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
      
      const particle: Particle = {
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        alpha: 1,
        color: colors[Math.floor(random(0, colors.length))],
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
    } else {
      switch (currentLevel) {
        case PowerLevel.ManyPower: return 'text-white';
        case PowerLevel.SuperPower: return 'text-[#4fc3f7]';
        case PowerLevel.Power: return 'text-[#007acc]';
        default: return 'text-[#555555]';
      }
    }
  };

  // Theme-based color helpers
  const getPrimaryColor = () => themeMode === 'terminal' ? '#33ff33' : '#d4d4d4';
  const getSecondaryColor = () => themeMode === 'terminal' ? '#008800' : '#858585';
  const getAccentColor = () => themeMode === 'terminal' ? '#00ff00' : '#007acc';
  const getBgColor = () => themeMode === 'terminal' ? '#000000' : '#1e1e1e';
  const getBorderColor = () => themeMode === 'terminal' ? '#33ff33' : '#3c3c3c';
  const getHeaderBgColor = () => themeMode === 'terminal' ? '#050505' : '#252526';

  // Theme-based class helpers
  const isTerminal = themeMode === 'terminal';
  const bodyContainerClass = isTerminal
    ? 'min-h-screen bg-terminal overflow-hidden flex flex-col crt-scanlines'
    : 'min-h-screen bg-[#1e1e1e] overflow-hidden flex flex-col';

  const curvatureFlickerClass = isTerminal ? 'crt-curvature crt-flicker' : '';
  const headerClass = isTerminal
    ? 'relative z-10 flex p-2 justify-between items-center border-b-2 border-terminal bg-terminal-black'
    : 'relative z-10 flex px-3 py-2 justify-between items-center border-b border-[#3c3c3c] bg-[#252526]';

  const terminalBtnClass = isTerminal
    ? 'terminal-btn p-1'
    : 'vscode-btn p-1.5';

  const asciiBoxClass = isTerminal
    ? 'relative w-full h-full ascii-box bg-terminal-black'
    : 'relative w-full h-full vscode-box bg-[#1e1e1e]';

  const textareaClass = isTerminal
    ? 'block-cursor terminal-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-terminal text-terminal focus:outline-none resize-none leading-relaxed selection:bg-terminal selection:text-black'
    : 'vscode-cursor vscode-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-mono text-[#d4d4d4] focus:outline-none resize-none leading-relaxed selection:bg-[#007acc] selection:text-white rounded-md';

  const previewClass = isTerminal
    ? 'terminal-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-terminal text-terminal leading-relaxed markdown-preview'
    : 'vscode-scrollbar w-full h-full bg-transparent border-0 p-8 text-lg sm:text-sm font-mono text-[#d4d4d4] leading-relaxed vscode-markdown-preview';

  const editorWrapperClass = isTerminal
    ? 'w-full h-[85vh] sm:max-w-[calc(100vw-160px)] sm:h-[calc(100vh-120px)] relative z-20'
    : 'w-full h-[85vh] sm:max-w-[calc(100vw-160px)] sm:h-[calc(100vh-120px)] relative z-20';

  const mainClass = isTerminal
    ? `flex-1 flex flex-col items-center justify-start p-2 sm:px-[15px] sm:py-[15px] relative z-20 ${shakeClass}`
    : `flex-1 flex flex-col items-center justify-start p-2 sm:px-[15px] sm:py-[15px] relative z-20 ${shakeClass}`;

  const configSidebarClass = isTerminal
    ? `fixed inset-y-0 right-0 w-80 bg-terminal border-l-2 border-terminal shadow-lg transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`
    : `fixed inset-y-0 right-0 w-80 bg-[#252526] border-l border-[#3c3c3c] shadow-2xl transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`;

  const rangeInputClass = isTerminal ? 'w-full terminal-range' : 'w-full vscode-range';

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
          <div className={`p-1 border-2 ${isTerminal
            ? (currentLevel >= PowerLevel.ManyPower ? 'border-white animate-pulse' : 'border-terminal')
            : 'border-[#3c3c3c] rounded'}`}>
             {currentLevel >= PowerLevel.ManyPower
              ? <Flame className={`w-4 h-4 ${isTerminal ? 'text-white crt-glow' : 'text-white'}`} />
              : <Zap className={`w-4 h-4 ${isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}`} />
             }
          </div>
          <div>
            <h1 className={`font-terminal text-lg tracking-tight ${isTerminal ? 'text-terminal crt-glow' : 'text-[#d4d4d4] font-mono'}`}>
              POWER MODE TYPER v1.0
            </h1>
            <p className={`text-xs font-terminal ${isTerminal ? 'text-terminal-dim' : 'text-[#858585] font-mono'}`}>
              {isTerminal ? 'TYPE FAST TO INCREASE POWER' : 'Type fast to increase power'}
            </p>
          </div>
        </div>

        {/* Buttons - Show on both mobile and desktop */}
        <div className="flex items-center gap-2">
          <div className={`text-right hidden sm:block ${isTerminal ? 'font-terminal' : 'font-mono'}`}>
            <div className={`text-xs uppercase tracking-wider ${isTerminal ? 'text-terminal-dim' : 'text-[#858585]'}`}>MAX STREAK</div>
            <div className={`text-base ${isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}`}>{maxCombo}</div>
          </div>
          <button
            onClick={handleCopy}
            className={terminalBtnClass}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? <Check className={`w-4 h-4 ${isTerminal ? 'text-white' : 'text-[#007acc]'}`} /> : <Copy className={`w-4 h-4 ${isTerminal ? '' : 'text-[#858585]'}`} />}
          </button>
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className={terminalBtnClass}
            title={viewMode === 'edit' ? 'Preview' : 'Edit'}
          >
            {viewMode === 'edit'
              ? <Eye className={`w-4 h-4 ${isTerminal ? '' : 'text-[#858585]'}`} />
              : <Edit className={`w-4 h-4 ${isTerminal ? '' : 'text-[#858585]'}`} />
            }
          </button>
          <button
            onClick={() => setThemeMode(themeMode === 'terminal' ? 'vscode' : 'terminal')}
            className={terminalBtnClass}
            title={`Switch to ${themeMode === 'terminal' ? 'VS Code Theme' : 'Terminal Theme'}`}
          >
            {themeMode === 'terminal' ? <Monitor className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={terminalBtnClass}
          >
            <Settings className={`w-4 h-4 ${isTerminal ? '' : 'text-[#858585]'}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={mainClass}>

        {/* Text Editor Wrapper */}
        <div className={editorWrapperClass}>
          {!isTerminal && <div className="absolute inset-0 bg-[#007acc]/5 blur-xl transform scale-105 opacity-30" />}
          {isTerminal && <div className="absolute inset-0 bg-terminal/10 blur-xl transform scale-105 opacity-50" />}

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
                      <span className={`text-xs font-terminal ${isTerminal ? 'text-terminal-dim' : 'text-[#858585]'}`}>
                        {isTerminal ? 'USE WITH CAUTION' : '<use with caution>'}
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
              placeholder={isTerminal ? "// START TYPING TO CHARGE YOUR POWER..." : "// Start typing to charge your power..."}
              style={{ display: viewMode === 'edit' ? 'block' : 'none' }}
            />
            <div
              className={previewClass}
              style={{ display: viewMode === 'preview' ? 'block' : 'none' }}
            >
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>

            <div className={`absolute bottom-4 right-4 text-sm font-mono pointer-events-none ${isTerminal ? 'text-terminal-dim' : 'text-[#858585]'}`}>
              [{text.length} CHARS]
            </div>
          </div>
        </div>
      </main>

      {/* Configuration Sidebar */}
      <div className={configSidebarClass}>
        <div className="p-6 h-full overflow-y-auto">
          <div className={`flex justify-between items-center mb-8 border-b ${isTerminal ? 'border-terminal-dim' : 'border-[#3c3c3c]'} pb-4`}>
            <h2 className={`text-xl flex items-center gap-2 ${isTerminal ? 'font-terminal text-terminal crt-glow' : 'font-mono text-[#d4d4d4]'}`}>
              {isTerminal ? '[ CONFIG ]' : 'Config'}
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfig(DEFAULT_CONFIG)} className={terminalBtnClass}>
                <RefreshCcw className={`w-4 h-4 ${isTerminal ? '' : 'text-[#858585]'}`} />
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className={terminalBtnClass}
              >
                <X className={`w-5 h-5 ${isTerminal ? '' : 'text-[#858585]'}`} />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <ControlGroup label="PARTICLES PER KEY" isTerminal={isTerminal}>
              <input
                type="range" min="1" max="20" step="1"
                value={config.particleCount}
                onChange={(e) => setConfig({...config, particleCount: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-sm mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : 'text-[#858585] font-mono'}`}>
                <span>[1]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}>[{config.particleCount}]</span>
                <span>[20]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="GRAVITY" isTerminal={isTerminal}>
              <input
                type="range" min="0" max="2" step="0.05"
                value={config.gravity}
                onChange={(e) => setConfig({...config, gravity: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-sm mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : 'text-[#858585] font-mono'}`}>
                <span>[ZERO]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}>[{config.gravity.toFixed(2)}]</span>
                <span>[HEAVY]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="VELOCITY" isTerminal={isTerminal}>
              <input
                type="range" min="1" max="15" step="1"
                value={config.velocity}
                onChange={(e) => setConfig({...config, velocity: Number(e.target.value)})}
                className={rangeInputClass}
              />
               <div className={`flex justify-between text-sm mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : 'text-[#858585] font-mono'}`}>
                <span>[SLOW]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}>[{config.velocity}]</span>
                <span>[FAST]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="PARTICLE SIZE" isTerminal={isTerminal}>
              <input
                type="range" min="1" max="10" step="0.5"
                value={config.baseRadius}
                onChange={(e) => setConfig({...config, baseRadius: Number(e.target.value)})}
                className={rangeInputClass}
              />
              <div className={`flex justify-between text-sm mt-1 ${isTerminal ? 'text-terminal-dim font-terminal' : 'text-[#858585] font-mono'}`}>
                <span>[SMALL]</span>
                <span className={isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}>[{config.baseRadius}]</span>
                <span>[LARGE]</span>
              </div>
            </ControlGroup>

            <div className={`pt-6 border-t-2 ${isTerminal ? 'border-terminal-dim' : 'border-[#3c3c3c]'}`}>
               <h3 className={`text-sm mb-2 ${isTerminal ? 'font-terminal text-terminal' : 'font-mono text-[#858585]'}`}>
                 {isTerminal ? 'THRESHOLDS:' : 'Thresholds:'}
               </h3>
               <div className={`text-sm space-y-2 ${isTerminal ? 'text-terminal-dim font-terminal' : 'text-[#858585] font-mono'}`}>
                 <div className="flex justify-between">
                   <span>POWER LEVEL</span>
                   <span className={isTerminal ? 'text-terminal' : 'text-[#d4d4d4]'}>[{COMBO_THRESHOLDS.POWER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>SUPER POWER</span>
                   <span className={isTerminal ? 'text-terminal crt-glow' : 'text-[#007acc]'}>[{COMBO_THRESHOLDS.SUPER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>MANY POWER</span>
                   <span className={isTerminal ? 'text-white crt-glow' : 'text-[#007acc]'}>[{COMBO_THRESHOLDS.MANY}]</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ControlGroup: React.FC<{ label: string; children: React.ReactNode; isTerminal?: boolean }> = ({ label, children, isTerminal = true }) => (
  <div>
    <label className={`block text-sm mb-3 ${isTerminal ? 'font-terminal text-terminal crt-glow-subtle tracking-wider' : 'font-mono text-[#d4d4d4] tracking-wider'}`}>
      {isTerminal ? `[${label}]` : `${label}`}
    </label>
    {children}
  </div>
);