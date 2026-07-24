import { useEffect, useState } from 'react';
import { Select } from '@chakra-ui/react';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const [options, setOptions] = useState<any[]>([]);
  const targetSlug = field.relation?.resource;

  useEffect(() => {
    if (!targetSlug) return;
    api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 })
      .then((d) => setOptions(d.results))
      .catch(() => setOptions([]));
  }, [targetSlug]);

  const selected = value?.documentId ?? value ?? '';

  return (
    <FormField label={field.name} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Select ${field.name}`}
      >
        {options.map((o) => {
          const label = String(
            o[field.relation?.mainField ?? 'name'] ?? o.name ?? o.label ?? o.documentId ?? o.id
          );
          return (
            <option key={o.documentId} value={o.documentId}>
              {label}
            </option>
          );
        })}
      </Select>
    </FormField>
  );
}
