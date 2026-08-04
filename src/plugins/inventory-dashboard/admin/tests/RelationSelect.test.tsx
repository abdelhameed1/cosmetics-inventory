import React from 'react';
import { render, screen, waitFor, fireEvent, within } from './test-utils';
import { useFetchClient } from '@strapi/strapi/admin';
import { RelationSelect } from '../src/components/RelationSelect';
import { type FieldMeta } from '../src/utils/api';

jest.mock('@strapi/strapi/admin', () => ({ useFetchClient: jest.fn() }));

const relationField: FieldMeta = {
  name: 'brand', type: 'relation', required: true, unique: false, hidden: false,
  relation: { resource: 'brands', kind: 'oneToOne', mainField: 'name' },
};

describe('RelationSelect', () => {
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useFetchClient as jest.Mock).mockReturnValue({ get: mockGet, post: jest.fn(), put: jest.fn(), del: jest.fn() });
  });

  it('loads and renders options from the related resource', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }, { documentId: 'b2', name: 'Dior' }] } });

    render(<RelationSelect field={relationField} value="" onChange={jest.fn()} />);

    expect(mockGet).toHaveBeenCalledWith('/inventory-dashboard/resources/brands', { params: { pageSize: 100 } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    expect(screen.getByRole('option', { name: 'Dior' })).toBeInTheDocument();
  });

  it('calls onChange with the selected documentId', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }] } });
    const onChange = jest.fn();

    const { container } = render(<RelationSelect field={relationField} value="" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());

    const select = container.querySelector('select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'b1' } });
    expect(onChange).toHaveBeenCalledWith('b1');
  });

  it('does not fetch and renders no options when the field has no relation target', () => {
    render(<RelationSelect field={{ ...relationField, relation: undefined }} value="" onChange={jest.fn()} />);
    expect(mockGet).not.toHaveBeenCalled();
    const options = screen.queryAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Select Brand');
  });

  it('resolves the selected value from a populated relation object via documentId', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: [{ documentId: 'b1', name: 'Chanel' }] } });
    const { container } = render(<RelationSelect field={relationField} value={{ documentId: 'b1', name: 'Chanel' }} onChange={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument());
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('b1');
  });
});
