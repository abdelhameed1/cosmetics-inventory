import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import CatalogHub from '../src/pages/CatalogHub';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));
jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

describe('CatalogHub', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders group headings and per-entity counts once loaded', async () => {
    const counts: Record<string, number> = {
      products: 12, variants: 30, 'variant-types': 4, categories: 6,
      brands: 9, suppliers: 3, customers: 20, 'price-lists': 2,
    };
    const get = jest.fn().mockImplementation((url: string) => {
      const slug = url.split('/').pop() as string;
      return Promise.resolve({ data: { pagination: { total: counts[slug] ?? 0 } } });
    });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('Catalog').length).toBeGreaterThan(0);
    expect(screen.getByText('Partners & Pricing')).toBeInTheDocument();
    expect(screen.getByText('Brands')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('shows a dash for an entity whose count request fails', async () => {
    const get = jest.fn().mockRejectedValue(new Error('boom'));
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);

    await waitFor(() => expect(screen.getAllByText('—').length).toBe(8));
  });

  it('navigates to the entity slug when a card is clicked', async () => {
    const get = jest.fn().mockResolvedValue({ data: { pagination: { total: 1 } } });
    (useFetchClient as jest.Mock).mockReturnValue({ get, post: jest.fn(), put: jest.fn(), del: jest.fn() });

    render(<CatalogHub />);
    const brandsCard = (await screen.findByText('Brands')).closest('button') as HTMLElement;
    fireEvent.click(brandsCard);

    expect(mockNavigate).toHaveBeenCalledWith('brands');
  });
});
