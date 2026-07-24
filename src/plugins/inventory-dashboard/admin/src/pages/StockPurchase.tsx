import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';

interface StockPurchaseProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function StockPurchase({ onDone, onCancel, embedded = false }: StockPurchaseProps = {}) {
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
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
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
      onDone?.();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not record purchase');
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierStep = (
    <Card>
      <CardBody>
        <FormField label="Supplier" required>
          <Select bg="white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
            {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
          </Select>
        </FormField>
      </CardBody>
    </Card>
  );

  const productStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <FormField label="Product" required>
              <Select bg="white" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Variant" required>
              <Select
                bg="white"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                isDisabled={!productId}
                placeholder="Select variant"
              >
                {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Quantity purchased" required>
              <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField bg="white" />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Cost price (USD)" required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField bg="white" />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={4} />
          <GridItem colSpan={4}>
            <FormField label="Purchase date" required>
              <Input bg="white" type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Production date">
              <Input bg="white" type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Expiry date">
              <Input bg="white" type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>Supplier:</b> {suppliers.find((s) => s.documentId === supplierId)?.name ?? '—'}</Text>
        <Text><b>Product:</b> {products.find((p) => p.documentId === productId)?.name ?? '—'}</Text>
        <Text><b>Variant:</b> {variants.find((v) => v.documentId === variantId)?.label ?? 'Default'}</Text>
        <Text><b>Quantity:</b> {qty ?? '—'}</Text>
        <Text><b>Cost price (USD):</b> {cost ?? '—'}</Text>
        <Text><b>Purchase date:</b> {purchaseDate ?? '—'}</Text>
        <Text><b>Production date:</b> {productionDate ?? '—'}</Text>
        <Text><b>Expiry date:</b> {expiryDate ?? '—'}</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    { label: 'Supplier', content: supplierStep, isValid: () => Boolean(supplierId) },
    {
      label: 'Product & Quantity',
      content: productStep,
      isValid: () => Boolean(productId && variantId && qty && cost && purchaseDate),
    },
    { label: 'Review', content: reviewStep, isValid: () => true },
  ];

  return (
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title="Record stock purchase" />}
      <WizardShell steps={steps} onSubmit={submit} submitLabel="Record purchase" isSubmitting={isSubmitting} submitError={error} />
      {onCancel && (
        <Button variant="ghost" mt={4} onClick={onCancel} isDisabled={isSubmitting}>Cancel</Button>
      )}
    </Box>
  );
}
