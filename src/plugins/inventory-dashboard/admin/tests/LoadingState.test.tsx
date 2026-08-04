import React from 'react';
import { render, screen } from './test-utils';
import { LoadingState } from '../src/components/ui/LoadingState';

describe('LoadingState component', () => {
  it('renders default loading message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders custom label when provided', () => {
    render(<LoadingState label="Fetching products..." />);
    expect(screen.getByText('Fetching products...')).toBeInTheDocument();
  });
});
