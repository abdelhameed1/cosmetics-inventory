import { Select } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { getFieldLabel } from '../i18n/fieldLabels';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const intl = useIntl();
  const targetSlug = field.relation?.resource;

  const { data: options } = useAsyncResource<any[]>(
    () =>
      targetSlug
        ? api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 }).then((d) => d.results)
        : Promise.resolve([]),
    [targetSlug]
  );

  const selected = value?.documentId ?? value ?? '';
  const label = getFieldLabel(intl, field.name);

  return (
    <FormField label={label} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={intl.formatMessage({ id: 'relationSelect.placeholder', defaultMessage: 'Select {field}' }, { field: label })}
      >
        {(options ?? []).map((o) => {
          const optionLabel = String(
            o[field.relation?.mainField ?? 'name'] ?? o.name ?? o.label ?? o.documentId ?? o.id
          );
          return (
            <option key={o.documentId} value={o.documentId}>
              {optionLabel}
            </option>
          );
        })}
      </Select>
    </FormField>
  );
}
