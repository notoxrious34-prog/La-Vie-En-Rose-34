import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './SplashScreen.css';
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_SRC, BRAND_WORDMARK_SRC } from '../brand';

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ 
  onComplete, 
  duration = 3500 
}) => {
  const [phase, setPhase] = useState<'playing' | 'exiting'>('playing');

  const lowEnd = useMemo(() => {
    try {
      const mem = Number((navigator as any)?.deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      const prefersReduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      if (prefersReduced) return true;
      if (mem && mem <= 4) return true;
      if (cores && cores <= 4) return true;
    } catch {
      // ignore
    }
    return false;
  }, []);

  const particles = useMemo(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed * 9999.123) * 10000;
      return x - Math.floor(x);
    };

    const count = lowEnd ? 10 : 18;
    return Array.from({ length: count }, (_, i) => {
      const angle = rand(i + 1) * Math.PI * 2;
      const radius = 12 + rand(i + 101) * 28;
      const left = 50 + Math.cos(angle) * radius;
      const top = 48 + Math.sin(angle) * radius;
      const duration = 7 + rand(i + 1001) * 8;
      const delay = rand(i + 2001) * 2.4;
      const size = 1.5 + rand(i + 3001) * 2.5;
      const hue = rand(i + 4001) > 0.55 ? 'gold' : 'rose';
      return { left, top, duration, delay, size, hue };
    });
  }, [lowEnd]);

  const sparkles = useMemo(() => {
    const rand = (seed: number) => {
      const x = Math.sin(seed * 7777.731) * 10000;
      return x - Math.floor(x);
    };

    return Array.from({ length: 12 }, (_, i) => {
      const top = 10 + rand(i + 301) * 40;
      const left = 10 + rand(i + 701) * 40;
      const delay = i * 0.2;
      return { top, left, delay };
    });
  }, []);

  useEffect(() => {
    const total = Math.max(2500, Math.min(6000, duration));
    const exitAt = total;
    const exitMs = 520;

    const t1 = window.setTimeout(() => setPhase('exiting'), exitAt);
    const t2 = window.setTimeout(() => onComplete(), exitAt + exitMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [duration, onComplete]);

  useEffect(() => {
    let cancelled = false;

    const playChime = async () => {
      try {
        const prefersReduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
        if (prefersReduced) return;
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch {
            // ignore
          }
        }
        if (cancelled) return;

        const now = ctx.currentTime;
        const master = ctx.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.05, now + 0.02);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
        master.connect(ctx.destination);

        const mk = (type: OscillatorType, freq: number, t0: number, dur: number, detune = 0) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = type;
          o.frequency.setValueAtTime(freq, t0);
          o.detune.setValueAtTime(detune, t0);
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(1.0, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
          o.connect(g);
          g.connect(master);
          o.start(t0);
          o.stop(t0 + dur + 0.02);
        };

        mk('sine', 392, now + 0.0, 0.70);
        mk('triangle', 784, now + 0.02, 0.54, -6);
        mk('sine', 1174.66, now + 0.06, 0.40, 4);

        window.setTimeout(() => {
          try {
            ctx.close();
          } catch {
            // ignore
          }
        }, 1550);
      } catch {
        // ignore
      }
    };

    const t = window.setTimeout(() => {
      void playChime();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  const title = 'La Vie En Rose 34';

  return (
    <AnimatePresence>
      {phase !== 'exiting' && (
        <motion.div
          className="splash-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12, filter: 'blur(2px)' }}
          transition={{ duration: 0.52, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Ultimate Fantasy Background */}
          <div className="splash-bg">
            {/* Ambient Glow Layers */}
            <div className="ambient-glow" />
            <div className="cinema-noise" />
            <div className="cinema-vignette" />
            <div className="light-emergence" />
            <div className="light-rays" />
            
            {/* Dynamic Gradient Orbs */}
            <motion.div 
              className="gradient-orb orb-1" 
              animate={{ 
                x: [0, 30, -20, 0],
                y: [0, -30, 20, 0],
                scale: [1, 1.1, 0.95, 1]
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="gradient-orb orb-2" 
              animate={{ 
                x: [0, -25, 15, 0],
                y: [0, 25, -15, 0],
                scale: [1, 0.95, 1.05, 1]
              }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut", delay: -5 }}
            />
            <motion.div 
              className="gradient-orb orb-3" 
              animate={{ 
                x: [0, 20, -10, 0],
                y: [0, -15, 25, 0],
                scale: [1, 1.05, 0.9, 1]
              }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: -8 }}
            />
            
            {/* Particle Field */}
            <div className="particles">
              {particles.map((p, i) => (
                <motion.div
                  key={i}
                  className={p.hue === 'gold' ? 'particle particle-gold' : 'particle particle-rose'}
                  style={{
                    insetInlineStart: `${p.left}%`,
                    top: `${p.top}%`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  }}
                  animate={{
                    y: [0, -120, -240],
                    opacity: [0, 0.8, 0],
                    scale: [0.5, 1, 0.3]
                  }}
                  transition={{
                    duration: p.duration,
                    repeat: Infinity,
                    delay: p.delay,
                    ease: "linear"
                  }}
                />
              ))}
            </div>
          </div>

          {/* Ultimate Logo Container */}
          <motion.div 
            className="logo-container"
            initial={{ scale: 0.8, opacity: 0, rotate: -3 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ 
              duration: 1.1, 
              ease: [0.4, 0, 0.2, 1],
              delay: 0.75
            }}
          >
            {/* Outer Pulsing Ring */}
            <motion.div 
              className="glow-ring-outer"
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{ 
                duration: 3, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            />

            {/* Rotating Inner Ring */}
            <motion.div 
              className="glow-ring"
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 25, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            />

            {/* Logo Image with 3D Effect */}
            <motion.div 
              className="logo-wrapper"
              animate={{ 
                y: [0, -5, 0],
                rotate: [0, 1, 0, -1, 0]
              }}
              transition={{ 
                duration: 4, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
            >
              <motion.img
                src={BRAND_LOGO_SRC}
                alt="La Vie En Rose 34"
                className="splash-logo"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                  img.src = BRAND_LOGO_FALLBACK_SRC;
                }}
                animate={{ 
                  filter: [
                    'drop-shadow(0 0 30px color-mix(in srgb, var(--accent) 40%, transparent)) brightness(1)',
                    'drop-shadow(0 0 60px color-mix(in srgb, var(--accent) 70%, transparent)) brightness(1.1)',
                    'drop-shadow(0 0 40px color-mix(in srgb, var(--accent) 52%, transparent)) brightness(1.05)',
                    'drop-shadow(0 0 50px color-mix(in srgb, var(--accent) 62%, transparent)) brightness(1.1)',
                    'drop-shadow(0 0 30px color-mix(in srgb, var(--accent) 40%, transparent)) brightness(1)'
                  ]
                }}
                transition={{ 
                  duration: 3, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  times: [0, 0.25, 0.5, 0.75, 1]
                }}
              />
              <div className="logo-shine" aria-hidden="true" />
              <div className="logo-shine logo-shine-unified" aria-hidden="true" />
            </motion.div>

            {/* Enhanced Sparkle Effects */}
            <div className="sparkles">
              {sparkles.map((s, i) => (
                <motion.div
                  key={i}
                  className="sparkle"
                  style={{
                    top: `${s.top}%`,
                    insetInlineStart: `${s.left}%`,
                  }}
                  animate={{
                    opacity: [0.3, 1, 0.3],
                    scale: [0.8, 1.2, 0.8],
                    rotate: [0, 180, 360]
                  }}
                  transition={{
                    duration: 2.5,
                    delay: s.delay,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Brand Name with Enhanced Animation */}
          <motion.div
            className="brand-text"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 1.45, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            <img
              className="brand-wordmark"
              src={BRAND_WORDMARK_SRC}
              alt={title}
              onError={(e) => {
                const img = e.currentTarget;
                if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                img.src = BRAND_LOGO_FALLBACK_SRC;
              }}
            />
            <motion.p
              className="brand-tagline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.2, duration: 0.6 }}
            >
              Luxury POS Experience
            </motion.p>
          </motion.div>

          <div className="corner-accent corner-accent-bl" />
          <div className="corner-accent corner-accent-br" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
