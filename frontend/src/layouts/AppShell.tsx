import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Users,
  Truck,
  Wrench,
  LogOut,
  Languages,
  ReceiptText,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import './AppShell.css';
import { TitleBar } from '../components/TitleBar';
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_SRC } from '../brand';

const GOLDEN_EASE = [0.4, 0, 0.2, 1] as [number, number, number, number];
const MOTION_FAST = 0.18;
const MOTION_BASE = 0.25;

const nav = [
  { to: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { to: '/pos', key: 'pos', icon: ShoppingBag },
  { to: '/sales', key: 'sales', icon: ReceiptText },
  { to: '/inventory', key: 'inventory', icon: Boxes },
  { to: '/customers', key: 'customers', icon: Users },
  { to: '/suppliers', key: 'suppliers', icon: Truck },
  { to: '/repairs', key: 'repairs', icon: Wrench },
  { to: '/settings', key: 'settings', icon: Settings },
] as const;

const navItemVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: i * 0.05, duration: MOTION_BASE, ease: GOLDEN_EASE }
  })
};

function Sidebar({ collapsed, setCollapsed, isArabic }: { collapsed: boolean; setCollapsed: (v: boolean) => void; isArabic: boolean }) {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const brand = useMemo(() => t('appName'), [t]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cleanup: undefined | (() => void);

    // Prefer Electron fullscreen state if available.
    if (window.electronAPI?.window?.isFullscreen) {
      void window.electronAPI.window.isFullscreen().then((v) => setIsFullscreen(Boolean(v)));
      if (window.electronAPI?.window?.onFullscreenChanged) {
        cleanup = window.electronAPI.window.onFullscreenChanged((payload) => {
          setIsFullscreen(payload);
        });
      }
      return () => cleanup?.();
    }

    // Fallback: browser fullscreen state.
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    onChange();
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (window.electronAPI?.window?.toggleFullscreen) {
        window.electronAPI.window.toggleFullscreen();
        return;
      }

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore (e.g. denied by browser policy)
    }
  };

  return (
    <aside className={clsx(
      'sidebar relative z-40 h-full shrink-0 transition-all duration-[var(--duration-slow)] ease-[var(--ease-smooth)]',
      collapsed && 'sidebar-collapsed'
    )}>
      <div className={clsx(
        'sidebar-surface flex h-full flex-col overflow-hidden backdrop-blur-2xl'
      )}>
        <div className={clsx(
          'sidebar-header',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: MOTION_BASE, ease: GOLDEN_EASE }}
                className="flex items-center gap-3"
              >
                <div className="luxury-logo-small">
                  <img
                    src={BRAND_LOGO_SRC}
                    alt=""
                    className="sidebar-logo-img"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                      img.src = BRAND_LOGO_FALLBACK_SRC;
                    }}
                  />
                </div>
                <div>
                  <div className="brand-name-sidebar">{brand}</div>
                  <div className="user-name-sidebar">{user?.username ?? ''}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="luxury-logo-small">
              <img
                src={BRAND_LOGO_SRC}
                alt=""
                className="sidebar-logo-img"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                  img.src = BRAND_LOGO_FALLBACK_SRC;
                }}
              />
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto">
          <motion.div className="nav-container" layout>
            {nav.map((n, i) => (
              <motion.div
                key={n.to}
                custom={i}
                variants={navItemVariants}
                initial="hidden"
                animate="visible"
              >
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    clsx(
                      'nav-item group focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                      isActive && 'active'
                    )
                  }
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: MOTION_BASE, ease: GOLDEN_EASE }}
                    className="nav-icon"
                  >
                    <n.icon className="h-4 w-4" />
                  </motion.div>
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: MOTION_FAST, ease: GOLDEN_EASE }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {t(n.key)}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </motion.div>
            ))}
          </motion.div>
        </nav>

        <div className="sidebar-footer">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={clsx(
              'sidebar-action focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
              collapsed && 'justify-center'
            )}
            onClick={() => setCollapsed(!collapsed)}
          >
            <motion.div
              animate={{ rotate: collapsed ? 180 : 0 }}
              transition={{ duration: MOTION_BASE, ease: GOLDEN_EASE }}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </motion.div>
            {!collapsed && <span className="text-xs">Collapse</span>}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={clsx(
              'sidebar-action focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
              collapsed && 'justify-center'
            )}
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {!collapsed && <span className="text-xs">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>}
          </motion.button>

          <div className={clsx('mt-2 grid gap-2', collapsed ? 'grid-cols-1' : 'grid-cols-2')}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                'sidebar-action focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                collapsed && 'justify-center'
              )}
              onClick={() => i18n.changeLanguage(isArabic ? 'fr' : 'ar')}
            >
              <Languages className="h-4 w-4" />
              {!collapsed && <span className="text-xs">{isArabic ? 'العربية' : 'Français'}</span>}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={clsx(
                'sidebar-action focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]',
                collapsed && 'justify-center'
              )}
              onClick={() => {
                logout();
                navigate('/login');
              }}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="text-xs">{t('logout')}</span>}
            </motion.button>
          </div>
        </div>
      </div>
    </aside>
  );
}

export function AppShell() {
  const { i18n } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const isArabic = i18n.language === 'ar';

  return (
    <div
      className={clsx(
        'app-shell-root h-screen w-screen overflow-hidden',
        isArabic ? 'rtl flex flex-row-reverse' : 'flex',
      )}
    >
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} isArabic={isArabic} />
      <main className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <div className="app-shell-content lux-brand-surface min-h-0 flex-1 overflow-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
