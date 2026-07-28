import { useEffect, useState } from 'react';
import { Select } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { useApi, type FieldMeta } from '../utils/api';
import { getFieldLabel } from '../i18n/fieldLabels';

export function RelationSelect({
  field, value, onChange,
}: { field: FieldMeta; value: any; onChange: (v: any) => void }) {
  const api = useApi();
  const intl = useIntl();
  const [options, setOptions] = useState<any[]>([]);
  const targetSlug = field.relation?.resource;

  useEffect(() => {
    if (!targetSlug) return;
    api.get<{ results: any[] }>(`/resources/${targetSlug}`, { pageSize: 100 })
      .then((d) => setOptions(d.results))
      .catch(() => setOptions([]));
  }, [targetSlug]);

  const selected = value?.documentId ?? value ?? '';
  const label = getFieldLabel(intl, field.name);

  return (
    <FormField label={label} required={field.required}>
      <Select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        placeholder={intl.formatMessage({ id: 'relationSelect.placeholder', defaultMessage: 'Select {field}' }, { field: label })}
      >
        {options.map((o) => {
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
