import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { AnimatedModal } from '../components/ui/AnimatedModal';
import { Skeleton } from '../components/ui/Skeleton';
import { Select } from '../components/ui/Select';
import { useBarcode } from '../hooks/useBarcode';
import type { CartLine } from '../types/pos';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { pushToast } from '../lib/toast';
import { ReceiptView, type ReceiptData } from '../components/pos/ReceiptView';
import { Trash2, Plus, Minus, ShoppingCart, User, TicketPercent, Wallet, Sparkles, RotateCcw } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  barcode?: string | null;
  sku?: string | null;
  sale_price: number;
};

type CustomerLite = {
  id: string;
  full_name: string;
  phone: string | null;
  loyalty_points: number;
  vipTier?: 'none' | 'silver' | 'gold' | 'platinum';
};

type DailySummary = {
  date: string;
  ordersCount: number;
  salesTotal: number;
  profitTotal: number;
};

type PosSession = {
  v?: number;
  q: string;
  cq: string;
  cart: CartLine[];
  customerId: string | null;
  orderDiscount: number;
  payments: Array<{ method: 'cash' | 'cib' | 'edahabia' | 'transfer'; amount: number }>;
  updatedAt: number;
};

export function POSPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [cq, setCq] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [payments, setPayments] = useState<Array<{ method: 'cash' | 'cib' | 'edahabia' | 'transfer'; amount: number }>>([
    { method: 'cash', amount: 0 },
  ]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);
  const restoreToastShown = useRef(false);

  const today = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const dailySummary = useQuery({
    queryKey: ['pos-daily-summary', today],
    queryFn: async () => {
      const res = await api.get('/api/pos/daily-summary', { params: { date: today } });
      return res.data as DailySummary;
    },
    refetchInterval: 20_000,
  });

  const searchRef = useRef<HTMLInputElement | null>(null);

  const products = useQuery({
    queryKey: ['products', q],
    queryFn: async () => {
      const res = await api.get('/api/products', { params: { q, limit: 30 } });
      return res.data.items as Product[];
    },
  });

  const customers = useQuery({
    queryKey: ['customers-pos', cq],
    queryFn: async () => {
      const res = await api.get('/api/customers', { params: { q: cq, limit: 10 } });
      return res.data.items as CustomerLite[];
    },
    enabled: cq.trim().length > 0,
  });

  const items = useMemo(() => products.data ?? [], [products.data]);
  const customerItems = useMemo(() => customers.data ?? [], [customers.data]);
  const selectedCustomer = useMemo(
    () => customerItems.find((c) => c.id === customerId) ?? null,
    [customerItems, customerId]
  );

  const addToCart = useCallback(
    (p: Product) => {
      if (busy) return;
      setCart((prev) => {
        const existing = prev.find((x) => x.variantId === p.id);
        if (existing) {
          return prev.map((x) => (x.variantId === p.id ? { ...x, quantity: x.quantity + 1 } : x));
        }
        return [
          ...prev,
          {
            variantId: p.id,
            name: p.name,
            sku: p.sku,
            barcode: p.barcode,
            unitPrice: p.sale_price,
            quantity: 1,
            discount: 0,
          },
        ];
      });

      try {
        window.setTimeout(() => {
          searchRef.current?.focus?.();
        }, 0);
      } catch {
        // ignore
      }
    },
    [busy]
  );

  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0);
  const safeOrderDiscount = Math.max(0, Math.min(Number.isFinite(orderDiscount) ? orderDiscount : 0, subtotal));
  const total = Math.max(0, subtotal - safeOrderDiscount);
  const paid = payments.reduce((s, p) => s + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const paymentInvalid = payments.some((p) => !Number.isFinite(p.amount) || p.amount < 0);
  const canCheckout = !busy && cart.length > 0 && !paymentInvalid && paid >= total - 0.01;
  const cashPaid = payments.filter((p) => p.method === 'cash').reduce((s, p) => s + (p.amount || 0), 0);
  const nonCashPaid = Math.max(0, paid - cashPaid);
  const remainingAfterNonCash = Math.max(0, total - nonCashPaid);
  const change = Math.max(0, cashPaid - remainingAfterNonCash);

  const usedPaymentMethods = useMemo(() => new Set(payments.map((p) => p.method)), [payments]);

  useEffect(() => {
    setPayments((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return [{ method: 'cash', amount: 0 }];

      const sanitized = prev.map((p) => ({
        method: p.method,
        amount: Math.max(0, Number.isFinite(p.amount) ? p.amount : 0),
      }));

      if (total <= 0) {
        const zeroed = sanitized.map((p) => ({ ...p, amount: 0 }));
        const changed = zeroed.some((p, i) => p.amount !== prev[i]?.amount);
        return changed ? zeroed : prev;
      }

      const clamped = sanitized.map((p, idx) => {
        if (p.method === 'cash') return p;
        const sumOther = sanitized.reduce((s, x, i) => (i === idx ? s : s + x.amount), 0);
        const remaining = Math.max(0, total - sumOther);
        return { ...p, amount: Math.min(p.amount, remaining) };
      });

      const changed = clamped.some((p, i) => p.amount !== prev[i]?.amount);
      return changed ? clamped : prev;
    });
  }, [total]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('lver34.pos.session');
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PosSession>;
      if (!parsed || typeof parsed !== 'object') return;
      const now = Date.now();
      if (typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)) {
        const ageMs = Math.max(0, now - parsed.updatedAt);
        if (ageMs > 36 * 60 * 60 * 1000) return;
      }

      let restoredSomething = false;

      if (Array.isArray(parsed.cart)) {
        const sanitizedCart = (parsed.cart as any[])
          .filter((x) => x && typeof x === 'object')
          .map((x) => ({
            variantId: String((x as any).variantId ?? ''),
            name: String((x as any).name ?? ''),
            sku: typeof (x as any).sku === 'string' ? (x as any).sku : null,
            barcode: typeof (x as any).barcode === 'string' ? (x as any).barcode : null,
            unitPrice: Number.isFinite(Number((x as any).unitPrice)) ? Number((x as any).unitPrice) : 0,
            quantity: Math.max(1, Number.isFinite(Number((x as any).quantity)) ? Number((x as any).quantity) : 1),
            discount: Math.max(0, Number.isFinite(Number((x as any).discount)) ? Number((x as any).discount) : 0),
          }))
          .filter((x) => x.variantId && x.name);
        setCart(sanitizedCart as CartLine[]);
        if (sanitizedCart.length > 0) restoredSomething = true;
      }
      if (typeof parsed.q === 'string' && parsed.q.trim()) {
        setQ(parsed.q);
        restoredSomething = true;
      }
      if (typeof parsed.cq === 'string' && parsed.cq.trim()) {
        setCq(parsed.cq);
        restoredSomething = true;
      }
      if (typeof parsed.customerId === 'string' || parsed.customerId === null) setCustomerId(parsed.customerId ?? null);
      if (typeof parsed.customerId === 'string' && parsed.customerId) restoredSomething = true;
      if (typeof parsed.orderDiscount === 'number') setOrderDiscount(parsed.orderDiscount);
      if (typeof parsed.orderDiscount === 'number' && parsed.orderDiscount > 0) restoredSomething = true;
      if (Array.isArray(parsed.payments) && parsed.payments.length > 0) {
        const allowed = new Set(['cash', 'cib', 'edahabia', 'transfer']);
        setPayments(
          (parsed.payments as any[])
            .filter((p) => p && typeof p === 'object')
            .map((p) => ({
              method: (allowed.has(String((p as any).method)) ? String((p as any).method) : 'cash') as PosSession['payments'][number]['method'],
              amount: Number.isFinite(Number((p as any).amount)) && Number((p as any).amount) >= 0 ? Number((p as any).amount) : 0,
            }))
            .slice(0, 6)
        );
        restoredSomething = true;
      }

      if (restoredSomething && !restoreToastShown.current) {
        restoreToastShown.current = true;
        pushToast({ kind: 'info', title: 'Session restaurée', message: 'Reprise de la vente en cours', ttlMs: 2500 });
      }
    } catch {
      // ignore
    }
    // restore only once on mount
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const session: PosSession = {
          v: 1,
          q,
          cq,
          cart,
          customerId,
          orderDiscount: safeOrderDiscount,
          payments: payments.map((p) => ({
            method: p.method,
            amount: Number.isFinite(p.amount) && p.amount >= 0 ? p.amount : 0,
          })),
          updatedAt: Date.now(),
        };
        window.localStorage.setItem('lver34.pos.session', JSON.stringify(session));
      } catch {
        // ignore
      }
    }, 180);

    return () => window.clearTimeout(t);
  }, [q, cq, cart, customerId, payments, safeOrderDiscount]);

  function resetSale() {
    setCart([]);
    setQ('');
    setCq('');
    setCustomerId(null);
    setOrderDiscount(0);
    setPayments([{ method: 'cash', amount: 0 }]);
    try {
      window.localStorage.removeItem('lver34.pos.session');
    } catch {
      // ignore
    }
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }

  useEffect(() => {
    window.setTimeout(() => searchRef.current?.focus(), 50);
  }, []);

  const onBarcode = useCallback(
    (code: string) => {
      void (async () => {
        if (busy) return;
        try {
          const res = await api.get('/api/products/lookup', { params: { code } });
          addToCart(res.data as Product);
        } catch {
          setQ(code);
        }
      })();
    },
    [addToCart, busy]
  );

  useBarcode(onBarcode);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      <AnimatedModal
        open={Boolean(receiptOpen && lastReceipt)}
        onClose={() => {
          if (printingReceipt) return;
          setReceiptOpen(false);
        }}
        title="Reçu de vente"
        maxWidthClassName="max-w-xl"
        disableOutsideClose={printingReceipt}
      >
        <div className="flex items-center justify-end gap-2 mb-4">
          <Button
            variant="secondary"
            disabled={printingReceipt}
            onClick={() => {
              if (printingReceipt) return;
              setPrintingReceipt(true);
              void (async () => {
                try {
                  await printReceipt();
                } finally {
                  setPrintingReceipt(false);
                }
              })();
            }}
          >
            {printingReceipt ? 'Impression…' : 'Imprimer'}
          </Button>
          <Button
            variant="secondary"
            disabled={printingReceipt}
            onClick={() => {
              if (printingReceipt) return;
              setReceiptOpen(false);
            }}
          >
            Fermer
          </Button>
          <Button
            variant="primary"
            disabled={printingReceipt}
            onClick={() => {
              if (printingReceipt) return;
              setReceiptOpen(false);
              resetSale();
            }}
          >
            Terminer
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto rounded-2xl border border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--surface-1)_86%,transparent)] p-4">
          {lastReceipt ? <ReceiptView data={lastReceipt} /> : null}
        </div>
      </AnimatedModal>

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="lux-page-hero p-6"
      >
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] shadow-glass"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <ShoppingCart className="h-7 w-7" style={{ color: 'var(--on-accent)' }} />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--accent-strong)]">
                <Sparkles className="h-3 w-3" />
                Caisse
              </div>
              <div className="mt-0.5 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--fg)' }}>Vente rapide</div>
              <div className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
                Une expérience de vente ultra-fluide et luxueuse
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                background: 'color-mix(in srgb, var(--surface-1) 75%, transparent)',
                borderColor: 'var(--border-soft)',
                boxShadow: 'var(--shadow-control)',
              }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--fg-subtle)' }}>
                Aujourd'hui
              </div>
              <div className="mt-1 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--fg-subtle)' }}>Ventes</div>
                  <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>
                    {dailySummary.isError
                      ? '—'
                      : dailySummary.isFetching && !dailySummary.data
                        ? '—'
                        : String(dailySummary.data?.ordersCount ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--fg-subtle)' }}>Total</div>
                  <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>
                    {dailySummary.isError
                      ? '—'
                      : dailySummary.isFetching && !dailySummary.data
                        ? '—'
                        : `${Number(dailySummary.data?.salesTotal ?? 0).toFixed(2)} DA`}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase" style={{ color: 'var(--fg-subtle)' }}>Profit</div>
                  <div className="text-sm font-black" style={{ color: 'var(--fg)' }}>
                    {dailySummary.isError
                      ? '—'
                      : dailySummary.isFetching && !dailySummary.data
                        ? '—'
                        : `${Number(dailySummary.data?.profitTotal ?? 0).toFixed(2)} DA`}
                  </div>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                if (busy) return;
                const ok = window.confirm('Réinitialiser la session caisse ?');
                if (!ok) return;
                resetSale();
              }}
            >
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </span>
            </Button>

          </div>

          <AnimatePresence>
            {selectedCustomer && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="lux-row flex-row items-center gap-3 rounded-2xl p-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)]" style={{ background: 'var(--gradient-primary)' }}>
                  <User className="h-5 w-5" style={{ color: 'var(--on-accent)' }} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold" style={{ color: 'var(--fg)' }}>
                    {selectedCustomer.full_name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Badge variant="neutral" className="text-[10px]">{selectedCustomer.vipTier ?? 'none'}</Badge>
                    <span className="text-[11px] font-semibold" style={{ color: 'var(--fg-subtle)' }}>
                      {selectedCustomer.loyalty_points} pts
                    </span>
                  </div>
                </div>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                  style={{ color: 'var(--fg-subtle)' }}
                  disabled={busy}
                  onClick={() => {
                    setCustomerId(null);
                    setCq('');
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6 min-w-0">
          <Card className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="relative group">
                <Input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Produit, SKU ou Code-barres..."
                  className="[padding-inline-start:2.5rem]"
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-colors"
                  style={{ insetInlineStart: '0.85rem', color: 'var(--fg-subtle)' }}
                >
                  <ShoppingCart className="h-4 w-4" />
                </div>
              </div>
              <div className="relative group">
                <Input
                  value={cq}
                  onChange={(e) => setCq(e.target.value)}
                  placeholder="Recherche cliente (Nom, Tél)..."
                  className="[padding-inline-start:2.5rem]"
                  disabled={busy}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 transition-colors"
                  style={{ insetInlineStart: '0.85rem', color: 'var(--fg-subtle)' }}
                >
                  <User className="h-4 w-4" />
                </div>
                
                <AnimatePresence>
                  {cq.trim() && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full z-30 mt-2 rounded-2xl border p-2 shadow-2xl backdrop-blur-xl"
                      style={{
                        insetInlineStart: 0,
                        insetInlineEnd: 0,
                        borderColor: 'var(--glass-border)',
                        background: 'color-mix(in srgb, var(--surface-1) 86%, transparent)',
                        boxShadow: 'var(--shadow-surface)',
                      }}
                    >
                      {customers.isFetching ? (
                        <div className="p-4 text-center text-xs font-bold animate-pulse" style={{ color: 'var(--fg-muted)' }}>
                          Recherche...
                        </div>
                      ) : customers.isError ? (
                        <div className="p-4 text-center text-xs font-bold" style={{ color: 'var(--fg-muted)' }}>
                          Connexion impossible
                        </div>
                      ) : customerItems.length === 0 ? (
                        <div className="p-4 text-center text-xs font-bold" style={{ color: 'var(--fg-muted)' }}>
                          Aucun résultat
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {customerItems.map((c) => (
                            <button
                              key={c.id}
                              className="lux-row w-full flex-row items-center justify-between rounded-2xl p-3"
                              style={{ color: 'var(--fg)' }}
                              disabled={busy}
                              onClick={() => {
                                setCustomerId(c.id);
                                setCq('');
                                pushToast({ kind: 'info', title: 'Cliente associée', message: c.full_name, ttlMs: 3500 });
                              }}
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-black transition-colors" style={{ color: 'var(--fg)' }}>
                                  {c.full_name}
                                </div>
                                <div className="text-[11px] font-bold" style={{ color: 'var(--fg-subtle)' }}>
                                  {c.phone}
                                </div>
                              </div>
                              <div className="text-right">
                                <Badge variant="rose" className="text-[10px]">{c.vipTier ?? 'none'}</Badge>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="mt-8">
              {products.isFetching ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="lux-row flex-col items-stretch overflow-hidden rounded-[2rem] p-3">
                      <Skeleton className="aspect-[4/5] w-full rounded-[1.5rem]" radius="3xl" />
                      <div className="mt-4 px-1 pb-2 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <div className="flex items-baseline gap-2">
                          <Skeleton className="h-6 w-24" />
                          <Skeleton className="h-3 w-10" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : products.isError ? (
                <div className="py-20 text-center">
                  <div
                    className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'var(--accent-softer)' }}
                  >
                    <ShoppingCart className="h-6 w-6" style={{ color: 'var(--accent-strong)' }} />
                  </div>
                  <div className="text-sm font-bold italic" style={{ color: 'var(--fg-muted)' }}>
                    Connexion impossible
                  </div>
                </div>
              ) : items.length === 0 ? (
                <div className="py-20 text-center">
                  <div
                    className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-4"
                    style={{ background: 'var(--accent-softer)' }}
                  >
                    <ShoppingCart className="h-6 w-6" style={{ color: 'var(--accent-strong)' }} />
                  </div>
                  <div className="text-sm font-bold italic" style={{ color: 'var(--fg-muted)' }}>
                    Aucun produit trouvé
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {items.map((p) => (
                    <motion.button
                      key={p.id}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      className="lux-row group relative flex-col items-stretch overflow-hidden rounded-[2rem] p-3 text-left transition-all duration-300"
                      disabled={busy}
                      aria-disabled={busy}
                      onClick={() => addToCart(p)}
                    >
                      <div
                        className="aspect-[4/5] w-full overflow-hidden rounded-[1.5rem] flex items-center justify-center relative"
                        style={{
                          background: 'linear-gradient(135deg, var(--accent-softer), color-mix(in srgb, var(--surface-1) 80%, transparent))',
                        }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_srgb,var(--surface-1)_40%,transparent),transparent_60%)]" />
                        <Sparkles className="h-10 w-10 transition-colors" style={{ color: 'color-mix(in srgb, var(--accent) 26%, transparent)' }} />
                        <div className="absolute bottom-3" style={{ insetInlineStart: '0.75rem' }}>
                          <Badge
                            variant="neutral"
                            className="backdrop-blur-sm text-[10px] font-black uppercase tracking-tighter"
                            style={{
                              background: 'color-mix(in srgb, var(--surface-1) 82%, transparent)',
                              borderColor: 'var(--border-soft)',
                              color: 'var(--fg)',
                            }}
                          >
                            {p.sku ?? p.barcode ?? 'LV34'}
                          </Badge>
                        </div>
                      </div>

                      <div className="mt-4 px-1 pb-2">
                        <div
                          className="text-[13px] font-black uppercase tracking-tight line-clamp-1 transition-colors"
                          style={{ color: 'var(--fg)' }}
                        >
                          {p.name}
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <span className="text-lg font-black text-[color:var(--accent-strong)]">{p.sale_price.toFixed(2)}</span>
                          <span className="text-[10px] font-black uppercase" style={{ color: 'var(--fg-subtle)' }}>DA</span>
                        </div>
                      </div>
                      
                      <div
                        className="absolute top-4 h-8 w-8 rounded-full flex items-center justify-center opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300"
                        style={{
                          insetInlineEnd: '1rem',
                          background: 'color-mix(in srgb, var(--surface-1) 86%, transparent)',
                          boxShadow: 'var(--shadow-control)',
                          color: 'var(--accent-strong)',
                        }}
                      >
                        <Plus className="h-4 w-4" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:sticky lg:top-4 lg:self-start lg:h-[calc(100vh-120px)] flex flex-col">
          <Card
            className={clsx(
              'p-6 flex flex-col h-full',
              'bg-[color:var(--surface-1)] shadow-[var(--shadow-surface)]'
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)', color: 'var(--on-accent)', boxShadow: 'var(--shadow-control)' }}>
                  <ShoppingCart className="h-4 w-4" />
                </div>
                <div className="text-lg font-black tracking-tight uppercase" style={{ color: 'var(--fg)' }}>Panier</div>
              </div>
              <Badge variant="gold" className="font-black">{cart.length} articles</Badge>
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2 space-y-3 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {cart.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key="empty"
                    className="py-20 text-center"
                  >
                    <div
                      className="mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3"
                      style={{ background: 'color-mix(in srgb, var(--surface-2) 85%, transparent)' }}
                    >
                      <ShoppingCart className="h-6 w-6" style={{ color: 'var(--fg-subtle)' }} />
                    </div>
                    <div className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--fg-muted)' }}>
                      Vide
                    </div>
                    <div className="mt-2 text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>
                      Ajoutez un produit depuis la liste.
                    </div>
                  </motion.div>
                ) : (
                  cart.map((l) => (
                    <motion.div
                      key={l.variantId}
                      layout
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 20 }}
                      className="lux-row group flex-col items-stretch"
                    >
                      <div
                        className="pointer-events-none absolute"
                        aria-hidden="true"
                      />
                      <div className="flex justify-between items-start">
                        <div className="min-w-0">
                          <div className="text-xs font-black uppercase tracking-tight truncate pr-4" style={{ color: 'var(--fg)' }}>{l.name}</div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-tighter" style={{ color: 'var(--fg-subtle)' }}>
                            {l.sku ?? l.barcode ?? '-'}
                          </div>
                        </div>
                        <div className="text-right font-black text-sm" style={{ color: 'var(--accent-strong)' }}>
                          {(l.unitPrice * l.quantity - l.discount).toFixed(2)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div
                          className="flex items-center gap-1 rounded-xl p-1 border"
                          style={{ background: 'color-mix(in srgb, var(--surface-2) 88%, transparent)', borderColor: 'var(--border-soft)' }}
                        >
                          <button
                            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--fg-muted)' }}
                            disabled={busy}
                            onClick={() => setCart((p) => p.map((x) => (x.variantId === l.variantId ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x)))}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <div className="min-w-6 text-center text-xs font-black" style={{ color: 'var(--fg)' }}>{l.quantity}</div>
                          <button
                            className="h-7 w-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--fg-muted)' }}
                            disabled={busy}
                            onClick={() => setCart((p) => p.map((x) => (x.variantId === l.variantId ? { ...x, quantity: x.quantity + 1 } : x)))}
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="relative group/disc">
                            <Input
                              className="w-20 h-8 [padding-inline-start:1.5rem] text-[11px] font-black rounded-xl"
                              value={String(l.discount)}
                              disabled={busy}
                              onChange={(e) => {
                                const raw = Number(e.target.value || 0);
                                const maxLineDiscount = Math.max(0, l.unitPrice * l.quantity);
                                const d = Math.max(0, Math.min(Number.isFinite(raw) ? raw : 0, maxLineDiscount));
                                setCart((p) => p.map((x) => (x.variantId === l.variantId ? { ...x, discount: d } : x)));
                              }}
                              type="number"
                            />
                            <TicketPercent
                              className="absolute top-1/2 -translate-y-1/2 h-3 w-3"
                              style={{ color: 'color-mix(in srgb, var(--accent) 35%, transparent)', insetInlineStart: '0.5rem' }}
                            />
                          </div>
                          <button
                            className="h-8 w-8 rounded-xl flex items-center justify-center transition-colors"
                            style={{ color: 'var(--fg-subtle)' }}
                            disabled={busy}
                            onClick={() => setCart((p) => p.filter((x) => x.variantId !== l.variantId))}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            <div className="mt-6 pt-6 border-t space-y-4" style={{ borderColor: 'var(--border-soft)' }}>
              <div className="space-y-3">
                <div
                  className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest"
                  style={{ color: 'var(--fg-subtle)' }}
                >
                  <Wallet className="h-3 w-3" /> Modes de Paiement
                </div>
                <div className="space-y-2">
                  {payments.map((p, idx) => (
                    <motion.div key={idx} layout className="group relative flex gap-2">
                      <Select
                        className="flex-1 h-10 text-[11px] font-black uppercase rounded-xl"
                        value={p.method}
                        disabled={busy}
                        onChange={(e) => {
                          const evt = e as unknown as ChangeEvent<HTMLSelectElement>;
                          const method = evt.target.value as 'cash' | 'cib' | 'edahabia' | 'transfer';
                          setPayments((prev) => {
                            const sumOther = prev.reduce((s, x, i) => (i === idx ? s : s + (Number.isFinite(x.amount) ? x.amount : 0)), 0);
                            const currentTotal = Number.isFinite(total) ? total : 0;
                            const remaining = Math.max(0, currentTotal - sumOther);
                            return prev.map((x, i) => (i === idx ? { ...x, method, amount: Math.min(x.amount, remaining) } : x));
                          });
                        }}
                      >
                        <option value="cash" disabled={usedPaymentMethods.has('cash') && p.method !== 'cash'}>Espèces</option>
                        <option value="edahabia" disabled={usedPaymentMethods.has('edahabia') && p.method !== 'edahabia'}>Edahabia</option>
                        <option value="cib" disabled={usedPaymentMethods.has('cib') && p.method !== 'cib'}>CIB</option>
                        <option value="transfer" disabled={usedPaymentMethods.has('transfer') && p.method !== 'transfer'}>Virement</option>
                      </Select>
                      <Input
                        className="w-32 h-10 font-black text-sm rounded-xl"
                        value={String(p.amount)}
                        disabled={busy}
                        onChange={(e) => {
                          const raw = Number(e.target.value || 0);
                          setPayments((prev) => {
                            const amount = Math.max(0, Number.isFinite(raw) ? raw : 0);
                            const sumOther = prev.reduce((s, x, i) => (i === idx ? s : s + (Number.isFinite(x.amount) ? x.amount : 0)), 0);
                            const remaining = Math.max(0, total - sumOther);
                            return prev.map((x, i) => {
                              if (i !== idx) return x;
                              const nextAmount =
                                x.method === 'cash' ? amount : Math.min(amount, remaining);
                              return { ...x, amount: nextAmount };
                            });
                          });
                        }}
                        onBlur={() => {
                          if (busy) return;
                          setPayments((prev) => {
                            if (prev.length <= 1) return prev;
                            const current = prev[idx];
                            if (!current) return prev;
                            const amt = Number.isFinite(current.amount) ? current.amount : 0;
                            if (idx > 0 && amt <= 0) {
                              const next = prev.filter((_, i) => i !== idx);
                              return next.length > 0 ? next : prev;
                            }
                            return prev;
                          });
                        }}
                        type="number"
                      />
                      {payments.length > 1 && (
                        <button
                          className="h-10 w-10 rounded-xl flex items-center justify-center transition-colors shrink-0"
                          style={{ color: 'var(--fg-subtle)' }}
                          disabled={busy}
                          onClick={() => setPayments(p => p.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                  <button
                    className="w-full py-2 border-2 border-dashed rounded-xl text-[10px] font-black transition-all uppercase tracking-widest"
                    style={{
                      borderColor: 'var(--border-soft)',
                      color: 'var(--fg-subtle)',
                      background: 'color-mix(in srgb, var(--surface-1) 60%, transparent)',
                    }}
                    disabled={busy}
                    onClick={() => setPayments((p) => [...p, { method: 'cash', amount: 0 }])}
                  >
                    + Ajouter un paiement
                  </button>
                </div>
              </div>

              {(paymentInvalid || paid + 1e-9 < total) && cart.length > 0 && (
                <div
                  className="rounded-2xl border p-4"
                  style={{
                    borderColor: paymentInvalid
                      ? 'color-mix(in srgb, var(--danger) 26%, transparent)'
                      : 'color-mix(in srgb, var(--color-secondary-500) 26%, transparent)',
                    background: paymentInvalid
                      ? 'color-mix(in srgb, var(--danger) 10%, transparent)'
                      : 'color-mix(in srgb, var(--color-secondary-500) 10%, transparent)',
                    color: paymentInvalid ? 'var(--danger)' : 'var(--color-secondary-700)',
                  }}
                >
                  <div className="text-xs font-black uppercase tracking-widest">
                    {paymentInvalid ? 'Paiement invalide' : 'Paiement insuffisant'}
                  </div>
                  <div className="mt-1 text-xs font-semibold" style={{ color: 'var(--fg)' }}>
                    {paymentInvalid
                      ? 'Vérifiez que chaque montant est un nombre positif.'
                      : `Reste à payer: ${Math.max(0, total - paid).toFixed(2)} DA`}
                  </div>
                </div>
              )}

              <div className="relative group">
                <Input
                  className="[padding-inline-start:2.5rem] h-10 text-xs font-black rounded-xl"
                  value={String(orderDiscount)}
                  disabled={busy}
                  onChange={(e) => {
                    const raw = Number(e.target.value || 0);
                    setOrderDiscount(Math.max(0, Number.isFinite(raw) ? raw : 0));
                  }}
                  type="number"
                  placeholder="Remise sur commande..."
                />
                <TicketPercent
                  className="absolute top-1/2 -translate-y-1/2 h-4 w-4 transition-colors"
                  style={{ insetInlineStart: '0.875rem' }}
                />
              </div>

              <div
                className="mt-6 rounded-[2rem] border p-5"
                style={{
                  borderColor: 'var(--border-soft)',
                  background: 'color-mix(in srgb, var(--surface-2) 82%, transparent)',
                  boxShadow: 'var(--shadow-inset)',
                }}
              >
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold uppercase" style={{ color: 'var(--fg-subtle)' }}>
                    <span>Sous-total</span>
                    <span style={{ color: 'var(--fg)' }}>{subtotal.toFixed(2)} DA</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold uppercase" style={{ color: 'color-mix(in srgb, var(--accent) 55%, transparent)' }}>
                    <span>Remise</span>
                    <span style={{ color: 'var(--accent-strong)' }}>-{safeOrderDiscount.toFixed(2)} DA</span>
                  </div>
                  <div className="h-px my-2" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }} />
                  <div className="flex justify-between items-end">
                    <span className="text-sm font-black uppercase" style={{ color: 'var(--fg)' }}>Net à payer</span>
                    <div className="text-right">
                      <span className="text-2xl font-black leading-none" style={{ color: 'var(--accent-strong)' }}>{total.toFixed(2)}</span>
                      <span className="ml-1 text-[10px] font-black uppercase" style={{ color: 'color-mix(in srgb, var(--accent) 55%, transparent)' }}>DA</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--fg-subtle)' }}>
                    Payé: {paid.toFixed(2)}
                  </div>
                  {change > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--fg-subtle)' }}>
                        Rendu:
                      </span>
                      <span className="text-sm font-black" style={{ color: 'var(--accent-strong)' }}>{change.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] font-black uppercase tracking-tighter" style={{ color: 'var(--fg-subtle)' }}>
                      
                    </div>
                  )}
                </div>
              </div>

              <Button
                variant="luxe"
                className={clsx(
                  'w-full py-5 text-sm tracking-[0.2em] font-black uppercase rounded-[1.5rem]',
                  (!canCheckout && !busy) && 'opacity-55'
                )}
                style={{ boxShadow: 'var(--shadow-control-hover)' }}
                disabled={busy || !canCheckout}
                onClick={async () => {
                  if (!canCheckout) {
                    const reason =
                      cart.length === 0
                        ? 'Ajoutez au moins un article au panier.'
                        : paymentInvalid
                          ? 'Montants de paiement invalides.'
                          : paid + 1e-9 < total
                            ? 'Paiement insuffisant.'
                            : 'Veuillez vérifier les données de vente.';
                    pushToast({ kind: 'info', title: 'Commande incomplète', message: reason, ttlMs: 3500 });
                    return;
                  }

                  setBusy(true);
                  try {
                    const res = await api.post('/api/pos/sales', {
                      customerId: customerId ?? undefined,
                      discountTotal: safeOrderDiscount,
                      items: cart.map((l) => ({
                        variantId: l.variantId,
                        quantity: l.quantity,
                        unitPrice: l.unitPrice,
                        discount: l.discount,
                      })),
                      payments: payments.map((p) => ({ ...p })),
                    });

                    void queryClient.invalidateQueries({ queryKey: ['pos-daily-summary', today] });
                    void queryClient.invalidateQueries({ queryKey: ['products'] });
                    void queryClient.invalidateQueries({ queryKey: ['inventory'] });
                    void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
                    const receiptItems = cart.map((l) => ({
                      name: l.name,
                      sku: l.sku,
                      barcode: l.barcode,
                      unitPrice: l.unitPrice,
                      quantity: l.quantity,
                      discount: l.discount,
                      total: l.unitPrice * l.quantity - l.discount,
                    }));

                    setLastReceipt({
                      orderNumber: String(res.data?.orderNumber ?? ''),
                      createdAt: Date.now(),
                      items: receiptItems,
                      subtotal: Number.isFinite(Number(res.data?.subtotal)) ? Number(res.data?.subtotal) : subtotal,
                      discountTotal: safeOrderDiscount,
                      total: Number.isFinite(Number(res.data?.total)) ? Number(res.data?.total) : total,
                      payments: payments.map((p) => ({ ...p })),
                      paidTotal: Number.isFinite(Number(res.data?.paidTotal)) ? Number(res.data?.paidTotal) : paid,
                      changeDue: Number.isFinite(Number(res.data?.changeDue)) ? Number(res.data?.changeDue) : change,
                    });
                    setReceiptOpen(true);

                    pushToast({
                      kind: 'success',
                      title: 'Vente validée',
                      message:
                        res.data?.loyalty && typeof res.data.loyalty.pointsEarned === 'number'
                          ? `Commande ${String(res.data?.orderNumber ?? '')} • +${Number(res.data.loyalty.pointsEarned)} pts`
                          : `Commande ${String(res.data?.orderNumber ?? '')}`,
                      actionLabel: 'Imprimer',
                      onAction: () => {
                        setReceiptOpen(true);
                        window.setTimeout(() => void printReceipt(), 50);
                      },
                      ttlMs: 5000,
                    });
                    resetSale();
                  } catch (e: unknown) {
                    const maybeErr = e as { response?: { data?: { detail?: unknown } } };
                    const detail = String(maybeErr?.response?.data?.detail ?? '');
                    const msg = detail.includes('insufficient_payment')
                      ? 'Paiement insuffisant.'
                      : detail.includes('insufficient_stock')
                        ? 'Stock insuffisant pour un article.'
                        : detail.includes('variant_not_found')
                          ? 'Article introuvable ou inactif.'
                        : 'Une erreur est survenue lors de la validation.';

                    pushToast({ kind: 'error', title: 'Erreur', message: msg, ttlMs: 5000 });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <span className="inline-flex items-center justify-center gap-3">
                  {busy && (
                    <Skeleton className="h-4 w-4 rounded-full" radius="3xl" />
                  )}
                  {busy ? 'Validation…' : 'Valider la commande'}
                </span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
