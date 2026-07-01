import {
  Field, TextInput, Textarea, NumberInput, Toggle, DatePicker, DateTimePicker,
  SingleSelect, SingleSelectOption,
} from '@strapi/design-system';
import { type FieldMeta } from '../utils/api';
import { RelationSelect } from './RelationSelect';

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  if (field.hidden) return null;

  switch (field.type) {
    case 'text':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <Textarea
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          />
        </Field.Root>
      );
    case 'integer':
    case 'decimal':
    case 'biginteger':
    case 'float':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <NumberInput
            value={value ?? undefined}
            onValueChange={(v: number | undefined) => onChange(v)}
          />
        </Field.Root>
      );
    case 'boolean':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <Toggle
            checked={Boolean(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
            onLabel="Yes"
            offLabel="No"
          />
        </Field.Root>
      );
    case 'date':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <DatePicker
            onChange={(d: Date | undefined) => onChange(d ? formatLocalDate(d) : null)}
            value={value ? parseLocalDate(value) : undefined}
          />
        </Field.Root>
      );
    case 'datetime':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <DateTimePicker
            onChange={(d: Date | undefined) => onChange(d ? d.toISOString() : null)}
            value={value ? new Date(value) : undefined}
          />
        </Field.Root>
      );
    case 'enumeration':
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <SingleSelect value={value ?? ''} onChange={(v: string | number) => onChange(v)}>
            {(field.values ?? []).map((opt) => (
              <SingleSelectOption key={opt} value={opt}>{opt}</SingleSelectOption>
            ))}
          </SingleSelect>
        </Field.Root>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return (
        <Field.Root name={field.name} required={field.required}>
          <Field.Label>{field.name}</Field.Label>
          <TextInput
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          />
        </Field.Root>
      );
  }
}
