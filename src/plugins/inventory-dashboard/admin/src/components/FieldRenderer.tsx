import {
  Input, Textarea, NumberInput, NumberInputField, Switch, Select,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { RelationSelect } from './RelationSelect';
import { getFieldLabel, getEnumValueLabel } from '../i18n/fieldLabels';
import { type FieldMeta } from '../utils/api';

export function FieldRenderer({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const intl = useIntl();
  if (field.hidden) return null;
  const label = getFieldLabel(intl, field.name);

  switch (field.type) {
    case 'text':
      return (
        <FormField label={label} required={field.required}>
          <Textarea
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
        <FormField label={label} required={field.required}>
          <NumberInput
            value={value ?? ''}
            onChange={(_, valueAsNumber) => onChange(Number.isNaN(valueAsNumber) ? undefined : valueAsNumber)}
          >
            <NumberInputField />
          </NumberInput>
        </FormField>
      );
    case 'boolean':
      return (
        <FormField label={label} required={field.required}>
          <Switch
            isChecked={Boolean(value)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
          />
        </FormField>
      );
    case 'date':
      return (
        <FormField label={label} required={field.required}>
          <Input
            type="date"
            value={value ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value || null)}
          />
        </FormField>
      );
    case 'datetime':
      return (
        <FormField label={label} required={field.required}>
          <Input
            type="datetime-local"
            value={value ? toDateTimeLocal(value) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </FormField>
      );
    case 'enumeration':
      return (
        <FormField label={label} required={field.required}>
          <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {(field.values ?? []).map((opt) => (
              <option key={opt} value={opt}>{getEnumValueLabel(intl, opt)}</option>
            ))}
          </Select>
        </FormField>
      );
    case 'relation':
      return <RelationSelect field={field} value={value} onChange={onChange} />;
    default:
      return (
        <FormField label={label} required={field.required}>
          <Input
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
