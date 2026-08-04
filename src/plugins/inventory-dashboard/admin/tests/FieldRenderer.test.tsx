import React from 'react';
import { render, screen, fireEvent } from './test-utils';
import { FieldRenderer } from '../src/components/FieldRenderer';
import { type FieldMeta } from '../src/utils/api';

jest.mock('../src/components/RelationSelect', () => ({
  RelationSelect: ({ field }: { field: FieldMeta }) => <div data-testid="relation-select">{field.name}</div>,
}));

function field(overrides: Partial<FieldMeta>): FieldMeta {
  return { name: 'name', type: 'string', required: false, unique: false, hidden: false, ...overrides };
}

describe('FieldRenderer', () => {
  it('renders nothing when the field is hidden', () => {
    render(<FieldRenderer field={field({ name: 'notes', hidden: true })} value="" onChange={jest.fn()} />);
    // Component returns null, so no form control should be rendered for this field
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();
  });

  it('renders a Textarea for type "text"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'notes', type: 'text' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('hello');
  });

  it('renders a NumberInput for numeric types and passes a number to onChange', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'marginPercent', type: 'decimal' })} value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Margin %'), { target: { value: '12.5' } });
    expect(onChange).toHaveBeenCalledWith(12.5);
  });

  it('renders a Switch for type "boolean"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'isDefault', type: 'boolean' })} value={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Default'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('renders a date input for type "date"', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'name', type: 'date' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '2026-08-04' } });
    expect(onChange).toHaveBeenCalledWith('2026-08-04');
  });

  it('renders an enumeration Select with translated option labels', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'type', type: 'enumeration', values: ['retail', 'wholesale'] })} value="" onChange={onChange} />);
    const select = screen.getByLabelText('Type');
    expect(screen.getByRole('option', { name: 'retail' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'wholesale' })).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'wholesale' } });
    expect(onChange).toHaveBeenCalledWith('wholesale');
  });

  it('delegates type "relation" to RelationSelect', () => {
    render(<FieldRenderer field={field({ name: 'brand', type: 'relation' })} value="" onChange={jest.fn()} />);
    expect(screen.getByTestId('relation-select')).toHaveTextContent('brand');
  });

  it('falls back to a plain text Input for an unrecognized type', () => {
    const onChange = jest.fn();
    render(<FieldRenderer field={field({ name: 'phone', type: 'string' })} value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '0100' } });
    expect(onChange).toHaveBeenCalledWith('0100');
  });
});
