import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AnimatedModal } from '../components/ui/AnimatedModal';
import { Skeleton } from '../components/ui/Skeleton';
import { motion } from 'framer-motion';
import { pushToast } from '../lib/toast';

type RepairItem = {
  id: string;
  order_number: string;
  kind: 'repair' | 'reservation';
  status: string;
  title: string | null;
  due_at?: number | null;
  price_estimate: number | null;
  customer_id?: string | null;
  notes?: string | null;
};

type CustomerLite = { id: string; full_name: string; phone: string | null; vipTier?: string; loyalty_points: number };

type QrPayload = { url: string; dataUrl: string };

export function RepairsPage() {
  const [kind, setKind] = useState<'repair' | 'reservation'>('repair');
  const [status, setStatus] = useState<string>('');
  const [cq, setCq] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('0');
  const [dueAt, setDueAt] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<QrPayload | null>(null);

  const list = useQuery({
    queryKey: ['repairs', kind, status],
    queryFn: async () => {
      const res = await api.get('/api/repairs', { params: { kind, status: status || undefined, limit: 50 } });
      return res.data.items as RepairItem[];
    },
  });

  const customers = useQuery({
    queryKey: ['customers-repairs', cq],
    queryFn: async () => {
      const res = await api.get('/api/customers', { params: { q: cq, limit: 10 } });
      return res.data.items as CustomerLite[];
    },
    enabled: cq.trim().length > 0,
  });

  const customerItems = useMemo(() => customers.data ?? [], [customers.data]);
  const selectedCustomer = useMemo(
    () => customerItems.find((c) => c.id === customerId) ?? null,
    [customerItems, customerId]
  );

  async function openQr(orderId: string) {
    const res = await api.get(`/api/repairs/${orderId}/qr`);
    setQrData(res.data as QrPayload);
    setQrOpen(true);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="space-y-4"
    >
      <AnimatedModal
        open={Boolean(qrOpen && qrData)}
        onClose={() => setQrOpen(false)}
        title="QR cliente"
        maxWidthClassName="max-w-lg"
      >
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button variant="secondary" onClick={() => setQrOpen(false)}>
            Fermer
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            {qrData ? <img src={qrData.dataUrl} alt="QR" className="mx-auto h-56 w-56" /> : null}
          </div>
          <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-4">
            <div className="text-xs font-semibold text-[color:var(--fg-subtle)]">Public link</div>
            <div className="mt-2 break-all text-sm font-extrabold text-[color:var(--fg)]">{qrData?.url}</div>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => {
                if (!qrData?.url) return;
                await navigator.clipboard.writeText(qrData.url);
              }}
            >
              Copier le lien
            </Button>
          </div>
        </div>
      </AnimatedModal>

      <Card className="p-5 lux-page-hero">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-semibold text-[color:var(--accent-strong)]">Atelier</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--fg)]">Retouches / Réservations</div>
            <div className="mt-1 text-sm text-[color:var(--fg-subtle)]">Suivi élégant, statuts rapides, et QR pour la cliente.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="rose">{kind === 'repair' ? 'Retouche' : 'Réservation'}</Badge>
            <Badge variant="gold">{(list.data ?? []).length}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Button variant={kind === 'repair' ? 'primary' : 'secondary'} onClick={() => setKind('repair')}>
              Retouche
            </Button>
            <Button
              variant={kind === 'reservation' ? 'primary' : 'secondary'}
              onClick={() => setKind('reservation')}
            >
              Réservation
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Button variant={status === '' ? 'primary' : 'secondary'} onClick={() => setStatus('')}>
              Tous
            </Button>
            <Button variant={status === 'pending' ? 'primary' : 'secondary'} onClick={() => setStatus('pending')}>
              En attente
            </Button>
            <Button
              variant={status === 'in_progress' ? 'primary' : 'secondary'}
              onClick={() => setStatus('in_progress')}
            >
              En cours
            </Button>
            <Button variant={status === 'ready' ? 'primary' : 'secondary'} onClick={() => setStatus('ready')}>
              Prête
            </Button>
            <Button
              variant={status === 'delivered' ? 'primary' : 'secondary'}
              onClick={() => setStatus('delivered')}
            >
              Livrée
            </Button>
          </div>

          <div className="mt-4 space-y-2">
            {list.isLoading ? (
              <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 shadow-glass">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-40" radius="xl" />
                    <Skeleton className="h-4 w-20" radius="xl" />
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="lux-row flex-col items-stretch">
                        <div className="flex items-center justify-between gap-3">
                          <Skeleton className="h-4 w-24" radius="xl" />
                          <Skeleton className="h-6 w-16" radius="xl" />
                        </div>
                        <div className="mt-3 space-y-2">
                          <Skeleton className="h-3 w-2/3" radius="xl" />
                          <Skeleton className="h-3 w-1/2" radius="xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (list.data ?? []).length === 0 ? (
              <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 text-center shadow-glass">
                <div className="text-sm font-semibold text-[color:var(--fg)]">Aucun élément</div>
                <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">Créez une nouvelle fiche à droite.</div>
              </div>
            ) : (
              (list.data ?? []).map((o) => (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="lux-row flex-col items-stretch ring-1 ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-[color:var(--fg)]">{o.order_number}</div>
                    <Badge variant={o.status === 'delivered' ? 'gold' : 'rose'}>{o.status}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">{o.title ?? ''}</div>
                  {o.due_at ? (
                    <div className="mt-1 text-[11px] font-semibold text-[color:var(--fg-subtle)]">Échéance: {new Date(o.due_at).toLocaleString()}</div>
                  ) : null}
                  {o.notes ? <div className="mt-1 text-[11px] text-[color:var(--fg-subtle)]">{o.notes}</div> : null}
                  <div className="mt-1 text-xs font-bold text-[color:var(--fg)]">{(o.price_estimate ?? 0).toFixed(2)} DA</div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        void openQr(o.id);
                      }}
                    >
                      QR
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || o.status === 'in_progress'}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.patch(`/api/repairs/${o.id}/status`, { status: 'in_progress' });
                          await list.refetch();
                          pushToast({ kind: 'success', title: 'Statut mis à jour' });
                        } catch (e: any) {
                          pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      En cours
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || o.status === 'ready'}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.patch(`/api/repairs/${o.id}/status`, { status: 'ready' });
                          await list.refetch();
                          pushToast({ kind: 'success', title: 'Statut mis à jour' });
                        } catch (e: any) {
                          pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Prête
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy || o.status === 'delivered'}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api.patch(`/api/repairs/${o.id}/status`, { status: 'delivered' });
                          await list.refetch();
                          pushToast({ kind: 'success', title: 'Statut mis à jour' });
                        } catch (e: any) {
                          pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Livrée
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-extrabold text-[color:var(--fg)]">Créer</div>
          <div className="mt-3 space-y-2">
            <Input value={cq} onChange={(e) => setCq(e.target.value)} placeholder="Recherche cliente (nom / téléphone)" />
            {selectedCustomer ? (
              <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3">
                <div className="text-xs font-semibold text-[color:var(--fg-subtle)]">Cliente</div>
                <div className="text-sm font-extrabold text-[color:var(--fg)]">{selectedCustomer.full_name}</div>
                <div className="mt-0.5 text-xs text-[color:var(--fg-subtle)]">{selectedCustomer.phone ?? ''}</div>
                <Button
                  variant="secondary"
                  className="mt-2 w-full"
                  onClick={() => {
                    setCustomerId(null);
                    setCq('');
                  }}
                >
                  Détacher
                </Button>
              </div>
            ) : cq.trim() ? (
              <div className="space-y-2">
                {customerItems.map((c) => (
                  <button
                    key={c.id}
                    className="w-full rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3 text-left shadow-glass ring-1 ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)] transition hover:bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))]"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCq('');
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-[color:var(--fg)]">{c.full_name}</div>
                        <div className="mt-0.5 text-xs text-[color:var(--fg-subtle)]">{c.phone ?? ''}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold text-[color:var(--fg-subtle)]">{String(c.vipTier ?? 'none')}</div>
                        <div className="text-xs font-extrabold text-[color:var(--accent-strong)]">{c.loyalty_points} pts</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Estimation" type="number" />
            <Input value={dueAt} onChange={(e) => setDueAt(e.target.value)} placeholder="Échéance" type="datetime-local" />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const dueAtMs = dueAt ? new Date(dueAt).getTime() : undefined;
                  const res = await api.post('/api/repairs', {
                    kind,
                    title,
                    priceEstimate: Number(price || 0),
                    dueAt: dueAtMs,
                    notes: notes || undefined,
                    customerId: customerId ?? undefined,
                  });
                  setTitle('');
                  setPrice('0');
                  setDueAt('');
                  setNotes('');
                  setCustomerId(null);
                  setCq('');
                  await list.refetch();
                  pushToast({
                    kind: 'success',
                    title: kind === 'repair' ? 'Retouche créée' : 'Réservation créée',
                    message: res.data?.orderNumber ? `N° ${res.data.orderNumber}` : undefined,
                    ttlMs: 4000,
                  });
                  if (res.data?.id) {
                    await openQr(String(res.data.id));
                  }
                } catch (e: any) {
                  const msg = e?.response?.data?.detail ?? e?.message ?? 'Erreur';
                  pushToast({ kind: 'error', title: 'Erreur de création', message: String(msg) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
