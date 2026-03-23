import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { Card } from '../components/ui/Card';
import { Skeleton } from '../components/ui/Skeleton';

type PublicOrder = {
  orderNumber: string;
  kind: 'sale' | 'repair' | 'reservation';
  status: string;
  total: number;
  createdAt: number;
  updatedAt: number;
};

export function PublicOrderStatusPage() {
  const { orderNumber } = useParams();
  const { t, i18n } = useTranslation();

  const q = useQuery({
    queryKey: ['public-order', orderNumber],
    queryFn: async () => {
      const res = await api.get(`/api/public/orders/${encodeURIComponent(String(orderNumber ?? ''))}`);
      return res.data as PublicOrder;
    },
    enabled: Boolean(orderNumber),
    retry: 1,
  });

  const kindLabel = useMemo(() => {
    const k = q.data?.kind;
    if (k === 'repair') return t('kindRepair');
    if (k === 'reservation') return t('kindReservation');
    if (k === 'sale') return t('kindSale');
    return '';
  }, [q.data?.kind, t]);

  const statusLabel = useMemo(() => {
    const s = q.data?.status;
    if (s === 'pending') return t('statusPending');
    if (s === 'in_progress') return t('statusInProgress');
    if (s === 'ready') return t('statusReady');
    if (s === 'delivered') return t('statusDelivered');
    return String(s ?? '');
  }, [q.data?.status, t]);

  const isArabic = i18n.language === 'ar';

  return (
    <div className="min-h-screen px-4 py-10" dir={isArabic ? 'rtl' : 'ltr'}>
      <div className="mx-auto w-full max-w-xl space-y-4">
        <div className="text-center">
          <div className="text-xs font-semibold text-[color:var(--accent-strong)]">La Vie En Rose 34</div>
          <div className="mt-1 text-2xl font-extrabold text-[color:var(--fg)]">{t('publicOrderTitle')}</div>
          <div className="mt-2 text-sm text-[color:var(--fg-muted)]">{t('publicOrderSubtitle')}</div>
        </div>

        <Card className="p-5 lux-page-hero">
          {q.isFetching ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-40" radius="xl" />
              <Skeleton className="h-10 w-full" radius="3xl" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-16 w-full" radius="3xl" />
                <Skeleton className="h-16 w-full" radius="3xl" />
              </div>
            </div>
          ) : q.isError ? (
            <div className="text-sm font-semibold text-[color:var(--accent-strong)]">{t('publicOrderNotFound')}</div>
          ) : q.data ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-[color:var(--fg-muted)]">{t('publicOrderOrder')}</div>
                  <div className="text-lg font-extrabold text-[color:var(--fg)]">{q.data.orderNumber}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-[color:var(--fg-muted)]">{t('publicOrderType')}</div>
                  <div className="text-sm font-extrabold text-[color:var(--fg)]">{kindLabel}</div>
                </div>
              </div>

              <Card className="p-4 ring-1 ring-[color:color-mix(in_srgb,var(--accent)_18%,transparent)]">
                <div className="text-xs font-semibold text-[color:var(--fg-muted)]">{t('publicOrderStatus')}</div>
                <div className="mt-1 text-xl font-extrabold text-[color:var(--accent-strong)]">{statusLabel}</div>
                <div className="mt-2 text-xs text-[color:var(--fg-muted)]">
                  {t('publicOrderLastUpdate')}: {new Date(q.data.updatedAt).toLocaleString('fr-DZ', { dateStyle: 'short', timeStyle: 'short' })}
                </div>
              </Card>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <Card className="p-4">
                  <div className="text-xs font-semibold text-[color:var(--fg-muted)]">{t('publicOrderCreated')}</div>
                  <div className="mt-1 font-extrabold text-[color:var(--fg)]">{new Date(q.data.createdAt).toLocaleString('fr-DZ', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-xs font-semibold text-[color:var(--fg-muted)]">{t('publicOrderTotal')}</div>
                  <div className="mt-1 font-extrabold text-[color:var(--fg)]">{Number(q.data.total ?? 0).toFixed(2)} DA</div>
                </Card>
              </div>

              <div className="text-center text-xs text-[color:var(--fg-muted)]">{t('publicOrderThanks')}</div>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
