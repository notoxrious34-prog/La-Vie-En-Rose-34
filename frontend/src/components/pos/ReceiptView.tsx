type ReceiptItem = {
  name: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  total: number;
  sku?: string | null;
  barcode?: string | null;
};

type ReceiptPayment = { method: 'cash' | 'cib' | 'edahabia' | 'transfer'; amount: number };

export type ReceiptData = {
  orderNumber: string;
  createdAt: number;
  items: ReceiptItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  payments: ReceiptPayment[];
  paidTotal: number;
  changeDue: number;
};

function formatDA(v: number) {
  return `${v.toFixed(2)} DA`;
}

function formatPaymentMethod(method: ReceiptPayment['method']) {
  if (method === 'cash') return 'Espèces';
  if (method === 'edahabia') return 'Edahabia';
  if (method === 'cib') return 'CIB';
  return 'Virement';
}

export function ReceiptView({ data }: { data: ReceiptData }) {
  return (
    <>
      <style>{`
        @media print {
          body { margin: 0 !important; }
          #lver-receipt {
            width: 100% !important;
            max-width: 80mm !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: var(--print-bg) !important;
            color: var(--print-fg) !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #lver-receipt .lver-muted { color: var(--print-muted) !important; }
          #lver-receipt .lver-rule { border-color: var(--print-rule) !important; }
        }
      `}</style>

      <div
        id="lver-receipt"
        className="mx-auto w-[80mm] max-w-[80mm] px-2 py-3"
        style={{
          background: 'color-mix(in srgb, var(--print-bg) 92%, var(--surface-1))',
          color: 'var(--fg)',
          border: '1px solid var(--border-soft)',
          borderRadius: '12px',
        }}
      >
        <div className="text-center">
          <div className="text-[12px] font-extrabold">La Vie En Rose 34</div>
          <div className="lver-muted mt-0.5 text-[10px]" style={{ color: 'var(--fg-muted)' }}>
            Women&apos;s Fashion - Algeria
          </div>
          <div className="lver-muted mt-2 text-[10px]" style={{ color: 'var(--fg-muted)' }}>
            <div>Order: {data.orderNumber}</div>
            <div>{new Date(data.createdAt).toLocaleString('fr-DZ', { dateStyle: 'short', timeStyle: 'short' })}</div>
          </div>
        </div>

        <div className="lver-rule mt-2 border-t border-dashed pt-2" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="space-y-2">
            {data.items.map((it, idx) => (
              <div key={idx} className="text-[11px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{it.name}</div>
                    {(it.sku ?? it.barcode ?? '') ? (
                      <div className="lver-muted text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                        {String(it.sku ?? it.barcode)}
                      </div>
                    ) : null}
                    <div className="lver-muted text-[10px]" style={{ color: 'var(--fg-muted)' }}>
                      {it.quantity} x {formatDA(it.unitPrice)}
                      {it.discount > 0 ? `  (-${formatDA(it.discount)})` : ''}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold">{formatDA(it.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lver-rule mt-2 border-t border-dashed pt-2 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="flex items-center justify-between">
            <span className="lver-muted" style={{ color: 'var(--fg-muted)' }}>Subtotal</span>
            <span className="font-semibold">{formatDA(data.subtotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="lver-muted" style={{ color: 'var(--fg-muted)' }}>Discount</span>
            <span className="font-semibold">{formatDA(data.discountTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-[12px]">
            <span className="font-extrabold">Total</span>
            <span className="font-extrabold">{formatDA(data.total)}</span>
          </div>
        </div>

        <div className="lver-rule mt-2 border-t border-dashed pt-2 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
          <div className="font-semibold">Payments</div>
          <div className="mt-1 space-y-1">
            {data.payments.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="lver-muted" style={{ color: 'var(--fg-muted)' }}>{formatPaymentMethod(p.method)}</span>
                <span className="font-semibold">{formatDA(p.amount)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="lver-muted" style={{ color: 'var(--fg-muted)' }}>Paid</span>
            <span className="font-semibold">{formatDA(data.paidTotal)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="lver-muted" style={{ color: 'var(--fg-muted)' }}>Change</span>
            <span className="font-semibold">{formatDA(data.changeDue)}</span>
          </div>
        </div>

        <div className="lver-muted mt-3 text-center text-[10px]" style={{ color: 'var(--fg-muted)' }}>
          Thank you. Merci. شكرا
        </div>
      </div>
    </>
  );
}
