import { useEffect, useState } from 'react';
import { Box, Button, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';

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
    <Box p={8}>
      <PageHeader title="New product" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Grid templateColumns="repeat(12, 1fr)" gap={4}>
        <GridItem colSpan={4}>
          <FormField label="Name">
            <Input bg="white" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Brand">
            <Select bg="white" value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="Select brand">
              {brands.map((b) => <option key={b.documentId} value={b.documentId}>{b.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
        <GridItem colSpan={4}>
          <FormField label="Category">
            <Select bg="white" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} placeholder="Select category">
              {categories.map((c) => <option key={c.documentId} value={c.documentId}>{c.name}</option>)}
            </Select>
          </FormField>
        </GridItem>
      </Grid>

      <Box pt={6}>
        <HStack justify="space-between">
          <Text fontSize="lg" fontWeight="semibold">Variants (optional)</Text>
          <Button variant="outline" onClick={addRow}>Add variant</Button>
        </HStack>
        {rows.map((row, i) => (
          <Grid templateColumns="repeat(12, 1fr)" gap={4} key={i} pt={2}>
            <GridItem colSpan={4}>
              <FormField label="Label">
                <Input bg="white" value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Type">
                <Select
                  bg="white"
                  value={row.variantTypeId}
                  onChange={(e) => updateRow(i, { variantTypeId: e.target.value })}
                  placeholder="Select type"
                >
                  {variantTypes.map((t) => <option key={t.documentId} value={t.documentId}>{t.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={3}>
              <FormField label="Low-stock threshold">
                <NumberInput
                  value={row.lowStockThreshold ?? ''}
                  onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                >
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={1} display="flex" alignItems="flex-end">
              <IconButton aria-label="Remove" icon={<FiTrash2 />} onClick={() => removeRow(i)} />
            </GridItem>
          </Grid>
        ))}
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2}>Related products (cross-sell)</Text>
        <FormField label="Add related product">
          <Select
            bg="white"
            value=""
            onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
            placeholder="Select product"
          >
            {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
          </Select>
        </FormField>
        <Box pt={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Text key={id} display="inline-block" pr={2}>{p?.name ?? id}</Text>;
          })}
        </Box>
      </Box>

      <HStack spacing={2} pt={6}>
        <Button onClick={save} isDisabled={!name || !brandId || !categoryId}>Create product</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </HStack>
    </Box>
  );
}
