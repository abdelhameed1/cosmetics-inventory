import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { getResourceLabel } from '../i18n/resourceLabels';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  const { data, isInitialLoading } = useAsyncResource<any>(
    () => (isEdit && resource ? api.get(`/resources/${resource}/${id}`) : Promise.resolve(null)),
    [isEdit, resource, id]
  );

  useEffect(() => {
    if (data) setValues(normalize(data));
  }, [data]);

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    try {
      const payload = serialize(values, editableFields);
      if (isEdit) {
        await api.put(`/resources/${resource}/${id}`, payload);
      } else {
        await api.post(`/resources/${resource}`, payload);
      }
      navigate('..', { relative: 'path' });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.saveFailed', defaultMessage: 'Save failed' }));
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('..', { relative: 'path' })} />;
  }

  if (isEdit && isInitialLoading) {
    return <LoadingState />;
  }

  const resourceLabel = getResourceLabel(intl, resource);

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader
        title={
          isEdit
            ? intl.formatMessage({ id: 'resourceForm.editTitle', defaultMessage: 'Edit {label}' }, { label: resourceLabel })
            : intl.formatMessage({ id: 'addNew.newItemTitle', defaultMessage: 'New {label}' }, { label: resourceLabel })
        }
      />
      {error && <Text color="severity.critical.fg" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            {editableFields.map((f) => (
              <GridItem key={f.name} colSpan={{ base: 12, md: 6 }}>
                <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
              </GridItem>
            ))}
          </Grid>
        </CardBody>
      </Card>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit}>{intl.formatMessage({ id: 'common.save', defaultMessage: 'Save' })}</Button>
        <Button variant="ghost" onClick={() => navigate('..', { relative: 'path' })}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
      </HStack>
    </Box>
  );
}

function normalize(rec: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(rec ?? {})) {
    out[k] = v && typeof v === 'object' && 'documentId' in (v as any) ? (v as any).documentId : v;
  }
  return out;
}

function serialize(values: Record<string, any>, fields: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (values[f.name] === undefined) continue;
    out[f.name] = values[f.name];
  }
  return out;
}
