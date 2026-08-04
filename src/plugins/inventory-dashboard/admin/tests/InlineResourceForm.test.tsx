import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import { InlineResourceForm } from '../src/components/InlineResourceForm';
import { useSchema } from '../src/hooks/useSchema';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));
jest.mock('../src/hooks/useSchema');

describe('InlineResourceForm', () => {
  const mockPost = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: jest.fn(), post: mockPost, put: jest.fn(), del: jest.fn() });
    (useSchema as jest.Mock).mockReturnValue({
      schema: {
        resource: 'brands', uid: 'api::brand.brand',
        fields: [
          { name: 'name', type: 'string', required: true, unique: false, hidden: false },
          { name: 'notes', type: 'text', required: false, unique: false, hidden: false },
        ],
      },
      error: null, reload: jest.fn(),
    });
  });

  it('renders one field per non-hidden schema field', () => {
    render(<InlineResourceForm resource="brands" onDone={jest.fn()} />);
    expect(screen.getByLabelText('Name', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
  });

  it('submits only the fields the user filled in and calls onDone with the created record', async () => {
    mockPost.mockResolvedValueOnce({ data: { documentId: 'new-1', name: 'Chanel' } });
    const onDone = jest.fn();
    render(<InlineResourceForm resource="brands" onDone={onDone} />);

    fireEvent.change(screen.getByLabelText('Name', { exact: false }), { target: { value: 'Chanel' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith({ documentId: 'new-1', name: 'Chanel' }));
    expect(mockPost).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { name: 'Chanel' });
  });

  it('shows the server error message and does not call onDone when the save fails', async () => {
    mockPost.mockRejectedValueOnce({ response: { data: { error: { message: 'Name already taken' } } } });
    const onDone = jest.fn();
    render(<InlineResourceForm resource="brands" onDone={onDone} />);

    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(screen.getByText('Name already taken')).toBeInTheDocument());
    expect(onDone).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked, and omits the button when onCancel is absent', () => {
    const onCancel = jest.fn();
    const { rerender } = render(<InlineResourceForm resource="brands" onDone={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<InlineResourceForm resource="brands" onDone={jest.fn()} />);
    expect(screen.queryByRole('button', { name: /cancel/i })).not.toBeInTheDocument();
  });
});
