import React from 'react';
import { render, screen, fireEvent, waitFor } from './test-utils';
import { QuickCreateSelect } from '../src/components/QuickCreateSelect';

jest.mock('../src/components/InlineResourceForm', () => ({
  InlineResourceForm: ({ onDone }: { onDone: (created?: any) => void }) => (
    <button onClick={() => onDone({ documentId: 'new-1', name: 'New Brand' })}>Mock create</button>
  ),
}));

describe('QuickCreateSelect', () => {
  const options = [{ documentId: 'b1', name: 'Chanel' }, { documentId: 'b2', name: 'Dior' }];

  it('renders the select with the given label and options', () => {
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={jest.fn()} options={options} onCreated={jest.fn()} />);
    expect(screen.getByLabelText('Brand')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chanel' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Dior' })).toBeInTheDocument();
  });

  it('calls onChange with the selected documentId', () => {
    const onChange = jest.fn();
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={onChange} options={options} onCreated={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Brand'), { target: { value: 'b2' } });
    expect(onChange).toHaveBeenCalledWith('b2');
  });

  it('opens the create modal, forwards the created record to onCreated and onChange, and closes', async () => {
    const onChange = jest.fn();
    const onCreated = jest.fn();
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={onChange} options={options} onCreated={onCreated} />);

    fireEvent.click(screen.getByRole('button', { name: /create new brand/i }));
    const createBtn = await screen.findByRole('button', { name: /mock create/i });
    fireEvent.click(createBtn);

    expect(onCreated).toHaveBeenCalledWith({ documentId: 'new-1', name: 'New Brand' });
    expect(onChange).toHaveBeenCalledWith('new-1');
    await waitFor(() => expect(screen.queryByRole('button', { name: /mock create/i })).not.toBeInTheDocument());
  });

  it('is disabled when isDisabled is true', () => {
    render(<QuickCreateSelect resource="brands" label="Brand" value="" onChange={jest.fn()} options={options} onCreated={jest.fn()} isDisabled />);
    expect(screen.getByLabelText('Brand')).toBeDisabled();
  });
});
