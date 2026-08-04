import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, fireEvent, waitFor, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ResourceListPage from '../src/pages/ResourceListPage';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

function renderAtResource(resource: string) {
  return render(
    <MemoryRouter initialEntries={[`/${resource}`]}>
      <Routes>
        <Route path="/:resource" element={<ResourceListPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const schemaResponse = {
  data: {
    resource: 'brands', uid: 'api::brand.brand',
    fields: [{ name: 'name', type: 'string', required: true, unique: false, hidden: false }],
  },
};

describe('ResourceListPage', () => {
  const mockGet = jest.fn();
  const mockDel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: jest.fn(), put: jest.fn(), del: mockDel });
  });

  function mockLoads(rows: any[]) {
    mockGet.mockImplementation((url: string) =>
      url.endsWith('/schema')
        ? Promise.resolve(schemaResponse)
        : Promise.resolve({ data: { results: rows, pagination: { total: rows.length } } })
    );
  }

  it('renders columns from the schema and one row per record', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    renderAtResource('brands');

    expect(await screen.findByText('Chanel')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('shows the entity-specific empty label when there is no search and no rows', async () => {
    mockLoads([]);
    renderAtResource('brands');
    expect(await screen.findByText('No brands yet.')).toBeInTheDocument();
  });

  it('re-fetches with the search term as the user types', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    renderAtResource('brands');
    await screen.findByText('Chanel');

    fireEvent.change(screen.getByPlaceholderText('Search by name'), { target: { value: 'Cha' } });

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', {
        params: { search: 'Cha', pageSize: 100 },
      })
    );
  });

  it('deletes a record after confirming, then reloads the list', async () => {
    mockLoads([{ documentId: 'b1', name: 'Chanel' }]);
    mockDel.mockResolvedValueOnce({ data: {} });
    renderAtResource('brands');
    await screen.findByText('Chanel');

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDel).toHaveBeenCalledWith('/inventory-dashboard/resources/brands/b1'));
  });
});
