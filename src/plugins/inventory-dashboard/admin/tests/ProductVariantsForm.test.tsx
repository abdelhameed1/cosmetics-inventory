import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import ProductVariantsForm from '../src/components/ProductVariantsForm';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const listGet = (results: any[]) => Promise.resolve({ data: { results } });

function setupFetchClient(get: jest.Mock, post: jest.Mock, del: jest.Mock = jest.fn()) {
  (useFetchClient as jest.Mock).mockReturnValue({ get, post, put: jest.fn(), del });
}

describe('ProductVariantsForm', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a product with a single default variant when no explicit variant rows are added', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([]))
      .mockImplementationOnce(() => listGet([]));
    const post = jest.fn().mockResolvedValueOnce({ data: { documentId: 'p-1', name: 'Serum' } });
    setupFetchClient(get, post);
    const onDone = jest.fn();

    render(<ProductVariantsForm onDone={onDone} />);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Brand/), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'ct-1' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Variants
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Related Products
    fireEvent.click(screen.getByRole('button', { name: /next/i })); // -> Review
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/inventory-dashboard/resources/products', {
      name: 'Serum', brand: 'br-1', category: 'ct-1', relatedProducts: [],
    });
  });

  it('blocks advancing past the Variants step when a row has no variant type', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([]))
      .mockImplementationOnce(() => listGet([]));
    const post = jest.fn();
    setupFetchClient(get, post);

    render(<ProductVariantsForm onDone={jest.fn()} />);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Brand/), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'ct-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '50ml' } });

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(post).not.toHaveBeenCalled();
  });

  it('retries from where it left off after the product is created but variant creation fails', async () => {
    const get = jest.fn()
      .mockImplementationOnce(() => listGet([{ documentId: 'br-1', name: 'Chanel' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'ct-1', name: 'Skincare' }]))
      .mockImplementationOnce(() => listGet([{ documentId: 'vt-1', name: 'Size' }]))
      .mockImplementationOnce(() => listGet([]))
      .mockImplementationOnce(() => listGet([{ documentId: 'auto-1', product: { documentId: 'p-1' }, isDefault: true }]));
    const post = jest.fn()
      .mockResolvedValueOnce({ data: { documentId: 'p-1', name: 'Serum' } })
      .mockRejectedValueOnce(new Error('Network blip'))
      .mockResolvedValueOnce({ data: { documentId: 'v-1' } });
    const del = jest.fn().mockResolvedValue({ data: {} });
    setupFetchClient(get, post, del);
    const onDone = jest.fn();

    render(<ProductVariantsForm onDone={onDone} />);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Serum' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/^Brand/), { target: { value: 'br-1' } });
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'ct-1' } });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    fireEvent.click(screen.getByRole('button', { name: /add variant/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: '50ml' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Size' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Variant Type'), { target: { value: 'vt-1' } });

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /create product/i }));

    expect(await screen.findByText(
      'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.'
    )).toBeInTheDocument();
    const retryBtn = await screen.findByRole('button', { name: /retry remaining steps/i });

    fireEvent.click(retryBtn);

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    // 3 POSTs total: product (once, never repeated on retry), the failed variant attempt,
    // and the successful retry of that same variant.
    expect(post).toHaveBeenCalledTimes(3);
    expect(post).toHaveBeenNthCalledWith(1, '/inventory-dashboard/resources/products', {
      name: 'Serum', brand: 'br-1', category: 'ct-1', relatedProducts: [],
    });
    expect(post).toHaveBeenNthCalledWith(3, '/inventory-dashboard/resources/variants', {
      label: '50ml', variantType: 'vt-1', isDefault: false, product: 'p-1',
    });
    // The retry also completes step 3 (delete the auto-created default variant).
    expect(del).toHaveBeenCalledWith('/inventory-dashboard/resources/variants/auto-1');
  });
});
