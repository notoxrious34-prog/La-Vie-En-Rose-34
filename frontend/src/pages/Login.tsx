import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Input } from '../components/ui/Input';
import { useAuth } from '../store/auth';
import { Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import './LuxuryLogin.css';
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_SRC } from '../brand';
import { GOLDEN_EASE, MOTION_PAGE, MOTION_UI, MOTION_SLOW } from '../motion';

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const code = typeof (err as any)?.code === 'string' ? String((err as any).code) : '';
      const message =
        code === 'auth/invalid-credential'
          ? 'Identifiants invalides.'
          : code === 'auth/user-disabled'
            ? 'Compte désactivé.'
            : code === 'auth/too-many-requests'
              ? 'Trop de tentatives. Réessayez plus tard.'
              : 'Connexion impossible. Vérifiez votre connexion internet.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="luxury-login">
      {/* Animated Background */}
      <div className="login-bg">
        <div className="orb orb-rose-1" />
        <div className="orb orb-rose-2" />
        <div className="orb orb-gold" />
        <div className="grid-pattern" />
      </div>

      {/* Logo Watermark */}
      <div className="watermark-logo">
        <img
          src={BRAND_LOGO_SRC}
          alt=""
          className="watermark-img"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
            img.src = BRAND_LOGO_FALLBACK_SRC;
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: MOTION_PAGE, ease: GOLDEN_EASE }}
        className="login-container"
      >
        {/* Glass Card */}
        <div className="glass-card">
          {/* Shimmer Effect */}
          <div className="shimmer-overlay" />

          {/* Logo Section */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: MOTION_UI, ease: GOLDEN_EASE }}
            className="logo-section"
          >
            <div className="logo-glow">
              <motion.img
                src={BRAND_LOGO_SRC}
                alt="La Vie En Rose 34"
                className="login-logo"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                  img.src = BRAND_LOGO_FALLBACK_SRC;
                }}
                animate={{
                  filter: [
                    'drop-shadow(0 0 30px color-mix(in srgb, var(--accent) 40%, transparent))',
                    'drop-shadow(0 0 50px color-mix(in srgb, var(--accent) 60%, transparent))',
                    'drop-shadow(0 0 30px color-mix(in srgb, var(--accent) 40%, transparent))'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: GOLDEN_EASE }}
              />
            </div>
          </motion.div>

          {/* Brand Text */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
            className="brand-section"
          >
            <h1 className="brand-title">
              <span className="text-gradient">La Vie En Rose</span>
              <span className="brand-number">34</span>
            </h1>
            <p className="brand-subtitle">L'art de vivre</p>
            <div className="divider">
              <span className="divider-line" />
              <span className="divider-icon">✦</span>
              <span className="divider-line" />
            </div>
          </motion.div>

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
            className="form-section"
          >
            <h2 className="form-title">Connexion</h2>

            <form onSubmit={onSubmit} className="contents">
              <div className="input-group">
                <div className="luxury-input-wrapper">
                  <User className="input-icon" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('email') || "Nom d'utilisateur / Email"}
                    type="text"
                    autoComplete="username"
                    className="luxury-input"
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="luxury-input-wrapper">
                  <Lock className="input-icon" />
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('password') || 'Mot de passe'}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="luxury-input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="error-message"
              >
                {error}
              </motion.div>
            )}

              <button
                type="submit"
                className="login-button"
                disabled={loading || !email || !password}
              >
                <span className="button-content">
                  {loading ? (
                    <span className="loading-spinner" />
                  ) : (
                    <ArrowRight className="button-icon" />
                  )}
                  {loading ? 'Connexion...' : 'Se connecter'}
                </span>
                <span className="button-shine" />
              </button>
            </form>

            {/* Decorative Footer */}
            <div className="login-footer">
              <span className="footer-line" />
              <span className="footer-text">Boutique Management System</span>
              <span className="footer-line" />
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Corner Decorations */}
      <div className="corner-decoration corner-tl" />
      <div className="corner-decoration corner-tr" />
      <div className="corner-decoration corner-bl" />
      <div className="corner-decoration corner-br" />
    </div>
  );
}

export default LoginPage;
