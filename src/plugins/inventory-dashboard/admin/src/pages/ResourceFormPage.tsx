import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Flex, Grid, Typography } from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { FieldRenderer } from '../components/FieldRenderer';
import ProductVariantsForm from '../components/ProductVariantsForm';

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
    <Box padding={8}>
      <Typography variant="alpha">{isEdit ? `Edit ${resource}` : `New ${resource}`}</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid.Root gap={4}>
          {editableFields.map((f) => (
            <Grid.Item key={f.name} col={6} direction="column" alignItems="stretch">
              <FieldRenderer field={f} value={values[f.name]} onChange={(v) => setField(f.name, v)} />
            </Grid.Item>
          ))}
        </Grid.Root>
      </Box>
      <Flex gap={2} paddingTop={6}>
        <Button onClick={submit}>Save</Button>
        <Button variant="tertiary" onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}`)}>Cancel</Button>
      </Flex>
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
