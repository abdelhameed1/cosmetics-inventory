import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Field, Flex, Grid, Typography, NumberInput, DatePicker,
  SingleSelect, SingleSelectOption,
} from '@strapi/design-system';
import { useApi } from '../utils/api';

function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function StockPurchase() {
  const api = useApi();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [qty, setQty] = useState<number | undefined>();
  const [cost, setCost] = useState<number | undefined>();
  const [purchaseDate, setPurchaseDate] = useState<string | null>(null);
  const [productionDate, setProductionDate] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    api.get<{ results: any[] }>('/resources/suppliers', { pageSize: 100 }).then((d) => setSuppliers(d.results));
  }, []);

  useEffect(() => {
    if (!productId) { setVariants([]); return; }
    api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 }).then((d) =>
      setVariants(d.results.filter((v) => v.product?.documentId === productId))
    );
    setVariantId('');
  }, [productId]);

  const submit = async () => {
    setError(null);
    try {
      await api.post('/resources/stock-batches', {
        quantityPurchased: qty,
        costPriceUsd: cost,
        purchaseDate,
        productionDate,
        expiryDate,
        variant: variantId,
        supplier: supplierId,
      });
      navigate('/plugins/inventory-dashboard/r/stock-batches');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not record purchase');
    }
  };

  return (
    <Box padding={8}>
      <Typography variant="alpha">Record stock purchase</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}
      <Box paddingTop={6}>
        <Grid.Root gap={4}>
          <Grid.Item col={4}>
            <Field.Root name="product">
              <Field.Label>Product</Field.Label>
              <SingleSelect value={productId} onChange={(v) => setProductId(String(v))}>
                {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="variant">
              <Field.Label>Variant</Field.Label>
              <SingleSelect value={variantId} onChange={(v) => setVariantId(String(v))} disabled={!productId}>
                {variants.map((v) => <SingleSelectOption key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="supplier">
              <Field.Label>Supplier</Field.Label>
              <SingleSelect value={supplierId} onChange={(v) => setSupplierId(String(v))}>
                {suppliers.map((s) => <SingleSelectOption key={s.documentId} value={s.documentId}>{s.name}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="qty">
              <Field.Label>Quantity purchased</Field.Label>
              <NumberInput value={qty} onValueChange={setQty} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="cost">
              <Field.Label>Cost price (USD)</Field.Label>
              <NumberInput value={cost} onValueChange={setCost} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4} />
          <Grid.Item col={4}>
            <Field.Root name="purchaseDate">
              <Field.Label>Purchase date</Field.Label>
              <DatePicker
                value={purchaseDate ? parseLocalDate(purchaseDate) : undefined}
                onChange={(d?: Date) => setPurchaseDate(d ? formatLocalDate(d) : null)}
              />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="productionDate">
              <Field.Label>Production date</Field.Label>
              <DatePicker
                value={productionDate ? parseLocalDate(productionDate) : undefined}
                onChange={(d?: Date) => setProductionDate(d ? formatLocalDate(d) : null)}
              />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="expiryDate">
              <Field.Label>Expiry date</Field.Label>
              <DatePicker
                value={expiryDate ? parseLocalDate(expiryDate) : undefined}
                onChange={(d?: Date) => setExpiryDate(d ? formatLocalDate(d) : null)}
              />
            </Field.Root>
          </Grid.Item>
        </Grid.Root>
      </Box>
      <Flex gap={2} paddingTop={6}>
        <Button onClick={submit} disabled={!variantId || !supplierId || !qty || !cost || !purchaseDate}>
          Record purchase
        </Button>
      </Flex>
    </Box>
  );
}
