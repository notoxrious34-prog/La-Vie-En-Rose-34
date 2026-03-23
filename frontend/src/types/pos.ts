export type CartLine = {
  variantId: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  unitPrice: number;
  quantity: number;
  discount: number;
};
