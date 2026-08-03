// src/plugins/inventory-dashboard/admin/src/components/ProductVariantsForm.tsx
import { useEffect, useState } from 'react';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, IconButton, Input, NumberInput, NumberInputField, Select, Td, Text, Tr } from '@chakra-ui/react';
import { FiTrash2 } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from './ui/PageHeader';
import { FormField } from './ui/FormField';
import { WizardShell, type WizardStep } from './WizardShell';
import { DataTable } from './ui/DataTable';
import { QuickCreateSelect } from './QuickCreateSelect';

interface VariantRow { label: string; variantTypeId: string; lowStockThreshold?: number; }

interface ProductVariantsFormProps {
  onDone: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function ProductVariantsForm({ onDone, onCancel, embedded = false }: ProductVariantsFormProps) {
  const api = useApi();
  const intl = useIntl();
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set once product creation succeeds, so a retry after a later failure
  // (variant creation / default-variant cleanup) does not re-create the product.
  const [savedProductId, setSavedProductId] = useState<string | null>(null);
  // How many explicit variants have been successfully created so far, so a
  // retry resumes from the next one instead of re-creating earlier ones.
  const [variantsCreatedCount, setVariantsCreatedCount] = useState(0);
  // Frozen at the moment the product is first created, so a retry after the
  // user navigates back and edits variant rows still resumes against exactly
  // what was decided at that point, not whatever `rows` currently contains.
  const [variantsSnapshot, setVariantsSnapshot] = useState<VariantRow[] | null>(null);

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

  const explicitVariants = rows.filter((r) => r.label.trim() || r.variantTypeId);

  const save = async () => {
    setError(null);
    // Only submit rows the user actually filled in. A non-default variant must
    // have a variant type (enforced by the variant lifecycle), so reject any
    // partially-filled row up front — otherwise the POST would throw mid-loop,
    // after the product and earlier variants are already persisted, leaving a
    // half-built product behind with no rollback.
    if (explicitVariants.some((r) => !r.variantTypeId)) {
      setError(intl.formatMessage({ id: 'productWizard.variantNeedsTypeError', defaultMessage: 'Each variant needs a type.' }));
      return;
    }
    setIsSubmitting(true);
    let productId = savedProductId;
    try {
      // 1) create product (auto-creates one default variant) — skipped on retry
      if (!productId) {
        const product = await api.post<any>('/resources/products', {
          name, brand: brandId, category: categoryId,
          relatedProducts: relatedIds,
        });
        productId = product.documentId;
        setSavedProductId(productId);
        setVariantsSnapshot(explicitVariants);
      }

      // 2) create explicit variants — on retry, resume after the ones already created,
      // against the snapshot taken when the product was created (not live `rows`)
      const toCreate = variantsSnapshot ?? explicitVariants;
      const remaining = toCreate.slice(variantsCreatedCount);
      for (const row of remaining) {
        await api.post('/resources/variants', {
          label: row.label,
          variantType: row.variantTypeId,
          lowStockThreshold: row.lowStockThreshold,
          isDefault: false,
          product: productId,
        });
        setVariantsCreatedCount((n) => n + 1);
      }

      // 3) if explicit variants exist, delete the auto-created default
      // (idempotent: if already deleted by a prior attempt, `auto` is simply not found)
      if (toCreate.length > 0) {
        const all = await api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 });
        const auto = all.results.find(
          (v) => v.product?.documentId === productId && v.isDefault
        );
        if (auto) await api.del(`/resources/variants/${auto.documentId}`);
      }

      onDone();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ??
          (productId
            ? intl.formatMessage({
                id: 'productWizard.partialSaveError',
                defaultMessage: 'Product was saved, but a later step failed. Click "Retry remaining steps" to continue.',
              })
            : intl.formatMessage({ id: 'productWizard.createError', defaultMessage: 'Could not create product' }))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const nameLabel = intl.formatMessage({ id: 'field.name', defaultMessage: 'Name' });
  const brandLabel = intl.formatMessage({ id: 'field.brand', defaultMessage: 'Brand' });
  const categoryLabel = intl.formatMessage({ id: 'field.category', defaultMessage: 'Category' });
  const rowLabelLabel = intl.formatMessage({ id: 'field.label', defaultMessage: 'Label' });
  const variantTypeLabel = intl.formatMessage({ id: 'field.variantType', defaultMessage: 'Variant Type' });
  const lowStockThresholdLabel = intl.formatMessage({ id: 'field.lowStockThreshold', defaultMessage: 'Low-stock Threshold' });

  const productInfoStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={5}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={nameLabel} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="brands"
              label={brandLabel}
              required
              value={brandId}
              onChange={setBrandId}
              options={brands}
              onCreated={(b) => setBrands((prev) => [...prev, b])}
            />
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="categories"
              label={categoryLabel}
              required
              value={categoryId}
              onChange={setCategoryId}
              options={categories}
              onCreated={(c) => setCategories((prev) => [...prev, c])}
            />
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const variantsStep = (
    <Box>
      <HStack justify="space-between" pb={2}>
        <Text fontSize="sm" color="text.secondary">
          {intl.formatMessage({ id: 'productWizard.variantsHint', defaultMessage: 'Optional — leave empty to keep a single default variant.' })}
        </Text>
        <Button variant="outline" onClick={addRow}>
          {intl.formatMessage({ id: 'productWizard.addVariantButton', defaultMessage: 'Add variant' })}
        </Button>
      </HStack>
      {rows.length > 0 && (
        <Card>
          <CardBody>
            {rows.map((row, i) => (
              <Grid templateColumns="repeat(12, 1fr)" gap={5} key={i} pt={i === 0 ? 0 : 4}>
                <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
                  <FormField label={rowLabelLabel}>
                    <Input value={row.label} onChange={(e) => updateRow(i, { label: e.target.value })} />
                  </FormField>
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
                  <QuickCreateSelect
                    resource="variant-types"
                    label={variantTypeLabel}
                    value={row.variantTypeId}
                    onChange={(v) => updateRow(i, { variantTypeId: v })}
                    options={variantTypes}
                    onCreated={(t) => setVariantTypes((prev) => [...prev, t])}
                  />
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
                  <FormField label={lowStockThresholdLabel}>
                    <NumberInput
                      value={row.lowStockThreshold ?? ''}
                      onChange={(_, v) => updateRow(i, { lowStockThreshold: Number.isNaN(v) ? undefined : v })}
                    >
                      <NumberInputField />
                    </NumberInput>
                  </FormField>
                </GridItem>
                <GridItem colSpan={{ base: 12, sm: 6, md: 1 }} display="flex" alignItems="flex-end">
                  <IconButton
                    aria-label={intl.formatMessage({ id: 'productWizard.removeVariantAria', defaultMessage: 'Remove' })}
                    icon={<FiTrash2 />}
                    onClick={() => removeRow(i)}
                  />
                </GridItem>
              </Grid>
            ))}
          </CardBody>
        </Card>
      )}
    </Box>
  );

  const relatedStep = (
    <Card>
      <CardBody>
        <FormField label={intl.formatMessage({ id: 'productWizard.addRelatedProductLabel', defaultMessage: 'Add related product' })}>
          <Select
            value=""
            onChange={(e) => setRelatedIds((ids) => (ids.includes(e.target.value) ? ids : [...ids, e.target.value]))}
            placeholder={intl.formatMessage({ id: 'productWizard.selectProductPlaceholder', defaultMessage: 'Select product' })}
          >
            {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
          </Select>
        </FormField>
        <Box pt={2}>
          {relatedIds.map((id) => {
            const p = products.find((x) => x.documentId === id);
            return <Text key={id} display="inline-block" pe={2}>{p?.name ?? id}</Text>;
          })}
        </Box>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Box>
      <Card>
        <CardBody>
          <Text><b>{intl.formatMessage({ id: 'productWizard.review.nameLabel', defaultMessage: 'Name:' })}</b> {name || '—'}</Text>
          <Text><b>{intl.formatMessage({ id: 'productWizard.review.brandLabel', defaultMessage: 'Brand:' })}</b> {brands.find((b) => b.documentId === brandId)?.name ?? '—'}</Text>
          <Text><b>{intl.formatMessage({ id: 'productWizard.review.categoryLabel', defaultMessage: 'Category:' })}</b> {categories.find((c) => c.documentId === categoryId)?.name ?? '—'}</Text>
          <Text pt={2}>
            <b>{intl.formatMessage({ id: 'productWizard.review.relatedProductsLabel', defaultMessage: 'Related products:' })}</b>{' '}
            {relatedIds.length === 0
              ? intl.formatMessage({ id: 'productWizard.review.none', defaultMessage: 'None' })
              : relatedIds.map((id) => products.find((p) => p.documentId === id)?.name ?? id).join(', ')}
          </Text>
        </CardBody>
      </Card>
      <Box pt={4}>
        <Text fontSize="sm" fontWeight="semibold" color="text.primary" pb={2}>
          {intl.formatMessage({ id: 'productWizard.review.variantsLabel', defaultMessage: 'Variants:' })}
        </Text>
        <DataTable
          columns={[rowLabelLabel, variantTypeLabel, lowStockThresholdLabel]}
          isEmpty={explicitVariants.length === 0}
          emptyLabel={intl.formatMessage({ id: 'productWizard.review.singleDefaultVariant', defaultMessage: 'Single default variant' })}
        >
          {explicitVariants.map((r, i) => (
            <Tr key={i}>
              <Td>{r.label || intl.formatMessage({ id: 'productWizard.review.unnamed', defaultMessage: '(unnamed)' })}</Td>
              <Td>{variantTypes.find((t) => t.documentId === r.variantTypeId)?.name ?? '—'}</Td>
              <Td>{r.lowStockThreshold ?? '—'}</Td>
            </Tr>
          ))}
        </DataTable>
      </Box>
    </Box>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'productWizard.step.productInfo', defaultMessage: 'Product Info' }),
      content: productInfoStep,
      isValid: () => Boolean(name && brandId && categoryId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.variants', defaultMessage: 'Variants' }),
      content: variantsStep,
      isValid: () => explicitVariants.every((r) => r.variantTypeId),
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.relatedProducts', defaultMessage: 'Related Products' }),
      content: relatedStep,
      isValid: () => true,
    },
    {
      label: intl.formatMessage({ id: 'productWizard.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 5, md: 10 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'productWizard.pageTitle', defaultMessage: 'New product' })} />}
      <WizardShell
        steps={steps}
        onSubmit={save}
        submitLabel={
          savedProductId
            ? intl.formatMessage({ id: 'productWizard.retryButton', defaultMessage: 'Retry remaining steps' })
            : intl.formatMessage({ id: 'productWizard.createButton', defaultMessage: 'Create product' })
        }
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <Button variant="ghost" mt={4} onClick={onCancel ?? onDone} isDisabled={isSubmitting}>
        {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
      </Button>
    </Box>
  );
}
