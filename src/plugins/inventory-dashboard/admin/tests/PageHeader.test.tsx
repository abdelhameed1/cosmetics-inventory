import React from 'react';
import { render, screen } from './test-utils';
import { PageHeader } from '../src/components/ui/PageHeader';
import { SeverityBadge } from '../src/components/ui/SeverityBadge';
import { Button } from '@chakra-ui/react';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Overview" />);
    expect(screen.getByRole('heading', { name: /overview/i })).toBeInTheDocument();
  });

  it('renders optional badge slot', () => {
    render(
      <PageHeader
        title="Order #101"
        badge={<SeverityBadge severity="warning">Confirmed</SeverityBadge>}
      />
    );
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders optional action buttons', () => {
    render(
      <PageHeader
        title="Products"
        actions={<Button colorScheme="blue">Create Product</Button>}
      />
    );
    expect(screen.getByRole('button', { name: /create product/i })).toBeInTheDocument();
  });
});
