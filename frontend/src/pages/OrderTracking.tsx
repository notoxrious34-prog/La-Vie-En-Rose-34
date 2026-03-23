import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { Package, CheckCircle, Clock, Truck, ShoppingBag, Calendar } from 'lucide-react';
import { Skeleton } from '../components/ui/Skeleton';
import { Card } from '../components/ui/Card';

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  pending: {
    label: 'En attente',
    color: 'border-[color:var(--border-soft)] bg-[color:var(--glass-bg)] text-[color:var(--fg-muted)]',
    icon: Clock,
  },
  in_progress: {
    label: 'En cours',
    color: 'border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[color:var(--accent-strong)]',
    icon: Package,
  },
  processing: {
    label: 'En cours',
    color: 'border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] text-[color:var(--accent-strong)]',
    icon: Package,
  },
  ready: {
    label: 'Prêt',
    color: 'border-[color:color-mix(in_srgb,var(--color-secondary-500)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--color-secondary-500)_10%,transparent)] text-[color:var(--color-secondary-700)]',
    icon: Truck,
  },
  delivered: {
    label: 'Livré',
    color: 'border-[color:color-mix(in_srgb,var(--success)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success)]',
    icon: CheckCircle,
  },
  completed: {
    label: 'Livré',
    color: 'border-[color:color-mix(in_srgb,var(--success)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--success)_10%,transparent)] text-[color:var(--success)]',
    icon: CheckCircle,
  },
};

export function OrderTrackingPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchOrder() {
      try {
        const res = await api.get(`/api/public/orders/${orderNumber}`);
        setOrder(res.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    if (orderNumber) fetchOrder();
  }, [orderNumber]);

  if (loading) return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full" radius="3xl" />
        <Skeleton className="h-3 w-44" radius="xl" />
      </div>
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-[color:var(--bg)] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 text-center">
          <div className="w-16 h-16 border border-[color:color-mix(in_srgb,var(--danger)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-[color:var(--danger)]" />
          </div>
          <h1 className="text-2xl font-bold text-[color:var(--fg)] mb-2">Commande non trouvée</h1>
          <p className="text-[color:var(--fg-subtle)]">Le numéro de commande "{orderNumber}" n'existe pas.</p>
        </Card>
      </motion.div>
    </div>
  );

  const status = statusConfig[order.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-[color:var(--bg)] py-8 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto"
      >
        <Card className="overflow-hidden p-0 lux-page-hero">
          <div className="p-6 bg-[color:var(--accent)] text-[color:var(--on-accent)]" style={{ background: 'var(--gradient-primary)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--on-accent) 80%, transparent)' }}>Commande</p>
                <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              </div>
              <div className={`px-4 py-2 rounded-full border ${status.color} flex items-center gap-2`}>
                <StatusIcon className="h-4 w-4" />
                <span className="font-medium text-sm">{status.label}</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <Card className="p-4">
              <div className="h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg" style={{ background: 'var(--gradient-primary)', color: 'var(--on-accent)' }}>
                {order.customerName?.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium text-[color:var(--fg)]">{order.customerName || 'Client'}</p>
                <p className="text-sm text-[color:var(--fg-subtle)]">{order.customerPhone || ''}</p>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <Calendar className="h-5 w-5 text-[color:var(--accent-strong)] mb-2" />
                <p className="text-xs text-[color:var(--fg-subtle)]">Date de commande</p>
                <p className="font-medium text-[color:var(--fg)]">
                  {new Date(order.createdAt).toLocaleDateString('fr-FR', { 
                    day: 'numeric', month: 'long', year: 'numeric' 
                  })}
                </p>
              </Card>
              <Card className="p-4">
                <ShoppingBag className="h-5 w-5 text-[color:var(--accent-strong)] mb-2" />
                <p className="text-xs text-[color:var(--fg-subtle)]">Total</p>
                <p className="font-bold text-[color:var(--accent-strong)] text-lg">
                  {Number(order.total ?? 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                </p>
              </Card>
            </div>

            <div>
              <h3 className="font-semibold text-[color:var(--fg)] mb-3">Produits commandés</h3>
              <div className="space-y-2">
                {order.items?.map((item: any, i: number) => (
                  <Card key={i} className="p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 border border-[color:color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color:color-mix(in_srgb,var(--accent)_10%,transparent)] rounded-lg flex items-center justify-center">
                        <Package className="h-5 w-5 text-[color:var(--accent-strong)]" />
                      </div>
                      <div>
                        <p className="font-medium text-[color:var(--fg)]">{item.name}</p>
                        <p className="text-xs text-[color:var(--fg-subtle)]">Qty: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="font-medium text-[color:var(--fg)]">{item.total?.toLocaleString()} DA</p>
                  </Card>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-[color:var(--accent-strong)]">{Number(order.total ?? 0).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA</span>
              </div>
            </div>
          </div>
        </Card>

        <p className="text-center text-[color:var(--fg-subtle)] text-sm mt-6">
          Suivez votre commande sur La Vie En Rose 34
        </p>
      </motion.div>
    </div>
  );
}

export default OrderTrackingPage;
