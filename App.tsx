import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Zap, Flame, Crown, RefreshCcw } from 'lucide-react';
import { getCaretCoordinates } from './utils/caret';
import { PowerConfig, Particle, PowerLevel } from './types';

// Default Configurations
const DEFAULT_CONFIG: PowerConfig = {
  gravity: 0.25,
  particleCount: 8,
  baseRadius: 3,
  velocity: 4,
  life: 50,
  shakeIntensity: 5,
  spawnHeightOffset: 5,
};

// Colors for different levels
const LEVEL_COLORS = {
  [PowerLevel.None]: ['#94a3b8', '#cbd5e1'], // Grayish
  [PowerLevel.Power]: ['#22d3ee', '#0ea5e9', '#38bdf8', '#bae6fd'], // Cyan/Blue
  [PowerLevel.SuperPower]: ['#fbbf24', '#f59e0b', '#fcd34d', '#ffffff'], // Amber/Gold
  [PowerLevel.ManyPower]: ['#ef4444', '#f472b6', '#fb7185', '#e11d48'], // Red/Rose/Pink
};

const COMBO_THRESHOLDS = {
  POWER: 10,
  SUPER: 30,
  MANY: 60,
};

// Helper for random range
const random = (min: number, max: number) => Math.random() * (max - min) + min;

export default function App() {
  const [text, setText] = useState<string>('Type here to unleash power...');
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [config, setConfig] = useState<PowerConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);
  const [shakeClass, setShakeClass] = useState('');
  
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
    comboTimeoutRef.current = setTimeout(() => {
      setCombo(0);
    }, 1500 + (combo * 10)); // Higher combo gives slightly longer grace period

    // Logic for particles and effects
    const level = getPowerLevel(combo + 1); // +1 because state hasn't updated yet for render, but we know it's hit
    
    // Calculate spawn position
    const coords = getCaretCoordinates(target);
    const spawnX = coords.left;
    const spawnY = coords.top + config.spawnHeightOffset;

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
      case PowerLevel.ManyPower: return 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)]';
      case PowerLevel.SuperPower: return 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]';
      case PowerLevel.Power: return 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-900 overflow-hidden flex flex-col">
      {/* Particle Canvas Overlay */}
      <canvas 
        ref={canvasRef} 
        className="fixed top-0 left-0 pointer-events-none z-50 w-full h-full"
      />

      {/* Header */}
      <header className="relative z-10 p-6 flex justify-between items-center border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-slate-800 border border-slate-700 ${currentLevel >= PowerLevel.ManyPower ? 'animate-pulse border-rose-500' : ''}`}>
             {currentLevel >= PowerLevel.ManyPower ? <Flame className="w-6 h-6 text-rose-500" /> : <Zap className="w-6 h-6 text-cyan-400" />}
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-white">Power Mode Typer</h1>
            <p className="text-xs text-slate-400">Type fast to increase your power level</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">Max Streak</div>
            <div className="font-mono text-xl text-slate-200">{maxCombo}</div>
          </div>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative ${shakeClass}`}>
        
        {/* Combo HUD */}
        <div className={`
          absolute top-8 left-1/2 -translate-x-1/2 z-40
          transition-all duration-300 ease-out transform
          ${combo > 0 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-90'}
        `}>
          <div className="flex flex-col items-center">
            <div className="relative">
              <span className={`font-black italic text-6xl sm:text-8xl font-mono ${getLevelColorClass()}`}>
                {combo}x
              </span>
              {currentLevel >= PowerLevel.ManyPower && (
                <Crown className="absolute -top-6 -right-6 w-8 h-8 text-yellow-400 animate-bounce" fill="currentColor" />
              )}
            </div>
            {currentLevel > PowerLevel.None && (
              <div className={`mt-2 font-black tracking-[0.2em] text-sm sm:text-lg animate-pulse ${getLevelColorClass()}`}>
                {getLevelLabel()}
                {currentLevel === PowerLevel.ManyPower && <span className="block text-[10px] opacity-70 font-normal tracking-normal text-center mt-1">(USE WITH CAUTION)</span>}
              </div>
            )}
            
            {/* Combo Timer Bar */}
            <div className="w-full h-1 bg-slate-800 mt-2 rounded-full overflow-hidden">
               <div 
                 key={combo} // Reset animation on combo change
                 className={`h-full ${currentLevel === PowerLevel.ManyPower ? 'bg-rose-500' : 'bg-cyan-400'}`}
                 style={{
                   width: '100%',
                   animation: `drain 1.5s linear forwards`
                 }} 
               />
               <style>{`
                 @keyframes drain { from { width: 100%; } to { width: 0%; } }
               `}</style>
            </div>
          </div>
        </div>

        {/* Text Editor */}
        <div className="w-full max-w-4xl h-[60vh] relative z-20">
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-800/20 to-cyan-900/20 rounded-xl blur-xl transform scale-105 opacity-50" />
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleInput}
            spellCheck={false}
            className="w-full h-full bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 
                       text-lg sm:text-xl font-mono text-slate-100 placeholder-slate-500
                       focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50
                       resize-none shadow-2xl transition-all leading-relaxed"
            placeholder="// Start typing here to charge your power..."
          />
          
          <div className="absolute bottom-4 right-4 text-xs text-slate-500 font-mono pointer-events-none">
            {text.length} chars
          </div>
        </div>
      </main>

      {/* Configuration Sidebar */}
      <div className={`fixed inset-y-0 right-0 w-80 bg-slate-900/95 backdrop-blur shadow-2xl border-l border-slate-800 transform transition-transform duration-300 z-50 ${showConfig ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Settings className="w-5 h-5" /> Config
            </h2>
            <button onClick={() => setConfig(DEFAULT_CONFIG)} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          <div className="space-y-6">
            <ControlGroup label="Particles per keystroke">
              <input 
                type="range" min="1" max="20" step="1" 
                value={config.particleCount} 
                onChange={(e) => setConfig({...config, particleCount: Number(e.target.value)})}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>1</span>
                <span>{config.particleCount}</span>
                <span>20</span>
              </div>
            </ControlGroup>

            <ControlGroup label="Gravity">
              <input 
                type="range" min="0" max="1" step="0.05" 
                value={config.gravity} 
                onChange={(e) => setConfig({...config, gravity: Number(e.target.value)})}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Zero G</span>
                <span>{config.gravity}</span>
                <span>Heavy</span>
              </div>
            </ControlGroup>

            <ControlGroup label="Velocity">
              <input 
                type="range" min="1" max="15" step="1" 
                value={config.velocity} 
                onChange={(e) => setConfig({...config, velocity: Number(e.target.value)})}
                className="w-full accent-cyan-500"
              />
               <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>Slow</span>
                <span>{config.velocity}</span>
                <span>Fast</span>
              </div>
            </ControlGroup>

            <ControlGroup label="Particle Size">
              <input 
                type="range" min="1" max="10" step="0.5" 
                value={config.baseRadius} 
                onChange={(e) => setConfig({...config, baseRadius: Number(e.target.value)})}
                className="w-full accent-cyan-500"
              />
            </ControlGroup>

            <div className="pt-6 border-t border-slate-800">
               <h3 className="text-sm font-bold text-slate-300 mb-2">Thresolds</h3>
               <div className="text-xs text-slate-400 space-y-2">
                 <div className="flex justify-between">
                   <span>Power Level</span>
                   <span className="text-cyan-400">{COMBO_THRESHOLDS.POWER} hits</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Super Power</span>
                   <span className="text-amber-400">{COMBO_THRESHOLDS.SUPER} hits</span>
                 </div>
                 <div className="flex justify-between">
                   <span>Many Power</span>
                   <span className="text-rose-500">{COMBO_THRESHOLDS.MANY} hits</span>
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
    <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
    {children}
  </div>
);