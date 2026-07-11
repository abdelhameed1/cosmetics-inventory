import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Grid, GridItem, HStack, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';
import { PageHeader } from '../components/ui/PageHeader';

export default function ResourceFormPage() {
  const { resource = '', id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useApi();
  const { schema } = useSchema(resource);
  const [values, setValues] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const editableFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden),
    [schema]
  );

  useEffect(() => {
    if (isEdit && resource) {
      api.get(`/resources/${resource}/${id}`).then((rec) => setValues(normalize(rec)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, resource, id]);

  const setField = (name: string, v: any) => setValues((prev) => ({ ...prev, [name]: v }));

  const submit = async () => {
    try {
      const payload = serialize(values, editableFields);
      if (isEdit) {
        await api.put(`/resources/${resource}/${id}`, payload);
      } else {
        await api.post(`/resources/${resource}`, payload);
      }
      navigate(`/plugins/inventory-dashboard/r/${resource}`);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Save failed');
    }
  };

  // Bespoke product-with-variants flow on create
  if (resource === 'products' && !isEdit) {
    return <ProductVariantsForm onDone={() => navigate('/plugins/inventory-dashboard/r/products')} />;
  }

  return (
    <Box p={8}>
      <PageHeader title={isEdit ? `Edit ${resource}` : `New ${resource}`} />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        {editableFields.map((f) => (
          <GridItem key={f.name} colSpan={6}>
            <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
          </GridItem>
        ))}
      </Grid>
      <HStack spacing={2} pt={6}>
        <Button onClick={submit}>Save</Button>
        <Button variant="ghost" onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}`)}>Cancel</Button>
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
