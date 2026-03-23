import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { pushToast } from '../lib/toast';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
};

export function SuppliersPage() {
  const me = useAuth((s) => s.user);
  const canCreate = me?.role === 'admin';
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const list = useQuery({
    queryKey: ['suppliers', qDebounced],
    queryFn: async () => {
      const res = await api.get('/api/suppliers', { params: { q: qDebounced, limit: 50 } });
      return res.data.items as Supplier[];
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      <Card className="p-5 lux-page-hero">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold text-[color:var(--accent-strong)]">Fournisseurs</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--fg)]">Répertoire</div>
            <div className="mt-1 text-sm text-[color:var(--fg-muted)]">Contacts, suivi et création en quelques secondes.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="rose">Boutique</Badge>
            <Badge variant="gold">{(list.data ?? []).length}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche fournisseur" />
          <div className="mt-4 space-y-2">
            {list.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-2/3" radius="xl" />
                    <Skeleton className="h-3 w-1/3" radius="xl" />
                  </div>
                </div>
              ))
            ) : (list.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--fg-muted)]">
                {q ? 'Aucun fournisseur trouvé' : 'Aucun fournisseur enregistré'}
              </div>
            ) : null}
            {!list.isLoading && (list.data ?? []).map((s) => (
              <motion.div
                key={s.id}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }}
                className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))] p-4 shadow-glass ring-1 ring-[color:color-mix(in_srgb,var(--accent)_16%,transparent)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[color:var(--fg)]">{s.name}</div>
                    <div className="mt-1 text-xs text-[color:var(--fg-muted)]">{s.phone ?? ''}</div>
                  </div>
                  <Badge variant="gold">Pro</Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-extrabold text-[color:var(--fg)]">Ajouter</div>
          {!canCreate ? (
            <div className="mt-3 text-sm text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
          ) : (
            <div className="mt-3 space-y-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              <Button
                className="w-full"
                disabled={busy || !name.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api.post('/api/suppliers', { name, phone });
                    setName('');
                    setPhone('');
                    queryClient.invalidateQueries({ queryKey: ['suppliers'] });
                    pushToast({ kind: 'success', title: 'Fournisseur ajouté', message: name });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Enregistrer
              </Button>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
