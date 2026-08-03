import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardBody, Grid, GridItem, Input, NumberInput, NumberInputField, Select, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

interface StockPurchaseProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function StockPurchase({ onDone, onCancel, embedded = false }: StockPurchaseProps = {}) {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();
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

  const defaultVariantLabel = intl.formatMessage({ id: 'stockPurchase.defaultVariantLabel', defaultMessage: 'Default' });

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
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'stockPurchase.saveError', defaultMessage: 'Could not record purchase' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const supplierStep = (
    <Card>
      <CardBody>
        <QuickCreateSelect
          resource="suppliers"
          label={intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' })}
          required
          value={supplierId}
          onChange={setSupplierId}
          options={suppliers}
          onCreated={(s) => setSuppliers((prev) => [...prev, s])}
        />
      </CardBody>
    </Card>
  );

  const productStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })} required>
              <Select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectProductPlaceholder', defaultMessage: 'Select product' })}
              >
                {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.variantFieldLabel', defaultMessage: 'Variant' })} required>
              <Select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                isDisabled={!productId}
                placeholder={intl.formatMessage({ id: 'stockPurchase.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
              >
                {variants.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
              </Select>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.quantityPurchasedLabel', defaultMessage: 'Quantity purchased' })} required>
              <NumberInput value={qty ?? ''} onChange={(_, v) => setQty(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.costPriceLabel', defaultMessage: 'Cost price (USD)' })} required>
              <NumberInput value={cost ?? ''} onChange={(_, v) => setCost(Number.isNaN(v) ? undefined : v)}>
                <NumberInputField />
              </NumberInput>
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display={{ base: 'none', md: 'block' }} />
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.purchaseDateLabel', defaultMessage: 'Purchase date' })} required>
              <Input type="date" value={purchaseDate ?? ''} onChange={(e) => setPurchaseDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.productionDateLabel', defaultMessage: 'Production date' })}>
              <Input type="date" value={productionDate ?? ''} onChange={(e) => setProductionDate(e.target.value || null)} />
            </FormField>
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'stockPurchase.expiryDateLabel', defaultMessage: 'Expiry date' })}>
              <Input type="date" value={expiryDate ?? ''} onChange={(e) => setExpiryDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.supplierLabel', defaultMessage: 'Supplier:' })}</b> {suppliers.find((s) => s.documentId === supplierId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productLabel', defaultMessage: 'Product:' })}</b> {products.find((p) => p.documentId === productId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.variantLabel', defaultMessage: 'Variant:' })}</b> {variants.find((v) => v.documentId === variantId)?.label ?? defaultVariantLabel}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.quantityLabel', defaultMessage: 'Quantity:' })}</b> {qty ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.costPriceLabel', defaultMessage: 'Cost price (USD):' })}</b> {cost ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.purchaseDateLabel', defaultMessage: 'Purchase date:' })}</b> {purchaseDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.productionDateLabel', defaultMessage: 'Production date:' })}</b> {productionDate ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'stockPurchase.review.expiryDateLabel', defaultMessage: 'Expiry date:' })}</b> {expiryDate ?? '—'}</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'field.supplier', defaultMessage: 'Supplier' }),
      content: supplierStep,
      isValid: () => Boolean(supplierId),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.productQuantity', defaultMessage: 'Product & Quantity' }),
      content: productStep,
      isValid: () => Boolean(productId && variantId && qty && cost && purchaseDate),
    },
    {
      label: intl.formatMessage({ id: 'stockPurchase.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 5, md: 10 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'stockPurchase.pageTitle', defaultMessage: 'Record stock purchase' })} />}
      <WizardShell
        steps={steps}
        onSubmit={submit}
        submitLabel={intl.formatMessage({ id: 'stockPurchase.recordButton', defaultMessage: 'Record purchase' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      {onCancel && (
        <Button variant="ghost" mt={4} onClick={onCancel} isDisabled={isSubmitting}>
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
      )}
    </Box>
  );
}
