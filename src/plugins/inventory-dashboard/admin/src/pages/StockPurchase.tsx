import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';

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
    <Box p={8}>
      <PageHeader title="Record stock purchase" />
      {error && <Text color="red.600" pb={2}>{error}</Text>}
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Product">
                <Select bg="white" value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="Select product">
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Variant">
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
              <FormField label="Supplier">
                <Select bg="white" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} placeholder="Select supplier">
                  {suppliers.map((s) => <option key={s.documentId} value={s.documentId}>{s.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Quantity purchased">
                <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Cost price (USD)">
                <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField bg="white" />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={4} />
            <GridItem colSpan={4}>
              <FormField label="Purchase date">
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
          <HStack spacing={2} pt={6}>
            <Button onClick={submit} isDisabled={!variantId || !supplierId || !qty || !cost || !purchaseDate}>
              Record purchase
            </Button>
          </HStack>
        </CardBody>
      </Card>
    </Box>
  );
}
