import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { pushToast } from '../lib/toast';
import { Badge } from '../components/ui/Badge';
import { AnimatedModal } from '../components/ui/AnimatedModal';
import { Search, Plus, Package, AlertTriangle, Sparkles, Tag, Palette, Ruler, Barcode } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
};

type Variant = {
  id: string;
  size: string | null;
  color: string | null;
  barcode: string | null;
  sku: string | null;
  sale_price: number;
  quantity: number;
  low_stock_threshold: number;
};

type LowStockItem = {
  variantId: string;
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  low_stock_threshold: number;
};

export function InventoryPage() {
  const me = useAuth((s) => s.user);
  const canMutate = me?.role === 'admin';
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q.trim()), 280);
    return () => window.clearTimeout(t);
  }, [q]);
  const [name, setName] = useState('');
  const [salePrice, setSalePrice] = useState('0');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const [vSize, setVSize] = useState('');
  const [vColor, setVColor] = useState('');
  const [vBarcode, setVBarcode] = useState('');
  const [vSku, setVSku] = useState('');
  const [vQty, setVQty] = useState('0');
  const [vLow, setVLow] = useState('2');

  const list = useQuery({
    queryKey: ['inventory', qDebounced],
    queryFn: async () => {
      const res = await api.get('/api/products/catalog', { params: { q: qDebounced, limit: 50 } });
      return res.data.items as Product[];
    },
  });

  const variants = useQuery({
    queryKey: ['variants', selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const res = await api.get(`/api/variants/product/${selected!.id}`);
      return res.data.items as Variant[];
    },
  });

  const lowStock = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => {
      const res = await api.get('/api/variants/low-stock', { params: { limit: 10 } });
      return res.data.items as LowStockItem[];
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
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
              className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_12%,transparent)] shadow-glass"
            >
              <Package className="h-7 w-7" style={{ color: 'var(--on-accent)' }} />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-[color:var(--accent-strong)]">
                <Sparkles className="h-3 w-3" />
                Stock
              </div>
              <div className="mt-0.5 text-2xl font-extrabold tracking-tight text-[color:var(--fg)]">Gestion des produits</div>
              <div className="mt-1 text-sm text-[color:var(--fg-subtle)]">
                Catalogue premium, variantes et alertes intelligentes
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap items-center gap-2"
          >
            <Badge variant="rose">{list.data?.length ?? 0} Produits</Badge>
            <Badge variant="gold">{(lowStock.data ?? []).length} Alertes</Badge>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="lg:col-span-2"
        >
          <div className="relative overflow-hidden rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-glass backdrop-blur-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(900px_650px_at_20%_40%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_55%),radial-gradient(700px_520px_at_80%_60%,color-mix(in_srgb,var(--color-secondary-500)_8%,transparent),transparent_60%)]" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--fg-muted)]"
                    style={{ insetInlineStart: '1rem' }}
                  />
                  <Input 
                    value={q} 
                    onChange={(e) => setQ(e.target.value)} 
                    placeholder="Rechercher par nom, SKU ou code-barres..."
                    className="[padding-inline-start:2.75rem]"
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
                {list.isLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="lux-row flex-col items-stretch">
                        <div className="space-y-3 w-full">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                          <div className="flex items-center justify-between">
                            <Skeleton className="h-8 w-24" />
                            <Skeleton className="h-5 w-5 rounded-full" radius="2xl" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {(list.data ?? []).map((p, i) => {
                      const isSelected = selected?.id === p.id;
                      return (
                        <motion.button
                          key={p.id}
                          layout
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ delay: i * 0.03, duration: 0.3 }}
                          whileHover={{ y: -4, scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setSelected(p)}
                          className={`
                            lux-row group relative overflow-hidden text-left transition-all duration-300
                            ${isSelected
                              ? 'border-[color:color-mix(in_srgb,var(--accent)_32%,transparent)] ring-1 ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)]'
                              : 'border-[color:var(--glass-border)]'
                            }
                          `}
                        >
                          <div
                            className={`absolute inset-0 bg-[radial-gradient(900px_300px_at_20%_10%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_55%),radial-gradient(900px_300px_at_90%_0%,color-mix(in_srgb,var(--color-secondary-500)_8%,transparent),transparent_55%)] opacity-0 transition-opacity group-hover:opacity-100`}
                          />
                          
                          <div className="relative z-10">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-bold text-[color:var(--fg)] line-clamp-2 leading-tight">{p.name}</div>
                                <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--fg-subtle)]">
                                  <Tag className="h-3 w-3" />
                                  {p.sku ?? p.barcode ?? 'Aucun SKU'}
                                </div>
                              </div>
                              <div
                                className={`flex h-9 items-center justify-center rounded-xl px-3 text-sm font-bold border ${
                                  isSelected
                                    ? 'border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] text-[color:var(--on-accent)] shadow-glass'
                                    : 'border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)] text-[color:var(--fg-muted)]'
                                }`}
                                style={isSelected ? { background: 'var(--gradient-primary)' } : undefined}
                              >
                                {p.sale_price.toFixed(0)} DA
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <div className="text-xs text-[color:var(--fg-muted)]">Sélection</div>
                              <motion.div 
                                animate={{ scale: isSelected ? 1 : 0.8, opacity: isSelected ? 1 : 0 }}
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs border ${
                                  isSelected
                                    ? 'border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] text-[color:var(--on-accent)]'
                                    : 'border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--surface-1)_70%,transparent)]'
                                }`}
                                style={isSelected ? { background: 'var(--gradient-primary)' } : undefined}
                              >
                                {isSelected && '✓'}
                              </motion.div>
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-glass backdrop-blur-2xl">
              <div className="absolute top-0 h-20 w-20 rounded-full bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] blur-2xl" style={{ insetInlineEnd: 0 }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[color:var(--accent-strong)]" />
                  <div className="text-sm font-extrabold text-[color:var(--fg)]">Stock faible</div>
                </div>
                <div className="mt-4 space-y-3">
                  {lowStock.isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="lux-row-cell">
                          <div className="space-y-2">
                            <Skeleton className="h-3 w-4/5" />
                            <Skeleton className="h-3 w-2/5" />
                            <div className="flex items-center justify-between">
                              <Skeleton className="h-3 w-16" />
                              <Skeleton className="h-4 w-20" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {(lowStock.data ?? []).map((x) => (
                    <motion.div
                      key={x.variantId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border border-[color:color-mix(in_srgb,var(--accent-strong)_26%,transparent)] bg-[color:color-mix(in_srgb,var(--accent-strong)_10%,transparent)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-[color:var(--fg)] line-clamp-1">{x.name}</div>
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[color:var(--fg-subtle)]">
                            {[x.size, x.color].filter(Boolean).join(' / ')}
                          </div>
                        </div>
                        <Badge variant="gold">Alerte</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] text-[color:var(--fg-subtle)]">Qté / Seuil</span>
                        <span className="text-xs font-bold text-[color:var(--accent-strong)]">
                          {x.quantity} / {x.low_stock_threshold}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  {(lowStock.data ?? []).length === 0 && (
                    <div className="text-center text-xs text-[color:var(--fg-muted)] py-4">
                      Aucune alerte de stock
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            <div className="relative overflow-hidden rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-5 shadow-glass backdrop-blur-2xl">
              <div className="absolute top-0 h-20 w-20 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] blur-2xl" style={{ insetInlineEnd: 0 }} />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-[color:var(--accent-strong)]" />
                  <div className="text-sm font-extrabold text-[color:var(--fg)]">Nouveau produit</div>
                </div>
                <div className="mt-4 space-y-3">
                  <Input 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Nom du produit"
                    className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))]"
                  />
                  <Input 
                    value={salePrice} 
                    onChange={(e) => setSalePrice(e.target.value)} 
                    placeholder="Prix de vente (DA)"
                    type="number"
                    className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))]"
                  />
                  <Button
                    className="w-full"
                    disabled={!canMutate || busy || !name.trim()}
                    onClick={async () => {
                      if (!canMutate) return;
                      setBusy(true);
                      try {
                        await api.post('/api/products', {
                          name,
                          salePrice: Number(salePrice || 0),
                          costPrice: 0,
                          active: true,
                          variants: [],
                        });
                        setName('');
                        setSalePrice('0');
                        await list.refetch();
                        pushToast({ kind: 'success', title: 'Produit créé', message: name });
                      } catch (e: any) {
                        pushToast({ kind: 'error', title: 'Erreur de création', message: String(e?.response?.data?.detail ?? e?.message ?? 'Erreur') });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? 'Création...' : 'Créer le produit'}
                  </Button>
                  {!canMutate && (
                    <div className="text-xs text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatedModal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected ? (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--accent-strong)]">
                <Palette className="h-3 w-3" />
                Variantes
              </div>
              <div className="mt-1 text-xl font-extrabold text-[color:var(--fg)]">{selected.name}</div>
            </div>
          ) : null
        }
        description={
          selected ? (
            <div className="text-xs text-[color:var(--fg-subtle)]">
              {(variants.data ?? []).length} variante(s) • Prix: {selected.sale_price.toFixed(0)} DA
            </div>
          ) : null
        }
        maxWidthClassName="max-w-5xl"
      >
        {selected && (
          <>
            <div className="mb-4 flex items-center justify-end">
              <Badge variant="rose">Édition</Badge>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(variants.data ?? []).map((v, i) => (
                    <motion.div
                      key={v.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ y: -2 }}
                      className="lux-row group relative flex-col items-stretch overflow-hidden"
                    >
                      <div className="absolute top-0 h-16 w-16 rounded-full bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] opacity-0 transition-opacity group-hover:opacity-100" style={{ insetInlineEnd: 0 }} />

                      <div className="relative z-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] shadow-glass" style={{ background: 'var(--gradient-primary)' }}>
                              <Ruler className="h-4 w-4" style={{ color: 'var(--on-accent)' }} />
                            </div>
                            <div className="text-sm font-bold text-[color:var(--fg)]">
                              {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'}
                            </div>
                          </div>
                          <Badge variant={v.quantity <= v.low_stock_threshold ? 'gold' : 'neutral'}>
                            {v.quantity} unités
                          </Badge>
                        </div>

                        <div className="mt-2 flex items-center gap-2 text-xs text-[color:var(--fg-subtle)]">
                          <Barcode className="h-3 w-3" />
                          {v.sku ?? v.barcode ?? 'Aucun code'}
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1">
                            <Input
                              defaultValue={String(v.quantity)}
                              type="number"
                              className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs"
                              disabled={!canMutate}
                              onBlur={async (e) => {
                                if (!canMutate) return;
                                const quantity = Number(e.target.value || 0);
                                try {
                                  await api.patch(`/api/variants/${v.id}/inventory`, { quantity, lowStockThreshold: v.low_stock_threshold });
                                  await variants.refetch();
                                  await lowStock.refetch();
                                } catch {
                                  pushToast({ kind: 'error', title: 'Erreur mise à jour stock' });
                                }
                              }}
                            />
                          </div>
                          <div className="flex-1">
                            <Input
                              defaultValue={String(v.low_stock_threshold)}
                              type="number"
                              className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs"
                              disabled={!canMutate}
                              onBlur={async (e) => {
                                if (!canMutate) return;
                                const lowStockThreshold = Number(e.target.value || 0);
                                try {
                                  await api.patch(`/api/variants/${v.id}/inventory`, { quantity: v.quantity, lowStockThreshold });
                                  await variants.refetch();
                                  await lowStock.refetch();
                                } catch {
                                  pushToast({ kind: 'error', title: 'Erreur mise à jour seuil' });
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-[color:var(--fg-muted)]">Qté / Seuil</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="lux-row relative flex-col items-stretch overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(900px_300px_at_20%_10%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_55%),radial-gradient(900px_300px_at_90%_0%,color-mix(in_srgb,var(--color-secondary-500)_8%,transparent),transparent_55%)]" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--fg)]">
                      <Plus className="h-4 w-4 text-[color:var(--accent-strong)]" />
                      Nouvelle variante
                    </div>
                    <div className="mt-4 space-y-3">
                      <Input value={vSize} onChange={(e) => setVSize(e.target.value)} placeholder="Taille (S/M/L)" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                      <Input value={vColor} onChange={(e) => setVColor(e.target.value)} placeholder="Couleur" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                      <Input value={vSku} onChange={(e) => setVSku(e.target.value)} placeholder="SKU" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                      <Input value={vBarcode} onChange={(e) => setVBarcode(e.target.value)} placeholder="Code-barres" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                      <div className="grid grid-cols-2 gap-2">
                        <Input value={vQty} onChange={(e) => setVQty(e.target.value)} placeholder="Quantité" type="number" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                        <Input value={vLow} onChange={(e) => setVLow(e.target.value)} placeholder="Seuil" type="number" className="bg-[color:color-mix(in_srgb,var(--surface-1)_82%,var(--surface-1))] text-xs" />
                      </div>
                      <Button
                        className="w-full"
                        style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-control)' }}
                        disabled={!canMutate}
                        onClick={async () => {
                          if (!canMutate) return;
                          try {
                            await api.post('/api/variants', {
                              productId: selected.id,
                              size: vSize || undefined,
                              color: vColor || undefined,
                              sku: vSku || undefined,
                              barcode: vBarcode || undefined,
                              quantity: Number(vQty || 0),
                              lowStockThreshold: Number(vLow || 2),
                            });
                            setVSize('');
                            setVColor('');
                            setVSku('');
                            setVBarcode('');
                            setVQty('0');
                            setVLow('2');
                            await variants.refetch();
                            await lowStock.refetch();
                            pushToast({ kind: 'success', title: 'Variante ajoutée' });
                          } catch (e: any) {
                            pushToast({ kind: 'error', title: 'Erreur', message: String(e?.response?.data?.detail ?? e?.message ?? 'Erreur') });
                          }
                        }}
                      >
                        Ajouter
                      </Button>
                      {!canMutate && (
                        <div className="text-xs text-[color:var(--fg-muted)]">Accès réservé aux administrateurs.</div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        )}
      </AnimatedModal>
    </motion.div>
  );
}
