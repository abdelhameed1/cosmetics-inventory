import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import StockPurchase from '../src/pages/StockPurchase';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

function mockClient() {
  const get = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/resources/products')) return Promise.resolve({ data: { results: [{ documentId: 'p1', name: 'Serum' }] } });
    if (url.endsWith('/resources/suppliers')) return Promise.resolve({ data: { results: [{ documentId: 's1', name: 'Acme Co' }] } });
    if (url.endsWith('/resources/variants')) return Promise.resolve({ data: { results: [{ documentId: 'v1', label: '50ml', product: { documentId: 'p1' } }] } });
    return Promise.resolve({ data: { results: [] } });
  });
  const post = jest.fn().mockResolvedValueOnce({ data: { documentId: 'sb1' } });
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });
  return { get, post };
}

describe('StockPurchase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('walks the 3-step wizard and records a stock purchase', async () => {
    const { post } = mockClient();
    render(<StockPurchase />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Supplier\*?$/), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Product\*?$/), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Variant\*?$/), { target: { value: 'v1' } });
    fireEvent.change(screen.getByLabelText(/^Quantity purchased\*?$/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/^Cost price \(USD\)\*?$/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/^Purchase date\*?$/), { target: { value: '2026-08-04' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('Acme Co')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /record purchase/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/stock-batches', {
        quantityPurchased: 10, costPriceUsd: 5, purchaseDate: '2026-08-04', productionDate: null, expiryDate: null,
        variant: 'v1', supplier: 's1',
      })
    );
    expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-dashboard/r/stock-batches');
  });

  it('cannot advance past the product step until all required fields are set', async () => {
    mockClient();
    render(<StockPurchase />);

    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Supplier\*?$/), { target: { value: 's1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('calls onCancel from the embedded flow', async () => {
    mockClient();
    const onCancel = jest.fn();
    render(<StockPurchase embedded onCancel={onCancel} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Acme Co' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
