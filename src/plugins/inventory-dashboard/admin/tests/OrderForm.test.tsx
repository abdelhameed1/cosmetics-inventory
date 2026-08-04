import React from 'react';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import OrderForm from '../src/pages/OrderForm';
import { useOrder } from '../src/hooks/useOrder';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/hooks/useOrder');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({}),
}));

function mockClient() {
  const get = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/resources/customers')) return Promise.resolve({ data: { results: [{ documentId: 'c1', name: 'Jane Doe', priceList: { documentId: 'pl1' } }] } });
    if (url.endsWith('/resources/products')) return Promise.resolve({ data: { results: [{ documentId: 'p1', name: 'Serum' }] } });
    if (url.endsWith('/resources/variants')) return Promise.resolve({ data: { results: [{ documentId: 'v1', label: '50ml', product: { documentId: 'p1' } }] } });
    if (url.startsWith('/inventory-dashboard/fifo/')) return Promise.resolve({ data: { segments: [{ batchDocumentId: 'batch1', costPriceUsd: 2, quantityFromBatch: 1 }], shortfall: 0 } });
    return Promise.resolve({ data: { results: [] } });
  });
  const post = jest.fn().mockImplementation((url: string) => {
    if (url.endsWith('/pricing/suggest')) return Promise.resolve({ data: { sellPrice: 150 } });
    if (url.endsWith('/resources/orders')) return Promise.resolve({ data: { documentId: 'o1' } });
    return Promise.resolve({ data: {} });
  });
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });
  return { get, post };
}

describe('OrderForm — new draft order', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrder as jest.Mock).mockReturnValue({ order: null, reload: jest.fn(), confirm: jest.fn(), cancel: jest.fn() });
  });

  it('blocks advancing past the customer step until a customer is selected', async () => {
    mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  it('adds a FIFO-priced line item and only then allows advancing', async () => {
    mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Customer\*?$/), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'v1' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(await screen.findByText('50ml')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
  });

  it('saves the draft order and its lines, then navigates to the order detail page', async () => {
    const { post } = mockClient();
    render(<OrderForm />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Jane Doe' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Customer\*?$/), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => expect(screen.getByRole('option', { name: 'Serum' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Product'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('option', { name: '50ml' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant'), { target: { value: 'v1' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await screen.findByText('50ml');

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/plugins/inventory-dashboard/orders/o1'));
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/orders', {
      orderDate: expect.any(String), status: 'draft', discountAmount: 0, customer: 'c1', priceList: 'pl1',
    });
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/order-lines', {
      quantitySold: 1, sellPrice: 150, order: 'o1', stockBatch: 'batch1',
    });
  });
});
