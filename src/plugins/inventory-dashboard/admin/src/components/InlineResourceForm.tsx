// src/plugins/inventory-dashboard/admin/src/components/InlineResourceForm.tsx
import { useMemo, useState } from 'react';
import { Box, Button, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from './FieldRenderer';

interface InlineResourceFormProps {
  resource: string;
  onDone: (created?: any) => void;
  onCancel?: () => void;
}

export function InlineResourceForm({ resource, onDone, onCancel }: InlineResourceFormProps) {
  const api = useApi();
  const intl = useIntl();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = serialize(values, editableFields);
      const created = await api.post<any>(`/resources/${resource}`, payload);
      onDone(created);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Save failed' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box>
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={{ base: 12, md: 6 }}>
            <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
          </GridItem>
        ))}
      </Grid>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit} isLoading={isSubmitting} isDisabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.save', defaultMessage: 'Save' })}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} isDisabled={isSubmitting}>
            {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
          </Button>
        )}
      </HStack>
    </Box>
  );
}

function serialize(values: Record<string, any>, fields: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (values[f.name] === undefined) continue;
    out[f.name] = values[f.name];
  }
  return out;
}
