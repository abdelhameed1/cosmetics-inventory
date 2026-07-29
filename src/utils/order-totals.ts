export interface LineInput {
  sellPrice: number;
  quantitySold: number;
  costPriceUsdSnapshot?: number | null;
}
export interface PaymentInput {
  amount: number;
}
export interface OrderTotals {
  subtotal: number;
  totalCostEgp: number;
  finalTotal: number;
  netProfit: number;
  totalPaid: number;
  balanceDue: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function computeTotals(
  lines: LineInput[],
  discountAmount: number,
  exchangeRate: number,
  payments: PaymentInput[]
): OrderTotals {
  const subtotal = lines.reduce((s, l) => s + Number(l.sellPrice) * Number(l.quantitySold), 0);
  const totalCostEgp = lines.reduce(
    (s, l) => s + Number(l.costPriceUsdSnapshot ?? 0) * exchangeRate * Number(l.quantitySold),
    0
  );
  const discount = Number(discountAmount) || 0;
  const finalTotal = subtotal - discount;
  const netProfit = finalTotal - totalCostEgp;
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = finalTotal - totalPaid;

  return {
    subtotal: round2(subtotal),
    totalCostEgp: round2(totalCostEgp),
    finalTotal: round2(finalTotal),
    netProfit: round2(netProfit),
    totalPaid: round2(totalPaid),
    balanceDue: round2(balanceDue),
  };
}

export function statusFromPayments(
  totalPaid: number,
  finalTotal: number,
  currentStatus: string
): string {
  if (currentStatus === 'draft' || currentStatus === 'cancelled') return currentStatus;
  if (finalTotal > 0 && totalPaid >= finalTotal) return 'paid';
  if (totalPaid > 0) return 'partially_paid';
  return 'confirmed';
}

export function isBelowCost(
  sellPrice: number,
  costPriceUsdSnapshot: number,
  exchangeRate: number
): boolean {
  return Number(sellPrice) < Number(costPriceUsdSnapshot) * exchangeRate;
}
