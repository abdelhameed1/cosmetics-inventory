import { computeTotals, statusFromPayments, isBelowCost } from '../src/utils/order-totals';

describe('computeTotals', () => {
  it('derives subtotal, cost, profit, and balance', () => {
    const lines = [
      { sellPrice: 100, quantitySold: 2, costPriceUsdSnapshot: 1 }, // sell 200, cost 1*50*2=100
      { sellPrice: 50, quantitySold: 1, costPriceUsdSnapshot: 0.5 }, // sell 50, cost 0.5*50*1=25
    ];
    const t = computeTotals(lines, 20, 50, [{ amount: 100 }]);
    expect(t.subtotal).toBe(250);
    expect(t.totalCostEgp).toBe(125);
    expect(t.finalTotal).toBe(230);   // 250 - 20 discount
    expect(t.netProfit).toBe(105);    // 230 - 125
    expect(t.totalPaid).toBe(100);
    expect(t.balanceDue).toBe(130);   // 230 - 100
  });
});

describe('statusFromPayments', () => {
  it('keeps a draft order in draft regardless of payments', () => {
    expect(statusFromPayments(0, 230, 'draft')).toBe('draft');
    expect(statusFromPayments(300, 230, 'draft')).toBe('draft');
  });
  it('maps payments to confirmed/partially_paid/paid for a confirmed order', () => {
    expect(statusFromPayments(0, 230, 'confirmed')).toBe('confirmed');
    expect(statusFromPayments(100, 230, 'confirmed')).toBe('partially_paid');
    expect(statusFromPayments(230, 230, 'confirmed')).toBe('paid');
    expect(statusFromPayments(999, 230, 'partially_paid')).toBe('paid');
  });
});

describe('isBelowCost', () => {
  it('flags a sell price below the EGP cost', () => {
    expect(isBelowCost(40, 1, 50)).toBe(true);  // 40 < 50
    expect(isBelowCost(60, 1, 50)).toBe(false); // 60 >= 50
  });
});
