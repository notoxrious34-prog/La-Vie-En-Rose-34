import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { motion } from 'framer-motion';
import { pushToast } from '../lib/toast';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  loyalty_points: number;
  vip: number;
  vipTier?: 'none' | 'silver' | 'gold' | 'platinum';
  vip_override_tier?: 'none' | 'silver' | 'gold' | 'platinum' | null;
  lifetime_spend_total?: number;
};

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vipOverrideTier, setVipOverrideTier] = useState<'auto' | 'none' | 'silver' | 'gold' | 'platinum'>('auto');
  const [pointsDelta, setPointsDelta] = useState('0');

  const list = useQuery({
    queryKey: ['customers', qDebounced],
    queryFn: async () => {
      const res = await api.get('/api/customers', { params: { q: qDebounced, limit: 50 } });
      return res.data.items as Customer[];
    },
  });

  const selected = (list.data ?? []).find((c) => c.id === selectedId) ?? null;

  function formatDA(v: number) {
    return `${v.toFixed(2)} DA`;
  }

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
            <div className="text-xs font-semibold text-[color:var(--accent-strong)]">Clients</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-[color:var(--fg)]">Base clients</div>
            <div className="mt-1 text-sm text-[color:var(--fg-muted)]">Fidélité, statut VIP et historique de valeur.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="rose">Loyalty</Badge>
            <Badge variant="gold">VIP</Badge>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Recherche (nom / téléphone)" />
          <div className="mt-4 space-y-2">
            {list.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="lux-row">
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-3/4" radius="xl" />
                    <Skeleton className="h-3 w-1/3" radius="xl" />
                  </div>
                </div>
              ))
            ) : (list.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-sm text-[color:var(--fg-muted)]">
                {q ? 'Aucun client trouvé' : 'Aucun client enregistré'}
              </div>
            ) : null}
            {!list.isLoading && (list.data ?? []).map((c) => (
              <button
                key={c.id}
                className="lux-row ring-1 ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)]"
                onClick={() => {
                  setSelectedId(c.id);
                  setVipOverrideTier('auto');
                  setPointsDelta('0');
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-[color:var(--fg)]">{c.full_name}</div>
                    <div className="mt-1 text-xs text-[color:var(--fg-muted)]">{c.phone ?? ''}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-semibold text-[color:var(--fg-muted)]">Tier</div>
                    <div className="text-xs font-extrabold text-[color:var(--accent-strong)]">{c.vipTier ?? (c.vip ? 'vip' : 'none')}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="lux-row-cell">
                    <div className="text-[color:var(--fg-muted)]">Points</div>
                    <div className="mt-0.5 font-extrabold text-[color:var(--fg)]">{c.loyalty_points}</div>
                  </div>
                  <div className="lux-row-cell">
                    <div className="text-[color:var(--fg-muted)]">Spend</div>
                    <div className="mt-0.5 font-extrabold text-[color:var(--fg)]">{formatDA(Number(c.lifetime_spend_total ?? 0))}</div>
                  </div>
                  <div className="lux-row-cell">
                    <div className="text-[color:var(--fg-muted)]">VIP</div>
                    <div className="mt-0.5 font-extrabold text-[color:var(--fg)]">{c.vip ? 'Yes' : 'No'}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-sm font-extrabold text-[color:var(--fg)]">Ajouter</div>
          <div className="mt-3 space-y-2">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" />
            <Button
              className="w-full"
              disabled={busy || !fullName.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await api.post('/api/customers', { fullName, phone });
                  setFullName('');
                  setPhone('');
                  queryClient.invalidateQueries({ queryKey: ['customers'] });
                  pushToast({ kind: 'success', title: 'Client ajouté', message: fullName });
                } catch (e: any) {
                  const msg = e?.response?.data?.error ?? e?.message ?? 'Erreur';
                  pushToast({ kind: 'error', title: 'Impossible d\'ajouter', message: String(msg) });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Enregistrer
            </Button>
          </div>
        </Card>

        <Card className="p-4 lg:col-span-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-extrabold text-[color:var(--fg)]">Loyalty & VIP</div>
              <div className="mt-1 text-xs font-semibold text-[color:var(--fg-muted)]">
                Points: 1 point لكل 100 DA (بعد الخصم). Tiers: silver 200k, gold 500k, platinum 1M.
              </div>
            </div>
            <div className="text-xs font-semibold text-[color:var(--fg-muted)]">
              {selected ? `Selected: ${selected.full_name}` : 'Select a customer to edit'}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="p-4">
              <div className="text-xs font-extrabold text-[color:var(--fg)]">VIP override tier</div>
              <div className="mt-2">
                <Select
                  value={vipOverrideTier}
                  onChange={(e) =>
                    setVipOverrideTier(
                      e.target.value as 'auto' | 'none' | 'silver' | 'gold' | 'platinum'
                    )
                  }
                  disabled={!selected}
                >
                  <option value="auto">Auto</option>
                  <option value="none">None</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </Select>
              </div>
              <Button
                className="mt-3 w-full"
                disabled={busy || !selected}
                onClick={async () => {
                  if (!selected) return;
                  setBusy(true);
                  try {
                    await api.patch(`/api/customers/${selected.id}`, {
                      vipOverrideTier: vipOverrideTier === 'auto' ? null : vipOverrideTier,
                    });
                    queryClient.invalidateQueries({ queryKey: ['customers'] });
                    pushToast({ kind: 'success', title: 'Tier VIP mis à jour' });
                  } catch (e: any) {
                    pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Apply
              </Button>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-extrabold text-[color:var(--fg)]">Adjust points</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input
                  value={pointsDelta}
                  onChange={(e) => setPointsDelta(e.target.value)}
                  type="number"
                  placeholder="Delta (e.g. 50 or -20)"
                  disabled={!selected}
                />
                <Button
                  disabled={busy || !selected}
                  onClick={async () => {
                    if (!selected) return;
                    setBusy(true);
                    try {
                      const delta = Number(pointsDelta || 0);
                      if (delta === 0) { setBusy(false); return; }
                      await api.post(`/api/customers/${selected.id}/loyalty/adjust`, {
                        delta,
                      });
                      setPointsDelta('0');
                      queryClient.invalidateQueries({ queryKey: ['customers'] });
                      pushToast({ kind: 'success', title: 'Points ajustés', message: `${delta > 0 ? '+' : ''}${delta} pts` });
                    } catch (e: any) {
                      pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.error ?? e?.message ?? 'Erreur') });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Save
                </Button>
              </div>
              <div className="mt-2 text-xs text-[color:var(--fg-muted)]">Use negative to remove points.</div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-extrabold text-[color:var(--fg)]">Quick stats</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-2xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))] px-3 py-2">
                  <span className="text-[color:var(--fg-muted)]">Tier</span>
                  <span className="font-extrabold text-[color:var(--fg)]">{selected?.vipTier ?? '-'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))] px-3 py-2">
                  <span className="text-[color:var(--fg-muted)]">Spend</span>
                  <span className="font-extrabold text-[color:var(--fg)]">{selected ? formatDA(Number(selected.lifetime_spend_total ?? 0)) : '-'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-[color:var(--glass-border)] bg-[color:color-mix(in_srgb,var(--glass-bg)_70%,var(--surface-1))] px-3 py-2">
                  <span className="text-[color:var(--fg-muted)]">Points</span>
                  <span className="font-extrabold text-[color:var(--fg)]">{selected ? String(selected.loyalty_points) : '-'}</span>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
