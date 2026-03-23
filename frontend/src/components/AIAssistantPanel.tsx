import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, 
  ShoppingCart, DollarSign, Brain, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

export function AIAssistantPanel() {
  const { data: restock } = useQuery({
    queryKey: ['ai-restock'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get('/api/analytics/products/restock-recommendations');
      return res.data as { items: any[] };
    }
  });

  const { data: lowStock } = useQuery({
    queryKey: ['ai-low-stock'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get('/api/analytics/products/low-stock-prediction');
      return res.data as { items: any[] };
    }
  });

  const { data: profit } = useQuery({
    queryKey: ['ai-profit'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get('/api/analytics/products/profit-analysis');
      return res.data as { top_profitable: any[]; low_profitable: any[] };
    }
  });

  const { data: trends } = useQuery({
    queryKey: ['ai-trends'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get('/api/analytics/sales/trends');
      return res.data as { trend: string; change: number };
    }
  });

  const { data: forecast } = useQuery({
    queryKey: ['ai-forecast'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = await api.get('/api/analytics/sales/forecast');
      return res.data as { forecast: number; avg_growth: number; confidence: string };
    }
  });

  const highPriorityRestock = restock?.items?.filter(i => i.priority === 'high') || [];
  const criticalStock = lowStock?.items?.filter(i => i.urgency === 'critical') || [];

  const headerIconStyle: CSSProperties = {
    background: 'var(--gradient-primary)',
    boxShadow: 'var(--shadow-control)',
  };

  const headerIconFgStyle: CSSProperties = { color: 'var(--on-accent)' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={headerIconStyle}>
          <Brain className="h-5 w-5" style={headerIconFgStyle} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Assistant Intelligent</h2>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Analyses et recommandations IA</p>
        </div>
      </div>

      <div className="grid gap-4">
        {trends && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl border"
            style={{
              background:
                trends.trend === 'increasing'
                  ? 'color-mix(in srgb, var(--success) 10%, transparent)'
                  : trends.trend === 'decreasing'
                    ? 'color-mix(in srgb, var(--danger) 10%, transparent)'
                    : 'color-mix(in srgb, var(--surface-1) 78%, transparent)',
              borderColor:
                trends.trend === 'increasing'
                  ? 'color-mix(in srgb, var(--success) 22%, transparent)'
                  : trends.trend === 'decreasing'
                    ? 'color-mix(in srgb, var(--danger) 22%, transparent)'
                    : 'var(--border-soft)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {trends.trend === 'increasing' ? (
                  <TrendingUp className="h-5 w-5" style={{ color: 'var(--success)' }} />
                ) : trends.trend === 'decreasing' ? (
                  <TrendingDown className="h-5 w-5" style={{ color: 'var(--danger)' }} />
                ) : (
                  <TrendingUp className="h-5 w-5" style={{ color: 'var(--fg-subtle)' }} />
                )}
                <div>
                  <p className="font-medium" style={{ color: 'var(--fg)' }}>Tendance des ventes</p>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                    {trends.trend === 'increasing' ? 'En hausse' : 
                     trends.trend === 'decreasing' ? 'En baisse' : 'Stable'}
                  </p>
                </div>
              </div>
              <div
                className="text-2xl font-bold"
                style={{
                  color:
                    trends.change > 0
                      ? 'var(--success)'
                      : trends.change < 0
                        ? 'var(--danger)'
                        : 'var(--fg-subtle)',
                }}
              >
                {trends.change > 0 ? '+' : ''}{trends.change}%
              </div>
            </div>
          </motion.div>
        )}

        {forecast?.forecast && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-4 rounded-2xl border"
            style={{
              background:
                'linear-gradient(90deg, color-mix(in srgb, var(--accent) 10%, transparent), color-mix(in srgb, var(--accent) 6%, transparent))',
              borderColor: 'color-mix(in srgb, var(--accent) 22%, transparent)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="h-5 w-5" style={{ color: 'var(--accent-strong)' }} />
                <div>
                  <p className="font-medium" style={{ color: 'var(--fg)' }}>Prévision des ventes</p>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Mois prochain (estimé)</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: 'var(--accent-strong)' }}>
                  {forecast.forecast.toLocaleString()} DA
                </p>
                <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
                  Confiance: {forecast.confidence}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {criticalStock.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-2xl border"
            style={{
              background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--danger) 22%, transparent)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--danger)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>Stock critique - Risque de rupture</h3>
            </div>
            <div className="space-y-2">
              {criticalStock.slice(0, 3).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg p-2"
                  style={{ background: 'color-mix(in srgb, var(--surface-1) 60%, transparent)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{item.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                    {item.days_remaining} jours restants
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {highPriorityRestock.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="p-4 rounded-2xl border"
            style={{
              background: 'color-mix(in srgb, var(--color-secondary-500) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-secondary-500) 22%, transparent)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-5 w-5" style={{ color: 'var(--color-secondary-500)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>Recommandations de réapprovisionnement</h3>
            </div>
            <div className="space-y-2">
              {highPriorityRestock.slice(0, 3).map((item: any) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between rounded-lg p-2"
                  style={{ background: 'color-mix(in srgb, var(--surface-1) 60%, transparent)' }}
                >
                  <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{item.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--color-secondary-500)' }}>
                    +{item.recommended_restock} unités
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {profit?.top_profitable && profit.top_profitable.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="p-4 rounded-2xl border"
            style={{
              background: 'color-mix(in srgb, var(--success) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--success) 22%, transparent)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpRight className="h-5 w-5" style={{ color: 'var(--success)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>Produits les plus rentables</h3>
            </div>
            <div className="space-y-2">
              {profit.top_profitable.slice(0, 3).map((item: any, i: number) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--surface-1) 60%, transparent)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: 'var(--success)' }}>#{i + 1}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{item.name}</span>
                  </div>
                  <span className="text-xs font-medium" style={{ color: 'var(--success)' }}>
                    +{item.profit.toLocaleString()} DA
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {profit?.low_profitable && profit.low_profitable.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-4 rounded-2xl border"
            style={{
              background: 'color-mix(in srgb, var(--warning) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--warning) 22%, transparent)',
              boxShadow: 'var(--shadow-control)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <ArrowDownRight className="h-5 w-5" style={{ color: 'var(--warning)' }} />
              <h3 className="font-semibold" style={{ color: 'var(--fg)' }}>Produits à faible marge</h3>
            </div>
            <div className="space-y-2">
              {profit.low_profitable.slice(0, 3).map((item: any) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg p-2" style={{ background: 'color-mix(in srgb, var(--surface-1) 60%, transparent)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{item.name}</span>
                  <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>
                    {item.margin}% marge
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {(!restock?.items?.length && !lowStock?.items?.length && !profit?.top_profitable?.length) && (
          <div className="p-8 text-center" style={{ color: 'var(--fg-muted)' }}>
            <Brain className="h-12 w-12 mx-auto mb-3" style={{ color: 'color-mix(in srgb, var(--fg-subtle) 65%, transparent)' }} />
            <p>Pas assez de données pour générer des recommandations.</p>
            <p className="text-sm">Commencez à enregistrer des ventes pour voir l'analyse.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AIAssistantPanel;
