import { useEffect, useState } from 'react';
import { Field, SingleSelect, SingleSelectOption } from '@strapi/design-system';
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
    <Field.Root name={field.name} required={field.required}>
      <Field.Label>{field.name}</Field.Label>
      <SingleSelect
        value={selected}
        onChange={(v: string | number) => onChange(v)}
        placeholder={`Select ${field.name}`}
      >
        {options.map((o) => {
          const label = String(
            o[field.relation?.mainField ?? 'name'] ?? o.name ?? o.label ?? o.documentId ?? o.id
          );
          return (
            <SingleSelectOption key={o.documentId} value={o.documentId}>
              {label}
            </SingleSelectOption>
          );
        })}
      </SingleSelect>
    </Field.Root>
  );
}
