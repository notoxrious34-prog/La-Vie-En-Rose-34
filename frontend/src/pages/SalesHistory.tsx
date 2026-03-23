import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ReceiptView, type ReceiptData } from '../components/pos/ReceiptView';
import { Skeleton } from '../components/ui/Skeleton';
import { AnimatedModal } from '../components/ui/AnimatedModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '../components/ui/Badge';
import { Receipt, Calendar, Search, FileText, Sparkles, Printer } from 'lucide-react';
import { pushToast } from '../lib/toast';

type SaleListItem = {
  id: string;
  orderNumber: string;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  changeDue: number;
  createdAt: number;
};

type SaleDetails = {
  id: string;
  orderNumber: string;
  createdAt: number;
  subtotal: number;
  discountTotal: number;
  total: number;
  paidTotal: number;
  changeDue: number;
  items: Array<{ name: string; unitPrice: number; quantity: number; discount: number; total: number }>;
  payments: Array<{ method: 'cash' | 'cib' | 'edahabia' | 'transfer'; amount: number }>;
};

export default function SalesHistoryPage() {
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [q, setQ] = useState<string>('');
  const [qDebounced, setQDebounced] = useState<string>('');
  const [selected, setSelected] = useState<SaleDetails | null>(null);
  const [loadingSaleId, setLoadingSaleId] = useState<string | null>(null);
  const [pendingPrint, setPendingPrint] = useState(false);
  const [limit, setLimit] = useState<number>(100);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  async function printReceipt() {
    const eapi = (window as any)?.electronAPI;
    if (eapi?.print?.receipt) {
      try {
        await eapi.print.receipt();
        return;
      } catch {
        // fall back to window.print
      }
    }
    window.print();
  }

  useEffect(() => {
    if (!pendingPrint || !selected) return;
    const t = window.setTimeout(() => {
      void printReceipt();
      setPendingPrint(false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [pendingPrint, selected]);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  const list = useQuery({
    queryKey: ['pos-sales', from, to, limit],
    queryFn: async () => {
      const res = await api.get('/api/pos/sales', {
        params: {
          from: from || undefined,
          to: to || undefined,
          limit,
        },
      });
      return res.data as { items: SaleListItem[] };
    },
  });

  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const filteredItems = useMemo(() => {
    if (!qDebounced) return items;
    const needle = qDebounced.toLowerCase();
    return items.filter((s) => s.orderNumber.toLowerCase().includes(needle));
  }, [items, qDebounced]);

  function formatDA(v: number) {
    return `${v.toFixed(2)} DA`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      <AnimatedModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[color:var(--accent-strong)]" />
            Aperçu du reçu
          </div>
        }
        maxWidthClassName="max-w-xl"
      >
        {selected && (
          <>
            <div
              className="max-h-[60vh] overflow-y-auto rounded-2xl border p-4"
              style={{ borderColor: 'var(--border-soft)', background: 'color-mix(in srgb, var(--surface-1) 86%, transparent)' }}
            >
              <ReceiptView
                data={
                  {
                    orderNumber: selected.orderNumber,
                    createdAt: selected.createdAt,
                    items: selected.items,
                    subtotal: selected.subtotal,
                    discountTotal: selected.discountTotal,
                    total: selected.total,
                    payments: selected.payments,
                    paidTotal: selected.paidTotal,
                    changeDue: selected.changeDue,
                  } satisfies ReceiptData
                }
              />
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => void printReceipt()}
                className="flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Imprimer
              </Button>
              <Button variant="primary" onClick={() => setSelected(null)}>
                Fermer
              </Button>
            </div>
          </>
        )}
      </AnimatedModal>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border p-6 backdrop-blur-2xl"
        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', boxShadow: 'var(--shadow-surface)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(900px_650px_at_20%_40%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_55%),radial-gradient(700px_520px_at_80%_60%,color-mix(in_srgb,var(--color-secondary-500)_10%,transparent),transparent_60%)]" />
        <div className="absolute top-0 h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] blur-3xl" style={{ insetInlineEnd: 0 }} />
        
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--color-secondary-500)_26%,transparent)] shadow-glass"
              style={{ background: 'var(--gradient-secondary)' }}
            >
              <Receipt className="h-7 w-7" style={{ color: 'var(--on-accent)' }} />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--color-secondary-600)]">
                <Sparkles className="h-3 w-3" />
                Ventes
              </div>
              <div className="mt-0.5 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--fg)' }}>
                Historique des ventes
              </div>
              <div className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
                Rechercher, consulter, réimprimer — sans friction
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center gap-2"
          >
            <Badge variant="rose">POS</Badge>
            <Badge variant="gold">
              {list.isFetching ? <Skeleton className="h-3 w-16" radius="xl" /> : `${items.length} vente(s)`}
            </Badge>
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border p-5 backdrop-blur-2xl"
        style={{ background: 'var(--glass-bg)', borderColor: 'var(--glass-border)', boxShadow: 'var(--shadow-surface)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(900px_650px_at_20%_40%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_55%),radial-gradient(700px_520px_at_80%_60%,color-mix(in_srgb,var(--color-secondary-500)_8%,transparent),transparent_60%)]" />
        <div className="relative z-10">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative">
              <Calendar
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--fg-subtle)', insetInlineStart: '1rem' }}
              />
              <Input 
                value={from} 
                onChange={(e) => setFrom(e.target.value)} 
                placeholder="Du (YYYY-MM-DD)"
                className="[padding-inline-start:2.75rem]"
              />
            </div>
            <div className="relative">
              <Calendar
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--fg-subtle)', insetInlineStart: '1rem' }}
              />
              <Input 
                value={to} 
                onChange={(e) => setTo(e.target.value)} 
                placeholder="Au (YYYY-MM-DD)"
                className="[padding-inline-start:2.75rem]"
              />
            </div>
            <div className="relative">
              <Search
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: 'var(--fg-subtle)', insetInlineStart: '1rem' }}
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Recherche (N° commande)…"
                className="[padding-inline-start:2.75rem]"
              />
            </div>
            <div className="flex items-center justify-between md:justify-end">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                <Search className="h-4 w-4" />
                {list.isFetching ? <Skeleton className="h-3 w-24" radius="xl" /> : `${filteredItems.length} résultat(s)`}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03, duration: 0.3 }}
            >
              <motion.div
                whileHover={{ y: -4, scale: 1.01 }}
                className="lux-row group relative overflow-hidden"
                style={{
                  borderColor: 'var(--glass-border)',
                  background: 'color-mix(in srgb, var(--surface-1) 74%, transparent)',
                  boxShadow: 'var(--shadow-surface)',
                }}
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-8 w-8 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--color-secondary-500)_26%,transparent)] shadow-glass"
                          style={{ background: 'var(--gradient-secondary)' }}
                        >
                          <FileText className="h-4 w-4" style={{ color: 'var(--on-accent)' }} />
                        </div>
                        <div className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{s.orderNumber}</div>
                      </div>
                      <div className="mt-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
                        {new Date(s.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--fg-subtle)' }}>
                        Total
                      </div>
                      <div className="text-xl font-extrabold text-[color:var(--accent-strong)]">{formatDA(s.total)}</div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div
                      className="lux-row-cell flex items-center justify-between"
                      style={{ borderColor: 'var(--border-soft)', background: 'color-mix(in srgb, var(--surface-2) 72%, transparent)' }}
                    >
                      <span className="text-[10px] font-medium" style={{ color: 'var(--fg-subtle)' }}>Payé</span>
                      <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>{formatDA(s.paidTotal)}</span>
                    </div>
                    <div
                      className="lux-row-cell flex items-center justify-between"
                      style={{ borderColor: 'var(--border-soft)', background: 'color-mix(in srgb, var(--surface-2) 72%, transparent)' }}
                    >
                      <span className="text-[10px] font-medium" style={{ color: 'var(--fg-subtle)' }}>Rendu</span>
                      <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>{formatDA(s.changeDue)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={loadingSaleId === s.id}
                      onClick={async () => {
                        setLoadingSaleId(s.id);
                        try {
                          const res = await api.get(`/api/pos/sales/${s.id}`);
                          setSelected(res.data as SaleDetails);
                          pushToast({ kind: 'info', title: 'Reçu chargé', message: String(s.orderNumber), ttlMs: 2500 });
                        } catch {
                          pushToast({ kind: 'error', title: 'Impossible de charger le reçu', ttlMs: 5000 });
                        } finally {
                          setLoadingSaleId(null);
                        }
                      }}
                    >
                      {loadingSaleId === s.id ? <Skeleton className="h-3 w-12" radius="xl" /> : 'Voir'}
                    </Button>
                    <Button
                      className="w-full"
                      variant="primary"
                      disabled={loadingSaleId === s.id}
                      onClick={async () => {
                        setLoadingSaleId(s.id);
                        try {
                          const res = await api.get(`/api/pos/sales/${s.id}`);
                          setSelected(res.data as SaleDetails);
                          setPendingPrint(true);
                          pushToast({ kind: 'info', title: 'Impression…', message: String(s.orderNumber), ttlMs: 2500 });
                        } catch {
                          pushToast({ kind: 'error', title: 'Impossible d\'imprimer (reçu)', ttlMs: 5000 });
                        } finally {
                          setLoadingSaleId(null);
                        }
                      }}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <Printer className="h-4 w-4" />
                        Imprimer
                      </span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {list.isError && (
        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border-soft)', background: 'color-mix(in srgb, var(--surface-1) 80%, transparent)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--fg)' }}>Impossible de charger les ventes</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--fg-muted)' }}>Vérifiez votre connexion ou réessayez.</div>
        </div>
      )}

      {!list.isFetching && !list.isError && items.length >= limit && limit < 200 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="secondary"
            onClick={() => {
              const next = Math.min(200, limit + 50);
              setLimit(next);
              pushToast({ kind: 'info', title: 'Mise à jour', message: `Limite: ${next}`, ttlMs: 2000 });
            }}
          >
            Charger plus
          </Button>
        </div>
      )}

      {filteredItems.length === 0 && !list.isFetching && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16 text-center"
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'color-mix(in srgb, var(--surface-2) 85%, transparent)' }}
          >
            <Receipt className="h-8 w-8" style={{ color: 'var(--fg-subtle)' }} />
          </div>
          <div className="mt-4 text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>
            Aucune vente trouvée
          </div>
          <div className="mt-1 text-xs" style={{ color: 'var(--fg-subtle)' }}>
            Essayez de modifier les dates de filtre
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
