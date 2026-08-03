import { type Severity } from './severity';

const ORDER_STATUS_SEVERITY: Record<string, Severity> = {
  draft: 'neutral',
  confirmed: 'warning',
  partially_paid: 'warning',
  paid: 'success',
  cancelled: 'critical',
};

export function orderStatusToSeverity(status: string): Severity {
  return ORDER_STATUS_SEVERITY[status] ?? 'neutral';
}
