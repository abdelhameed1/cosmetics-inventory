import { useEffect, useState } from 'react';
import {
  Box, Button, Field, Flex, Grid, Typography, TextInput, NumberInput,
  SingleSelect, SingleSelectOption, IconButton,
} from '@strapi/design-system';
import { Trash } from '@strapi/icons';
import { useApi } from '../utils/api';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

export default function ProductVariantsForm({ onDone }: { onDone: () => void }) {
  const api = useApi();
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [variantTypes, setVariantTypes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [rows, setRows] = useState<VariantRow[]>([]);
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/brands', { pageSize: 100 }).then((d) => setBrands(d.results));
    api.get<{ results: any[] }>('/resources/categories', { pageSize: 100 }).then((d) => setCategories(d.results));
    api.get<{ results: any[] }>('/resources/variant-types', { pageSize: 100 }).then((d) => setVariantTypes(d.results));
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addRow = () => setRows((r) => [...r, { label: '', variantTypeId: '' }]);
  const updateRow = (i: number, patch: Partial<VariantRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError('Each variant needs a type.');
      return;
    }
    try {
      // 1) create product (auto-creates one default variant)
      const product = await api.post<any>('/resources/products', {
        name, brand: brandId, category: categoryId,
        relatedProducts: relatedIds,
      });

      // 2) create explicit variants
      for (const row of explicitVariants) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: product.documentId,
        });
      }

      // 3) if explicit variants exist, delete the auto-created default
      if (explicitVariants.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === product.documentId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not create product');
    }
  };

  return (
    <Box padding={8}>
      <Typography variant="alpha">New product</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid.Root gap={4}>
          <Grid.Item col={4} direction="column" alignItems="stretch">
            <Field.Root name="name">
              <Field.Label>Name</Field.Label>
              <TextInput value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4} direction="column" alignItems="stretch">
            <Field.Root name="brand">
              <Field.Label>Brand</Field.Label>
              <SingleSelect value={brandId} onChange={(v) => setBrandId(String(v))}>
                {brands.map((b) => <SingleSelectOption key={b.documentId} value={b.documentId}>{b.name}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4} direction="column" alignItems="stretch">
            <Field.Root name="category">
              <Field.Label>Category</Field.Label>
              <SingleSelect value={categoryId} onChange={(v) => setCategoryId(String(v))}>
                {categories.map((c) => <SingleSelectOption key={c.documentId} value={c.documentId}>{c.name}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
        </Grid.Root>
      </Box>

      <Box paddingTop={6}>
        <Flex justifyContent="space-between">
          <Typography variant="beta">Variants (optional)</Typography>
          <Button variant="secondary" onClick={addRow}>Add variant</Button>
        </Flex>
        {rows.map((row, i) => (
          <Grid.Root gap={4} key={i} paddingTop={2}>
            <Grid.Item col={4} direction="column" alignItems="stretch">
              <Field.Root name={`label-${i}`}>
                <Field.Label>Label</Field.Label>
                <TextInput
                  value={row.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateRow(i, { label: e.target.value })}
                />
              </Field.Root>
            </Grid.Item>
            <Grid.Item col={4} direction="column" alignItems="stretch">
              <Field.Root name={`type-${i}`}>
                <Field.Label>Type</Field.Label>
                <SingleSelect value={row.variantTypeId} onChange={(v) => updateRow(i, { variantTypeId: String(v) })}>
                  {variantTypes.map((t) => <SingleSelectOption key={t.documentId} value={t.documentId}>{t.name}</SingleSelectOption>)}
                </SingleSelect>
              </Field.Root>
            </Grid.Item>
            <Grid.Item col={3} direction="column" alignItems="stretch">
              <Field.Root name={`threshold-${i}`}>
                <Field.Label>Low-stock threshold</Field.Label>
                <NumberInput
                  value={row.lowStockThreshold}
                  onValueChange={(v: number | undefined) => updateRow(i, { lowStockThreshold: v })}
                />
              </Field.Root>
            </Grid.Item>
            <Grid.Item col={1} direction="column" alignItems="stretch">
              <IconButton label="Remove" onClick={() => removeRow(i)}>
                <Trash />
              </IconButton>
            </Grid.Item>
          </Grid.Root>
        ))}
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Related products (cross-sell)</Typography>
        <Field.Root name="relatedProducts">
          <Field.Label>Add related product</Field.Label>
          <SingleSelect
            value=""
            onChange={(v) => setRelatedIds((ids) => (ids.includes(String(v)) ? ids : [...ids, String(v)]))}
          >
            {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
          </SingleSelect>
        </Field.Root>
        <Box paddingTop={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Typography key={id}>{p?.name ?? id} </Typography>;
          })}
        </Box>
      </Box>

      <Flex gap={2} paddingTop={6}>
        <Button onClick={save} disabled={!name || !brandId || !categoryId}>Create product</Button>
        <Button variant="tertiary" onClick={onDone}>Cancel</Button>
      </Flex>
    </Box>
  );
}
