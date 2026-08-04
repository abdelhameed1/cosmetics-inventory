import React from 'react';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import OrdersList from '../src/pages/OrdersList';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const draftOrder = {
  documentId: 'o1', orderDate: '2026-08-01', status: 'draft',
  customer: { name: 'Jane Doe' }, discountAmount: 0,
  lines: [{ sellPrice: 100, quantitySold: 2 }],
};

describe('OrdersList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders a row per order with date, customer, status badge and computed total', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('2026-08-01')).toBeInTheDocument();
    expect(screen.getByText('draft')).toBeInTheDocument();
    expect(screen.getByText('200.00')).toBeInTheDocument();
  });

  it('shows the "showing N of total" note when more orders exist than are shown', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 5 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    expect(await screen.findByText('Showing the 1 most recent of 5 orders.')).toBeInTheDocument();
  });

  it('only shows the cancel action for draft orders', async () => {
    const paidOrder = { ...draftOrder, documentId: 'o2', status: 'paid', customer: { name: 'Sam' } };
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder, paidOrder], pagination: { total: 2 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    await screen.findByText('Jane Doe');
    expect(screen.getAllByRole('button', { name: /cancel order/i })).toHaveLength(1);
  });

  it('cancels an order after confirming, then reloads the list', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    const post = jest.fn().mockResolvedValueOnce({ data: {} });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    await screen.findByText('Jane Doe');

    fireEvent.click(screen.getByRole('button', { name: /cancel order/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /cancel order/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith('/inventory-dashboard/orders/o1/cancel', undefined));
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('navigates to the order detail page when a row is clicked', async () => {
    const get = jest.fn().mockResolvedValue({ data: { results: [draftOrder], pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<OrdersList />);
    fireEvent.click(await screen.findByText('Jane Doe'));
    expect(mockNavigate).toHaveBeenCalledWith('o1');
  });
});
