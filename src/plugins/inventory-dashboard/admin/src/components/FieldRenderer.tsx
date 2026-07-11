import {
  Input, Textarea, NumberInput, NumberInputField, Switch, Select,
} from '@chakra-ui/react';
import { FormField } from './ui/FormField';
import { RelationSelect } from './RelationSelect';
import { type FieldMeta } from '../utils/api';

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  if (field.hidden) return null;

  switch (field.type) {
    case 'text':
      return (
        <FormField label={field.name} required={field.required}>
          <Textarea
            bg="white"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
    case 'integer':
    case 'decimal':
    case 'biginteger':
    case 'float':
      return (
        <FormField label={field.name} required={field.required}>
          <NumberInput
            value={value ?? ''}
            onChange={(_, valueAsNumber) => onChange(Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)}
          >
            <NumberInputField bg="white" />
          </NumberInput>
        </FormField>
      );
    case 'boolean':
      return (
        <FormField label={field.name} required={field.required}>
          <Switch
            isChecked={Boolean(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          />
        </FormField>
      );
    case 'date':
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            type="date"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value || null)}
          />
        </FormField>
      );
    case 'datetime':
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            type="datetime-local"
            value={value ? toDateTimeLocal(value) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </FormField>
      );
    case 'enumeration':
      return (
        <FormField label={field.name} required={field.required}>
          <Select bg="white" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.values ?? []).map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </Select>
        </FormField>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return (
        <FormField label={field.name} required={field.required}>
          <Input
            bg="white"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          />
        </FormField>
      );
  }
}

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
