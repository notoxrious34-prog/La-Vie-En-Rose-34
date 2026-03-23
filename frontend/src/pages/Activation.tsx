import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Key, CheckCircle2, XCircle, ShieldAlert } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

export function ActivationPage() {
  const navigate = useNavigate();
  const [licenseKey, setLicenseKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isDesktop = Boolean(window.electronAPI?.license);

  const normalizedKey = useMemo(() => licenseKey.trim().toUpperCase(), [licenseKey]);

  const activate = async () => {
    setMessage(null);
    if (!normalizedKey) return;
    if (!window.electronAPI?.license) {
      setMessage({ type: 'error', text: 'Activation disponible uniquement sur la version desktop.' });
      return;
    }

    setBusy(true);
    try {
      const res = await window.electronAPI.license.activate(normalizedKey, null);
      if (res.success) {
        setMessage({ type: 'success', text: 'Activation réussie. Redirection en cours...' });
        window.setTimeout(() => navigate('/', { replace: true }), 2000);
      } else {
        const code = res.error || 'activation_failed';
        setMessage({ type: 'error', text: `Erreur d'activation: ${code}` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau ou Firebase. Vérifiez votre connexion internet.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)]">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Card className="overflow-hidden p-0 lux-page-hero">
            <div className="p-8 bg-[color:var(--accent)] text-[color:var(--on-accent)]" style={{ background: 'var(--gradient-primary)' }}>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--surface-1)_15%,transparent)]">
                  <Key className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-[color:color-mix(in_srgb,var(--on-accent)_80%,transparent)]">La Vie En Rose 34</div>
                  <h1 className="text-2xl font-bold">POS Activation</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-[color:color-mix(in_srgb,var(--on-accent)_80%,transparent)]">
                Entrez votre clé de licence pour activer le logiciel sur cet appareil.
              </p>
            </div>

            <div className="p-8">
            {!isDesktop && (
              <div className="mb-6 rounded-2xl border border-[color:color-mix(in_srgb,var(--color-secondary-500)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] p-4 text-[color:var(--color-secondary-700)]">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5" />
                  <div>
                    <div className="font-semibold">Mode navigateur</div>
                    <div className="text-sm opacity-90">Cette page nécessite l'application desktop.</div>
                  </div>
                </div>
              </div>
            )}

            {message && (
              <div
                className={
                  `mb-6 rounded-2xl p-4 ` +
                  (message.type === 'success'
                    ? 'border border-[color:color-mix(in_srgb,var(--success)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success)]'
                    : 'border border-[color:color-mix(in_srgb,var(--danger)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] text-[color:var(--danger)]')
                }
              >
                <div className="flex items-start gap-3">
                  {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <XCircle className="mt-0.5 h-5 w-5" />}
                  <div className="text-sm font-medium">{message.text}</div>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              <Input
                label="License Key"
                placeholder="LVR34-XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                className="font-mono"
                autoFocus
              />

              <div className="flex items-center gap-3">
                <Button onClick={activate} disabled={busy || !normalizedKey} className="w-fit">
                  {busy ? 'Activation...' : 'Activate'}
                </Button>
                <div className="text-xs text-[color:var(--fg-subtle)]">
                  Offline grace: 7 jours (après la dernière validation en ligne)
                </div>
              </div>

              <Card className="mt-4 p-4 text-xs text-[color:var(--fg-muted)]">
                <div className="font-semibold text-[color:var(--fg)]">Conseil</div>
                <div className="mt-1">
                  Assurez-vous que votre licence existe dans Firestore: <code>licenses/{'{'}LICENSE_KEY{'}'}</code> avec
                  <code> status: "active"</code>.
                </div>
              </Card>
            </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
