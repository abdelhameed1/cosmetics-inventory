import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { SignalList } from '../src/components/ui/SignalList';

describe('SignalList', () => {
  const sampleRows = [
    {
      id: 'var-1',
      label: 'Foundation Shade 10',
      context: 'High-End Makeup',
      metric: '0 remaining',
    },
    {
      id: 'var-2',
      label: 'Lipstick Matte Red',
      context: 'Drugstore Makeup',
      metric: '2 remaining',
    },
  ];

  it('renders title and rows when rows array is non-empty', () => {
    render(
      <SignalList
        severity="critical"
        title="Out of Stock"
        rows={sampleRows}
        emptyLabel="Nothing out of stock"
      />
    );

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.getByText('Foundation Shade 10')).toBeInTheDocument();
    expect(screen.getByText('Lipstick Matte Red')).toBeInTheDocument();
    expect(screen.getByText('0 remaining')).toBeInTheDocument();
  });

  it('renders count badge equal to rows length', () => {
    render(
      <SignalList
        severity="warning"
        title="Low Stock"
        rows={sampleRows}
        emptyLabel="No low stock items"
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders emptyLabel when rows array is empty', () => {
    render(
      <SignalList
        severity="critical"
        title="Expired Batches"
        rows={[]}
        emptyLabel="No expired batches"
      />
    );

    expect(screen.getByText('No expired batches')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('triggers onClick handler when a row button is clicked', () => {
    const handleClick = jest.fn();
    const rowsWithClick = [
      {
        ...sampleRows[0],
        onClick: handleClick,
      },
    ];

    render(
      <SignalList
        severity="critical"
        title="Out of Stock"
        rows={rowsWithClick}
        emptyLabel="All clean"
      />
    );

    const rowBtn = screen.getByRole('button', { name: /foundation shade 10/i });
    fireEvent.click(rowBtn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
