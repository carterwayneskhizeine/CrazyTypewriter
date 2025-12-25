import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Zap, Flame, Crown, RefreshCcw, X, Eye, Edit } from 'lucide-react';
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
const LEVEL_COLORS = {
  [PowerLevel.None]: ['#006600', '#008800'], // Dim Green
  [PowerLevel.Power]: ['#00cc00', '#00dd00', '#00ff00', '#33ff33'], // Green shades
  [PowerLevel.SuperPower]: ['#00ff00', '#33ff33', '#66ff66', '#aaffaa'], // Bright Green/White-ish
  [PowerLevel.ManyPower]: ['#00ff00', '#33ff33', '#aaffaa', '#ffffff'], // Intense Green/White
};

const COMBO_THRESHOLDS = {
  POWER: 10,
  SUPER: 30,
  MANY: 60,
};

// Helper for random range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

type ViewMode = 'edit' | 'preview';

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

    const colors = LEVEL_COLORS[level];

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
  }, [config, currentLevel]);

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
    switch (currentLevel) {
      case PowerLevel.ManyPower: return 'crt-glow text-white';
      case PowerLevel.SuperPower: return 'crt-glow text-[#aaffaa]';
      case PowerLevel.Power: return 'crt-glow-subtle text-terminal';
      default: return 'text-[#006600]';
    }
  };

  return (
    <div className="relative min-h-screen bg-terminal overflow-hidden flex flex-col crt-scanlines">
      <div className="crt-curvature crt-flicker" />
      {/* Particle Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="fixed top-0 left-0 pointer-events-none z-50 w-full h-full"
      />

      {/* Header - Hidden on mobile */}
      <header className="relative z-10 hidden sm:flex p-2 justify-between items-center border-b-2 border-terminal bg-terminal-black">
        <div className="flex items-center gap-2">
          <div className={`p-1 border-2 ${currentLevel >= PowerLevel.ManyPower ? 'border-white animate-pulse' : 'border-terminal'}`}>
             {currentLevel >= PowerLevel.ManyPower ? <Flame className="w-4 h-4 text-white crt-glow" /> : <Zap className="w-4 h-4 text-terminal crt-glow" />}
          </div>
          <div>
            <h1 className="font-terminal text-lg tracking-tight text-terminal crt-glow">POWER MODE TYPER v1.0</h1>
            <p className="text-terminal-dim text-xs font-terminal">&gt; TYPE FAST TO INCREASE POWER</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right font-terminal">
            <div className="text-terminal-dim text-xs uppercase tracking-wider">MAX STREAK</div>
            <div className="text-base text-terminal crt-glow">{maxCombo}</div>
          </div>
          <button
            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
            className="terminal-btn p-1"
            title={viewMode === 'edit' ? 'Preview' : 'Edit'}
          >
            {viewMode === 'edit' ? <Eye className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="terminal-btn p-1"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col items-center justify-start p-2 sm:px-[15px] sm:py-[15px] relative ${shakeClass}`}>

        {/* Text Editor Wrapper */}
        <div className="w-full h-[85vh] sm:max-w-[calc(100vw-160px)] sm:h-[calc(100vh-120px)] relative z-20">
          <div className="absolute inset-0 bg-terminal/10 blur-xl transform scale-105 opacity-50" />

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
                      <span className="text-xs text-terminal-dim font-terminal">&lt;USE WITH CAUTION&gt;</span>
                   )}
                </div>
              )}

              {/* Mini Progress Bar */}
              <div className="w-32 h-2 border border-terminal-dim mt-2 overflow-hidden">
                 <div className={`w-full flex ${hudSide === 'right' ? 'justify-end' : 'justify-start'}`}>
                   <div
                     key={combo}
                     className="h-full bg-terminal"
                     style={{
                       width: '100%',
                       animation: `drain 1.5s linear forwards`
                     }}
                   />
                 </div>
              </div>
            </div>
          </div>

          {/* ASCII Box Border */}
          <div className="relative w-full h-full ascii-box bg-terminal-black">
            {/* Corner ASCII */}
            <div className="absolute -top-3 -left-3 text-terminal text-2xl font-terminal">+</div>
            <div className="absolute -top-3 -right-3 text-terminal text-2xl font-terminal">+</div>
            <div className="absolute -bottom-3 -left-3 text-terminal text-2xl font-terminal">+</div>
            <div className="absolute -bottom-3 -right-3 text-terminal text-2xl font-terminal">+</div>

            <textarea
              ref={inputRef}
              value={text}
              onChange={handleInput}
              spellCheck={false}
              className="block-cursor terminal-scrollbar w-full h-full bg-transparent border-0 p-8
                         text-lg sm:text-sm font-terminal text-terminal
                         focus:outline-none resize-none leading-relaxed
                         selection:bg-terminal selection:text-black"
              placeholder="// START TYPING TO CHARGE YOUR POWER..."
              style={{ display: viewMode === 'edit' ? 'block' : 'none' }}
            />
            <div
              className="terminal-scrollbar w-full h-full bg-transparent border-0 p-8
                         text-lg sm:text-sm font-terminal text-terminal
                         leading-relaxed markdown-preview"
              style={{ display: viewMode === 'preview' ? 'block' : 'none' }}
            >
              <ReactMarkdown>{text}</ReactMarkdown>
            </div>

            <div className="absolute bottom-4 right-4 text-sm text-terminal-dim font-terminal pointer-events-none">
              [{text.length} CHARS]
            </div>
          </div>
        </div>
      </main>

      {/* Configuration Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-terminal border-l-2 border-terminal shadow-lg transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-8 border-b border-terminal-dim pb-4">
            <h2 className="font-terminal text-xl text-terminal flex items-center gap-2 crt-glow">
              [ CONFIG ]
            </h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setConfig(DEFAULT_CONFIG)} className="terminal-btn px-2 py-1 text-sm font-terminal">
                <RefreshCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowConfig(false)}
                className="terminal-btn p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <ControlGroup label="PARTICLES PER KEY">
              <input
                type="range" min="1" max="20" step="1"
                value={config.particleCount}
                onChange={(e) => setConfig({...config, particleCount: Number(e.target.value)})}
                className="w-full terminal-range"
              />
              <div className="flex justify-between text-terminal-dim text-sm font-terminal mt-1">
                <span>[1]</span>
                <span className="text-terminal crt-glow">[{config.particleCount}]</span>
                <span>[20]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="GRAVITY">
              <input
                type="range" min="0" max="2" step="0.05"
                value={config.gravity}
                onChange={(e) => setConfig({...config, gravity: Number(e.target.value)})}
                className="w-full terminal-range"
              />
              <div className="flex justify-between text-terminal-dim text-sm font-terminal mt-1">
                <span>[ZERO]</span>
                <span className="text-terminal crt-glow">[{config.gravity.toFixed(2)}]</span>
                <span>[HEAVY]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="VELOCITY">
              <input
                type="range" min="1" max="15" step="1"
                value={config.velocity}
                onChange={(e) => setConfig({...config, velocity: Number(e.target.value)})}
                className="w-full terminal-range"
              />
               <div className="flex justify-between text-terminal-dim text-sm font-terminal mt-1">
                <span>[SLOW]</span>
                <span className="text-terminal crt-glow">[{config.velocity}]</span>
                <span>[FAST]</span>
              </div>
            </ControlGroup>

            <ControlGroup label="PARTICLE SIZE">
              <input
                type="range" min="1" max="10" step="0.5"
                value={config.baseRadius}
                onChange={(e) => setConfig({...config, baseRadius: Number(e.target.value)})}
                className="w-full terminal-range"
              />
              <div className="flex justify-between text-terminal-dim text-sm font-terminal mt-1">
                <span>[SMALL]</span>
                <span className="text-terminal crt-glow">[{config.baseRadius}]</span>
                <span>[LARGE]</span>
              </div>
            </ControlGroup>

            <div className="pt-6 border-t-2 border-terminal-dim">
               <h3 className="font-terminal text-sm text-terminal mb-2">&gt; THRESHOLDS:</h3>
               <div className="text-sm text-terminal-dim font-terminal space-y-2">
                 <div className="flex justify-between">
                   <span>POWER LEVEL</span>
                   <span className="text-terminal">[{COMBO_THRESHOLDS.POWER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>SUPER POWER</span>
                   <span className="text-terminal crt-glow">[{COMBO_THRESHOLDS.SUPER}]</span>
                 </div>
                 <div className="flex justify-between">
                   <span>MANY POWER</span>
                   <span className="text-white crt-glow">[{COMBO_THRESHOLDS.MANY}]</span>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ControlGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-terminal text-terminal crt-glow-subtle mb-3 tracking-wider">[{label}]</label>
    {children}
  </div>
);