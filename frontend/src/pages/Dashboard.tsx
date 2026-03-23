import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { TrendingUp, ShoppingBag, ArrowUpRight, DollarSign, Activity } from 'lucide-react';
import { BRAND_LOGO_FALLBACK_SRC, BRAND_LOGO_SRC } from '../brand';
import { AIAssistantPanel } from '../components/AIAssistantPanel';
import { SafeResponsiveContainer } from '../components/charts/SafeResponsiveContainer';
import { GOLDEN_EASE, MOTION_BASE, MOTION_HOVER, MOTION_MED, MOTION_PAGE, MOTION_SLOW } from '../motion';
import './Dashboard.css';

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: MOTION_MED, ease: GOLDEN_EASE }}
      className="tabular-nums"
    >
      {value.toFixed(2)}
    </motion.span>
  );
}

const statCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: MOTION_SLOW, ease: GOLDEN_EASE }
  })
};

export function DashboardPage() {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';

  const summary = useQuery({
    queryKey: ['daily-summary'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/sales/daily');
      return res.data as { date: string; ordersCount: number; salesTotal: number; profitTotal: number };
    },
    staleTime: 60_000, // daily summary — refresh every 60 s max
  });

  const monthly = useQuery({
    queryKey: ['sales-monthly'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/sales/monthly');
      return res.data as { month: string; items: { day: string; total: number }[] };
    },
    staleTime: 5 * 60_000, // monthly chart — refresh every 5 min
  });

  const best = useQuery({
    queryKey: ['best-sellers'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/products/best-sellers', { params: { limit: 5 } });
      return res.data as { sinceDays: number; items: { name: string; qty: number; total: number }[] };
    },
    staleTime: 5 * 60_000,
  });

  const inventoryValue = useQuery({
    queryKey: ['inventory-value'],
    queryFn: async () => {
      const res = await api.get('/api/analytics/inventory/value');
      return res.data as { retailValue: number; costValue: number };
    },
    staleTime: 2 * 60_000,
  });

  const summaryReady = summary.isSuccess && Boolean(summary.data);
  const monthlyReady = monthly.isSuccess && Boolean(monthly.data);
  const inventoryReady = inventoryValue.isSuccess && Boolean(inventoryValue.data);
  const bestReady = best.isSuccess && Boolean(best.data);

  const chart = (monthly.data?.items ?? []).map((x) => ({ name: x.day.slice(8), value: x.total }));

  function formatDA(v: number) {
    return `${v.toFixed(2)} DA`;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: MOTION_SLOW, ease: GOLDEN_EASE }}
      className="space-y-5"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: MOTION_SLOW, ease: GOLDEN_EASE }}
        className="dashboard-header lux-page-hero"
      >
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between w-full">
          <div className="flex items-center gap-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
              className="dashboard-logo-container"
            >
              <img
                src={BRAND_LOGO_SRC}
                alt="La Vie En Rose 34"
                className="dashboard-logo-img"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src.endsWith(BRAND_LOGO_FALLBACK_SRC)) return;
                  img.src = BRAND_LOGO_FALLBACK_SRC;
                }}
              />
            </motion.div>
            <div>
              <div className="dashboard-header-badge">
                <Activity className="h-3 w-3" />
                Tableau de bord
              </div>
              <div className="dashboard-title">Aperçu de la boutique</div>
              <div className="dashboard-subtitle">
                Indicateurs premium pour <span className="brand-highlight">La Vie En Rose 34</span>
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: MOTION_BASE, ease: GOLDEN_EASE }}
            className="dashboard-header-actions"
          >
            <Badge variant="rose">Aujourd'hui</Badge>
            <Badge variant="gold">Alger • DZ</Badge>
          </motion.div>
        </div>
      </motion.div>

      <div className="stats-grid">
        {[
          { title: 'Ventes du jour', value: summary.data?.salesTotal ?? 0, icon: TrendingUp },
          { title: 'Commandes', value: summary.data?.ordersCount ?? 0, icon: ShoppingBag, isCount: true },
          { title: 'Profit', value: summary.data?.profitTotal ?? 0, icon: DollarSign },
        ].map((stat, i) => (
          <motion.div
            key={stat.title}
            custom={i}
            variants={statCardVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              whileHover={{ y: -4, scale: 1.01 }}
              transition={{ duration: MOTION_HOVER, ease: GOLDEN_EASE }}
              className="stat-card"
            >
              <div className="stat-card-header">
                <div>
                  <div className="stat-label">{stat.title}</div>
                  <div className="stat-value">
                    {summary.isLoading ? (
                      <div className="inline-flex items-center gap-2">
                        <Skeleton className="h-7 w-28" radius="xl" />
                        <Skeleton className="h-4 w-10" radius="xl" />
                      </div>
                    ) : summary.isError || !summaryReady ? (
                      <span className="text-[color:var(--fg-subtle)]">—</span>
                    ) : stat.isCount ? (
                      <motion.span
                        key={stat.value}
                        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                        transition={{ duration: MOTION_HOVER, ease: GOLDEN_EASE }}
                      >
                        {stat.value}
                      </motion.span>
                    ) : (
                      <>
                        <AnimatedNumber value={stat.value} />
                        <span className="stat-value-currency">DA</span>
                      </>
                    )}
                  </div>
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1, duration: MOTION_BASE, ease: GOLDEN_EASE }}
                    className="stat-change"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    En temps réel
                  </motion.div>
                </div>
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="stat-icon"
                >
                  <stat.icon className="h-5 w-5" style={{ color: 'var(--on-accent)' }} />
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
          className="lg:col-span-2"
        >
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Ventes mensuelles</div>
                <div className="chart-subtitle">Performance jour par jour</div>
              </div>
              <Badge variant="rose">{monthly.data?.month ?? '—'}</Badge>
            </div>

            <div className="mt-6 h-[300px] min-h-[300px]">
              {monthly.isLoading ? (
                <div className="h-full w-full rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 shadow-glass">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-40" radius="xl" />
                      <Skeleton className="h-4 w-20" radius="xl" />
                    </div>
                    <Skeleton className="h-[220px] w-full" radius="3xl" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-24" radius="xl" />
                      <Skeleton className="h-3 w-24" radius="xl" />
                    </div>
                  </div>
                </div>
              ) : monthly.isError || !monthlyReady || chart.length === 0 ? (
                <div className="h-full w-full rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 text-center shadow-glass">
                  <div className="text-sm font-semibold text-[color:var(--fg)]">Aucune donnée</div>
                  <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">Les ventes mensuelles apparaîtront ici.</div>
                </div>
              ) : (
                <SafeResponsiveContainer minWidth={40} minHeight={40}>
                  {({ width, height }) => (
                    <AreaChart
                      width={width}
                      height={height}
                      data={chart}
                      margin={{ top: 10, left: isArabic ? 10 : 0, right: isArabic ? 0 : 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                        dy={10}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={40}
                        tick={{ fill: 'var(--fg-subtle)', fontSize: 11 }}
                        orientation={isArabic ? 'right' : 'left'}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 16,
                          border: '1px solid var(--border-soft)',
                          background: 'var(--bg-elevated)',
                          boxShadow: 'var(--shadow-xl)',
                        }}
                        labelStyle={{ color: 'var(--text-secondary)', fontSize: 12 }}
                        itemStyle={{ color: 'var(--accent)', fontWeight: 700 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        strokeWidth={3}
                        fill="url(#colorValue)"
                        dot={false}
                        activeDot={{
                          r: 6,
                          fill: 'var(--accent)',
                          stroke: 'color-mix(in srgb, var(--fg) 12%, transparent)',
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  )}
                </SafeResponsiveContainer>
              )}
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
          >
            <div className="inventory-card">
              <div className="relative z-10">
                <div className="chart-title">Valeur du stock</div>
                <div className="mt-4">
                  <div className="inventory-value">
                    <span className="inventory-label">Prix de vente</span>
                    <span className="inventory-amount">
                      {inventoryValue.isLoading
                        ? '—'
                        : inventoryValue.isError || !inventoryReady
                          ? '—'
                          : formatDA(inventoryValue.data?.retailValue ?? 0)}
                    </span>
                  </div>
                  <div className="inventory-progress">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '75%' }}
                      transition={{ delay: 0.7, duration: MOTION_PAGE, ease: GOLDEN_EASE }}
                      className="inventory-progress-bar" 
                    />
                  </div>
                  <div className="inventory-value" style={{ marginTop: '12px' }}>
                    <span className="inventory-label">Coût</span>
                    <span className="inventory-amount">
                      {inventoryValue.isLoading
                        ? '—'
                        : inventoryValue.isError || !inventoryReady
                          ? '—'
                          : formatDA(inventoryValue.data?.costValue ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
          >
            <div className="alert-card">
              <div className="alert-card-header">
                <div className="chart-title" style={{ margin: 0 }}>Alertes stock</div>
                <span className="alert-badge">Priorité</span>
              </div>
              <div className="alert-content">
                <div className="alert-title">Conseil du jour</div>
                <div className="alert-description">Vérifiez le stock chaque matin</div>
                <div className="alert-description" style={{ fontSize: '10px', marginTop: '4px' }}>Ajustez les seuils pour vos best-sellers</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
        className="chart-card"
      >
        <div className="chart-header">
          <div>
            <div className="chart-title">Best-sellers</div>
            <div className="chart-subtitle">Produits les plus vendus</div>
          </div>
          <Badge variant="rose">Top 5</Badge>
        </div>

        <div className="best-sellers-grid" style={{ marginTop: '24px' }}>
          {best.isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="lux-row flex-col items-stretch">
                  <div className="flex items-start justify-between gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" radius="3xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-4/5" radius="xl" />
                      <Skeleton className="h-3 w-2/5" radius="xl" />
                    </div>
                    <Skeleton className="h-6 w-16" radius="xl" />
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Skeleton className="h-3 w-20" radius="xl" />
                    <Skeleton className="h-4 w-24" radius="xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : best.isError || !bestReady || (best.data?.items ?? []).length === 0 ? (
            <div className="rounded-3xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-6 text-center shadow-glass">
              <div className="text-sm font-semibold text-[color:var(--fg)]">Aucun best-seller</div>
              <div className="mt-1 text-xs text-[color:var(--fg-subtle)]">Les produits les plus vendus apparaîtront ici.</div>
            </div>
          ) : (
            (best.data?.items ?? []).map((p, i) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.1, duration: MOTION_MED, ease: GOLDEN_EASE }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="best-seller-card"
              >
                <div className="relative z-10">
                  <div className="best-seller-rank">
                    <span>{i + 1}</span>
                  </div>
                  <div className="best-seller-name">{p.name}</div>
                  <div className="best-seller-meta">
                    <div className="best-seller-qty">
                      <strong>{p.qty}</strong> unités
                    </div>
                    <div className="best-seller-total">{p.total.toFixed(0)} DA</div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: MOTION_SLOW, ease: GOLDEN_EASE }}
        className="chart-card"
      >
        <AIAssistantPanel />
      </motion.div>
    </motion.div>
  );
}
