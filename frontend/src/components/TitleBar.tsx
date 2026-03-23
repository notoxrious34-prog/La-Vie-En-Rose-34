import clsx from 'clsx';
import { Minus, X, Square, Maximize2, Minimize2 } from 'lucide-react';
import { motion } from 'framer-motion';
import './TitleBar.css';
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_SRC } from '../brand';
import { useEffect, useState } from 'react';

export function TitleBar({ className }: { className?: string }) {
  const isElectron = Boolean((window as any).electronAPI?.window);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const api = ((window as any).electronAPI?.window ?? null) as null | {
    minimize?: () => void;
    toggleMaximize?: () => void;
    close?: () => void;
    toggleFullscreen?: () => void;
    isFullscreen?: () => Promise<boolean>;
    onFullscreenChanged?: (callback: (payload: { isFullscreen: boolean }) => void) => () => void;
  };

  useEffect(() => {
    let cleanup: undefined | (() => void);

    if (!api) return;

    if (api.isFullscreen) {
      void api.isFullscreen().then((v) => setIsFullscreen(Boolean(v)));
      if (api.onFullscreenChanged) {
        cleanup = api.onFullscreenChanged((payload) => {
          setIsFullscreen(Boolean(payload?.isFullscreen));
        });
      }
      return () => cleanup?.();
    }

    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onChange();
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [api]);

  const toggleFullscreen = async () => {
    try {
      if (api?.toggleFullscreen) {
        api?.toggleFullscreen();
        return;
      }
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
  };

  if (!isElectron || !api) return null;

  return (
    <div className={clsx('lux-titlebar', className)}>
      <div className="lux-titlebar__drag" />
      <div className="lux-titlebar__brand">
        <div className="lux-titlebar__logo">
          <img
            src={BRAND_LOGO_SRC}
            alt=""
            onError={(e) => {
              const img = e.currentTarget;
              if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
              img.src = BRAND_LOGO_FALLBACK_SRC;
            }}
          />
        </div>
        <div className="lux-titlebar__title">La Vie En Rose 34</div>
      </div>

      <div className="lux-titlebar__controls">
        <motion.button
          type="button"
          className="lux-titlebar__btn lux-titlebar__btn--feature"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => void toggleFullscreen()}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </motion.button>
        <motion.button
          type="button"
          className="lux-titlebar__btn"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => api.minimize?.()}
        >
          <Minus className="h-4 w-4" />
        </motion.button>
        <motion.button
          type="button"
          className="lux-titlebar__btn"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => api.toggleMaximize?.()}
        >
          <Square className="h-4 w-4" />
        </motion.button>
        <motion.button
          type="button"
          className="lux-titlebar__btn lux-titlebar__btn--danger"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => api.close?.()}
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
}
