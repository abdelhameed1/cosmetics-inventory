import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ResourceFormPage from '../src/pages/ResourceFormPage';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/components/ProductVariantsForm', () => ({
  __esModule: true,
  default: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>Mock ProductVariantsForm</button>,
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/:resource/new" element={<ResourceFormPage />} />
        <Route path="/:resource/:id" element={<ResourceFormPage />} />
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

describe('ResourceFormPage', () => {
  const mockGet = jest.fn();
  const mockPost = jest.fn();
  const mockPut = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: mockPost, put: mockPut, del: jest.fn() });
  });

  it('renders ProductVariantsForm instead of the generic form when creating a product', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    renderAt('/products/new');
    expect(await screen.findByText('Mock ProductVariantsForm')).toBeInTheDocument();
  });

  it('creates a record from the generic form and navigates back on success', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    mockPost.mockResolvedValueOnce({ data: { documentId: 'b1', name: 'Chanel' } });
    renderAt('/brands/new');

    fireEvent.change(await screen.findByLabelText('Name', { exact: false }), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { name: 'Chanel' }));
    expect(mockNavigate).toHaveBeenCalledWith('..', { relative: 'path' });
  });

  it('loads and prefills an existing record in edit mode', async () => {
    mockGet.mockImplementation((url: string) =>
      url.endsWith('/schema') ? Promise.resolve(schemaResponse) : Promise.resolve({ data: { documentId: 'b1', name: 'Chanel' } })
    );
    renderAt('/brands/b1');

    expect(await screen.findByLabelText('Name', { exact: false })).toHaveValue('Chanel');
    expect(screen.getByRole('heading', { name: 'Edit Brands' })).toBeInTheDocument();
  });

  it('shows the server error message when saving fails', async () => {
    mockGet.mockResolvedValue(schemaResponse);
    mockPost.mockRejectedValueOnce({ response: { data: { error: { message: 'Name must be unique' } } } });
    renderAt('/brands/new');

    fireEvent.change(await screen.findByLabelText('Name', { exact: false }), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText('Name must be unique')).toBeInTheDocument();
  });
});
