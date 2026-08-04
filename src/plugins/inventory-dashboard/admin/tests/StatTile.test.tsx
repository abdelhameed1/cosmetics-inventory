import React from 'react';
import { render, screen } from './test-utils';
import { StatCard } from '../src/components/ui/StatCard';
import { StatTile } from '../src/components/ui/StatTile';
import { FiBox } from 'react-icons/fi';

describe('StatTile & StatCard', () => {
  it('renders label and value in StatCard', () => {
    render(<StatCard label="Total Products" value="128" icon={FiBox} />);
    expect(screen.getByText('Total Products')).toBeInTheDocument();
    expect(screen.getByText('128')).toBeInTheDocument();
  });

  it('renders StatTile without value when value is omitted', () => {
    render(<StatTile label="Category Label" icon={FiBox} size="tile" />);
    expect(screen.getByText('Category Label')).toBeInTheDocument();
  });

  it('renders StatTile with value when provided', () => {
    render(<StatTile label="Total Stock" value="450 units" icon={FiBox} size="stat" />);
    expect(screen.getByText('Total Stock')).toBeInTheDocument();
    expect(screen.getByText('450 units')).toBeInTheDocument();
  });
});
