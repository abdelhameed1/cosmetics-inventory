import React from 'react';
import { render, screen } from './test-utils';
import { SeverityBadge } from '../src/components/ui/SeverityBadge';
import { orderStatusToSeverity } from '../src/utils/orderStatus';

describe('SeverityBadge', () => {
  it('renders children content correctly', () => {
    render(<SeverityBadge severity="success">Paid</SeverityBadge>);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });

  it('renders badges for all severity levels', () => {
    const severities = ['neutral', 'warning', 'success', 'critical', 'info'] as const;
    severities.forEach((sev) => {
      const { unmount } = render(
        <SeverityBadge severity={sev}>{sev.toUpperCase()}</SeverityBadge>
      );
      expect(screen.getByText(sev.toUpperCase())).toBeInTheDocument();
      unmount();
    });
  });

  it('correctly displays mapped order statuses', () => {
    const statusMap = [
      { status: 'draft', label: 'Draft', expectedSev: 'neutral' },
      { status: 'confirmed', label: 'Confirmed', expectedSev: 'warning' },
      { status: 'paid', label: 'Paid', expectedSev: 'success' },
      { status: 'cancelled', label: 'Cancelled', expectedSev: 'critical' },
    ];

    statusMap.forEach(({ status, label, expectedSev }) => {
      const sev = orderStatusToSeverity(status);
      expect(sev).toBe(expectedSev);
      const { unmount } = render(
        <SeverityBadge severity={sev}>{label}</SeverityBadge>
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    });
  });
});
