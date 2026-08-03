import { orderStatusToSeverity } from '../src/utils/orderStatus';

describe('orderStatusToSeverity', () => {
  it('maps every known order status to its documented severity', () => {
    expect(orderStatusToSeverity('draft')).toBe('neutral');
    expect(orderStatusToSeverity('confirmed')).toBe('warning');
    expect(orderStatusToSeverity('partially_paid')).toBe('warning');
    expect(orderStatusToSeverity('paid')).toBe('success');
    expect(orderStatusToSeverity('cancelled')).toBe('critical');
  });

  it('falls back to neutral for an unrecognized status', () => {
    expect(orderStatusToSeverity('some-future-status')).toBe('neutral');
  });
});
