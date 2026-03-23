(() => {
  const TITLE = 'La Vie En Rose 34';
  const SUBTITLE = 'Luxury POS Experience';

  const splash = document.getElementById('splash');
  const particles = document.getElementById('particles');
  const titleLine = document.getElementById('titleLine');
  const subtitle = document.getElementById('subtitle');
  const logoImg = document.getElementById('logoImg');
  const logoWrap = document.getElementById('logoWrap');
  const roseCanvas = document.getElementById('roseCanvas');

  const params = new URLSearchParams(window.location.search);
  const logoUrl = params.get('logo') || './brand-mark.png';
  const wordmarkUrl = params.get('wordmark') || '';
  const minDurationMs = Math.max(4000, Math.min(6000, Number(params.get('minDurationMs') || 5200)));
  const soundEnabled = String(params.get('sound') || '1') !== '0';

  const isProbablyFileUrl = (u) => {
    try {
      return typeof u === 'string' && u.startsWith('file:');
    } catch {
      return false;
    }
  };

  const pickFirstWorkingLogo = () => {
    const candidates = [];
    if (logoUrl) candidates.push(logoUrl);
    candidates.push('./brand-mark.png');
    candidates.push('./LVR34_0.png');
    const uniq = [];
    for (const c of candidates) {
      if (!c) continue;
      if (uniq.includes(c)) continue;
      uniq.push(c);
    }
    return uniq;
  };

  const detectLowEnd = () => {
    try {
      const mem = Number(navigator.deviceMemory || 0);
      const cores = Number(navigator.hardwareConcurrency || 0);
      const prefersReduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      if (prefersReduced) return true;
      if (mem && mem <= 4) return true;
      if (cores && cores <= 4) return true;
    } catch {
      // ignore
    }
    return false;
  };

  const lowEnd = detectLowEnd();
  try {
    if (lowEnd) document.body.classList.add('low-end');
  } catch {
    // ignore
  }

  try {
    document.documentElement.style.setProperty('--dur-total', `${minDurationMs}ms`);
  } catch {
    // ignore
  }

  if (subtitle) subtitle.textContent = SUBTITLE;

  if (logoImg) {
    const candidates = pickFirstWorkingLogo();
    let idx = 0;
    const setNext = () => {
      const next = candidates[idx];
      idx += 1;
      if (!next) return;
      try {
        logoImg.src = next;
      } catch {
        // ignore
      }
    };
    logoImg.addEventListener('error', () => {
      if (idx >= candidates.length) return;
      setNext();
    });
    setNext();
  }

  // Wire the wordmark image (LVR34_0.png) — shown below the logo badge.
  const wordmarkImg = document.getElementById('wordmarkImg');
  if (wordmarkImg && wordmarkUrl) {
    wordmarkImg.src = wordmarkUrl;
    wordmarkImg.addEventListener('error', () => {
      try {
        // fallback: try sibling file
        wordmarkImg.src = './LVR34_0.png';
      } catch {
        // ignore
      }
    });
  }

  // Build title letter-by-letter.
  if (titleLine) {
    titleLine.innerHTML = '';
    const chars = Array.from(TITLE);
    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'ch';
      span.textContent = ch === ' ' ? '\u00A0' : ch;
      // start around the time the logo settles
      const delayMs = 1650 + i * 38;
      span.style.setProperty('--d', `${delayMs}ms`);
      titleLine.appendChild(span);
    });
  }

  // Elegant particle field around center.
  const rand = (seed) => {
    const x = Math.sin(seed * 9999.123) * 10000;
    return x - Math.floor(x);
  };

  const makeParticle = (i) => {
    const el = document.createElement('div');
    el.className = 'p' + (i % 3 === 0 ? ' pink' : '');

    const angle = rand(i + 1) * Math.PI * 2;
    const radius = 70 + rand(i + 101) * 160;
    const cx = 50;
    const cy = 48;

    const x = cx + Math.cos(angle) * (radius / 10);
    const y = cy + Math.sin(angle) * (radius / 10);

    const size = 2 + rand(i + 301) * 2;
    const dur = 4200 + rand(i + 601) * 2400;
    const delay = 400 + rand(i + 901) * 2400;

    el.style.left = `${x}%`;
    el.style.top = `${y}%`;
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.animationDuration = `${dur}ms`;
    el.style.animationDelay = `${delay}ms`;

    return el;
  };

  if (particles) {
    const count = lowEnd ? 12 : 22;
    for (let i = 0; i < count; i += 1) {
      particles.appendChild(makeParticle(i));
    }
  }

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const playChime = async () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // ignore
        }
      }

      const now = ctx.currentTime;
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.06, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      master.connect(ctx.destination);

      const mk = (type, freq, t0, dur, detune = 0) => {
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
        return o;
      };

      // Rose-gold chime: warm fundamental + airy overtones.
      mk('sine', 392, now + 0.00, 0.70);
      mk('triangle', 784, now + 0.02, 0.55, -6);
      mk('sine', 1174.66, now + 0.06, 0.42, 4);

      window.setTimeout(() => {
        try {
          ctx.close();
        } catch {
          // ignore
        }
      }, 1600);
    } catch {
      // ignore
    }
  };

  // Canvas particle-formation for the rose mark.
  const startRoseFormation = () => {
    if (!roseCanvas) return () => {};
    const canvas = roseCanvas;
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return () => {};

    let stopped = false;
    let rafId = 0;

    const DPR = clamp(Math.round(window.devicePixelRatio || 1), 1, 2);
    const size = 640;
    canvas.width = size * DPR;
    canvas.height = size * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const img = new Image();
    // Avoid setting crossOrigin for file:// URLs; it can cause unexpected behavior in production.
    if (!isProbablyFileUrl(logoUrl)) {
      try {
        img.crossOrigin = 'anonymous';
      } catch {
        // ignore
      }
    }
    img.src = logoUrl;

    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d', { willReadFrequently: true });
    off.width = size;
    off.height = size;

    const particleCount = lowEnd ? 320 : 780;
    const points = [];
    const parts = [];

    const samplePoints = () => {
      if (!offCtx) return;
      offCtx.clearRect(0, 0, size, size);
      const pad = 72;
      const iw = size - pad * 2;
      const ih = size - pad * 2;
      offCtx.drawImage(img, pad, pad, iw, ih);

      let data;
      try {
        data = offCtx.getImageData(0, 0, size, size).data;
      } catch {
        return;
      }

      const stride = lowEnd ? 5 : 4;
      for (let y = 0; y < size; y += stride) {
        for (let x = 0; x < size; x += stride) {
          const a = data[(y * size + x) * 4 + 3];
          if (a > 48) points.push({ x, y });
        }
      }

      // Downsample to stable count.
      for (let i = points.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand(i + 777) * (i + 1));
        const t = points[i];
        points[i] = points[j];
        points[j] = t;
      }
      points.length = Math.min(points.length, particleCount);

      for (let i = 0; i < points.length; i += 1) {
        const p = points[i];
        const a = rand(i + 10);
        const r = 340 + rand(i + 404) * 300;
        const sx = size / 2 + Math.cos(a * Math.PI * 2) * r;
        const sy = size / 2 + Math.sin(a * Math.PI * 2) * r;
        const z = rand(i + 909) * 1;
        const hue = i % 5 === 0 ? 330 : 32;
        parts.push({
          sx,
          sy,
          x: sx,
          y: sy,
          tx: p.x,
          ty: p.y,
          r: 0.9 + rand(i + 212) * (lowEnd ? 1.6 : 2.2),
          o: 0,
          hue,
          z,
        });
      }
    };

    const t0 = performance.now();
    const phaseDelay = 900; // after black void + ignition
    const phaseDur = lowEnd ? 1650 : 1850;

    const draw = (t) => {
      if (stopped) return;
      const dt = t - t0;
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';

      const local = clamp((dt - phaseDelay) / phaseDur, 0, 1);
      const k = easeInOutCubic(local);
      const glow = 0.18 + 0.65 * k;

      // Soft bloom underlay.
      ctx.save();
      ctx.globalAlpha = 0.75 * glow;
      const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      grd.addColorStop(0, 'rgba(246, 215, 162, 0.22)');
      grd.addColorStop(0.45, 'rgba(255, 111, 166, 0.16)');
      grd.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const tw = 0.8 + 0.2 * Math.sin(t * 0.0012);
      for (let i = 0; i < parts.length; i += 1) {
        const p = parts[i];
        const jitter = (rand(i + Math.floor(t * 0.01)) - 0.5) * (lowEnd ? 0.35 : 0.7);
        const ex = lerp(p.sx, p.tx, k);
        const ey = lerp(p.sy, p.ty, k);
        p.x = ex + jitter;
        p.y = ey + jitter;
        p.o = clamp(k * 1.15, 0, 1);

        const rr = p.r * (0.85 + 0.25 * tw);
        const a = p.o;
        const c1 = p.hue === 330 ? `rgba(255, 111, 166, ${0.85 * a})` : `rgba(246, 215, 162, ${0.9 * a})`;
        const c2 = p.hue === 330 ? `rgba(255, 111, 166, ${0.0})` : `rgba(246, 215, 162, ${0.0})`;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr * 5);
        g.addColorStop(0, c1);
        g.addColorStop(1, c2);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr * 4.2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      rafId = window.requestAnimationFrame(draw);
    };

    const onLoaded = () => {
      try {
        samplePoints();
        rafId = window.requestAnimationFrame(draw);
        window.setTimeout(() => {
          void playChime();
        }, Math.max(0, phaseDelay + 520));
      } catch {
        // ignore
      }
    };

    img.addEventListener('load', onLoaded, { once: true });
    img.addEventListener(
      'error',
      () => {
        // If the provided logo URL fails in production, try the built-in fallback.
        try {
          if (logoUrl !== './brand-mark.png') {
            img.src = './brand-mark.png';
          }
        } catch {
          // ignore
        }
      },
      { once: true }
    );

    return () => {
      stopped = true;
      try {
        window.cancelAnimationFrame(rafId);
      } catch {
        // ignore
      }
    };
  };

  const stopRose = startRoseFormation();

  // Ultra subtle parallax + slow rotation.
  let raf = 0;
  let mx = 0;
  let my = 0;
  let tx = 0;
  let ty = 0;

  const onMove = (e) => {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const px = e.clientX / w - 0.5;
    const py = e.clientY / h - 0.5;
    mx = px;
    my = py;
  };

  const tick = () => {
    tx += (mx - tx) * 0.05;
    ty += (my - ty) * 0.05;

    if (logoWrap) {
      const rx = (-ty * 2.2).toFixed(3);
      const ry = (tx * 3.4).toFixed(3);
      logoWrap.style.transform = `translate3d(0,0,0) rotateX(${rx}deg) rotateY(${ry}deg) scale3d(1.01,1.01,1)`;
    }

    raf = window.requestAnimationFrame(tick);
  };

  window.addEventListener('mousemove', onMove, { passive: true });
  raf = window.requestAnimationFrame(tick);

  const finalize = () => {
    try {
      window.removeEventListener('mousemove', onMove);
      window.cancelAnimationFrame(raf);
      stopRose?.();
    } catch {
      // ignore
    }
  };

  // Close handshake: main process may request earlier close, but we enforce minimum cinematic time.
  // We measure from when the document became interactive — not from JS parse time —
  // so the cinematic duration is always fully honoured even on fast machines.
  const start = Date.now();
  const sendReady = () => {
    try {
      // This will only exist inside Electron.
      if (window.electronAPI?.splash?.ready) {
        window.electronAPI.splash.ready();
      }
    } catch {
      // ignore
    }
  };

  let exited = false;
  let unsubscribeCloseRequested = null;
  const exit = () => {
    if (!splash || exited) return;
    exited = true;
    splash.classList.add('exit');
    window.setTimeout(() => {
      finalize();
      sendReady();
    }, 540);
  };

  const minTimer = window.setTimeout(() => {
    exit();
  }, minDurationMs);

  // If main process asks to close now, wait until min duration is satisfied.
  try {
    if (window.electronAPI?.splash?.onCloseRequested) {
      unsubscribeCloseRequested = window.electronAPI.splash.onCloseRequested(() => {
        const elapsed = Date.now() - start;
        const remain = Math.max(0, minDurationMs - elapsed);
        window.clearTimeout(minTimer);
        window.setTimeout(exit, remain);
      });
    }
  } catch {
    // ignore
  }

  window.addEventListener(
    'beforeunload',
    () => {
      try {
        if (typeof unsubscribeCloseRequested === 'function') unsubscribeCloseRequested();
      } catch {
        // ignore
      }
    },
    { once: true }
  );
})();
