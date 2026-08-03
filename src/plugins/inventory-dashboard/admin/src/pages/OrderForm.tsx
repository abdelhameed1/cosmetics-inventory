// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay,
  Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { useLocale } from '../i18n/LocaleProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { orderStatusToSeverity } from '../utils/orderStatus';

interface DraftLine {
  variantDocumentId: string;
  variantLabel: string;
  stockBatchDocumentId: string;
  costPriceUsd: number;
  quantitySold: number;
  sellPrice: number;
}

function formatLocalDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface OrderFormProps {
  onDone?: () => void;
  onCancel?: () => void;
  embedded?: boolean;
}

export default function OrderForm({ onDone, onCancel, embedded = false }: OrderFormProps = {}) {
  const params = useParams();
  // When embedded (e.g. inside the Add New modal, which is mounted alongside
  // whatever page is currently active), useParams() would otherwise pick up an
  // unrelated `:id` from the ambient route — always force "new order" mode.
  const id = embedded ? undefined : params.id;
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { order, reload, confirm, cancel } = useOrder(id);

  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [orderDate, setOrderDate] = useState<string | null>(formatLocalDate(new Date()));
  const [discount, setDiscount] = useState<number | undefined>(0);
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addVariantId, setAddVariantId] = useState('');
  const [addQty, setAddQty] = useState<number | undefined>(1);
  const [relatedSuggestions, setRelatedSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isConfirmed = order && order.status !== 'draft';

  useEffect(() => {
    api.get<{ results: any[] }>('/resources/customers', { pageSize: 100 }).then((d) => setCustomers(d.results));
    api.get<{ results: any[] }>('/resources/products', { pageSize: 100 }).then((d) => setProducts(d.results));
    api.get<{ results: any[] }>('/resources/variants', { pageSize: 100 }).then((d) => setVariants(d.results));
  }, []);

  // auto-fill price list from selected customer
  useEffect(() => {
    const c = customers.find((x) => x.documentId === customerId);
    if (c?.priceList?.documentId) setPriceListId(c.priceList.documentId);
  }, [customerId, customers]);

  const variantsForProduct = variants.filter((v) => v.product?.documentId === addProductId);
  const defaultVariantLabel = intl.formatMessage({ id: 'orderForm.defaultVariantLabel', defaultMessage: 'Default' });

  const addLine = async () => {
    if (!addVariantId || !priceListId) return;
    setError(null);
    // FIFO segments for the chosen variant + quantity
    const fifo = await api.get<{ segments: any[]; shortfall: number }>(
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) {
      setError(intl.formatMessage(
        { id: 'orderForm.shortfallError', defaultMessage: 'Not enough stock: short by {count} unit(s).' },
        { count: fifo.shortfall }
      ));
    }

    const variant = variants.find((v) => v.documentId === addVariantId);
    const newLines: DraftLine[] = [];
    for (const seg of fifo.segments) {
      // suggested sell price via the pricing endpoint (POST /pricing/suggest).
      // Pass the TOTAL requested quantity (not this segment's own quantityFromBatch)
      // so a wholesale minQty threshold is evaluated against the whole order, not
      // artificially failed when FIFO happens to split it across several batches.
      const priced = await getSuggestedPrice(api, priceListId, seg.costPriceUsd, addQty ?? 1);
      newLines.push({
        variantDocumentId: addVariantId,
        variantLabel: variant?.label ?? defaultVariantLabel,
        stockBatchDocumentId: seg.batchDocumentId,
        costPriceUsd: seg.costPriceUsd,
        quantitySold: seg.quantityFromBatch,
        sellPrice: priced,
      });
    }
    setDraftLines((prev) => [...prev, ...newLines]);

    // cross-sell suggestions from the product's relatedProducts
    const product = products.find((p) => p.documentId === addProductId);
    if (product?.relatedProducts?.length) setRelatedSuggestions(product.relatedProducts);
  };

  const exchangeRate = order?.exchangeRate ?? 0;
  const subtotal = draftLines.reduce((s, l) => s + l.sellPrice * l.quantitySold, 0);
  const finalTotal = subtotal - (discount ?? 0);

  const saveDraft = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      // create order header
      const created = await api.post<any>('/resources/orders', {
        orderDate, status: 'draft', discountAmount: discount ?? 0,
        customer: customerId, priceList: priceListId,
      });
      // create lines
      for (const l of draftLines) {
        await api.post('/resources/order-lines', {
          quantitySold: l.quantitySold, sellPrice: l.sellPrice,
          order: created.documentId, stockBatch: l.stockBatchDocumentId,
        });
      }
      navigate(`/plugins/inventory-dashboard/orders/${created.documentId}`);
      onDone?.();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.saveDraftError', defaultMessage: 'Could not save order' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    try { await confirm(); reload(); }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.confirmError', defaultMessage: 'Could not confirm order' })); }
  };

  // ----- confirmed view (read-only lines + payments) -----
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} cancel={cancel} />;
  }

  const customerStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={5}>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <QuickCreateSelect
              resource="customers"
              label={intl.formatMessage({ id: 'field.customer', defaultMessage: 'Customer' })}
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers}
              onCreated={(c) => setCustomers((prev) => [...prev, c])}
            />
          </GridItem>
          <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
            <FormField label={intl.formatMessage({ id: 'orderForm.orderDateLabel', defaultMessage: 'Order date' })}>
              <Input type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
        {intl.formatMessage({ id: 'orderForm.addProductTitle', defaultMessage: 'Add product' })}
      </Text>
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={5}>
            <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
              <FormField label={intl.formatMessage({ id: 'field.product', defaultMessage: 'Product' })}>
                <Select
                  value={addProductId}
                  onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectProductPlaceholder', defaultMessage: 'Select product' })}
                >
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
              <FormField label={intl.formatMessage({ id: 'orderForm.variantFieldLabel', defaultMessage: 'Variant' })}>
                <Select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  isDisabled={!addProductId}
                  placeholder={intl.formatMessage({ id: 'orderForm.selectVariantPlaceholder', defaultMessage: 'Select variant' })}
                >
                  {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? defaultVariantLabel}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 3 }}>
              <FormField label={intl.formatMessage({ id: 'orderForm.quantityLabel', defaultMessage: 'Quantity' })}>
                <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={{ base: 12, sm: 6, md: 1 }} display="flex" alignItems="flex-end">
              <Button onClick={addLine} isDisabled={!addVariantId}>
                {intl.formatMessage({ id: 'orderForm.addButton', defaultMessage: 'Add' })}
              </Button>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="accent.bg" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">
            {intl.formatMessage({ id: 'orderForm.crossSellLabel', defaultMessage: 'Customers also buy:' })}&nbsp;
          </Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              me={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'orderForm.col.batch', defaultMessage: 'Batch' }),
            intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            intl.formatMessage({ id: 'orderForm.col.costEgp', defaultMessage: 'Cost EGP' }),
            intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
          ]}
          isEmpty={draftLines.length === 0}
          emptyLabel={intl.formatMessage({ id: 'orderForm.lineItemsEmptyLabel', defaultMessage: 'No line items yet.' })}
        >
          {draftLines.map((l, i) => {
            const costEgp = l.costPriceUsd * exchangeRate;
            const below = l.sellPrice < costEgp;
            return (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.stockBatchDocumentId.slice(0, 6)}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>
                  <NumberInput
                    size="sm"
                    value={l.sellPrice}
                    onChange={(_, v) =>
                      setDraftLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, sellPrice: Number.isNaN(v) ? 0 : v } : x)))}
                  >
                    <NumberInputField aria-label={intl.formatMessage({ id: 'orderForm.sellAria', defaultMessage: 'sell' })} />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>
                  {below ? (
                    <SeverityBadge severity="critical">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</SeverityBadge>
                  ) : null}
                </Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={5} pt={6}>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }}>
          <FormField label={intl.formatMessage({ id: 'orderForm.discountLabel', defaultMessage: 'Discount (EGP)' })}>
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display="flex" alignItems="flex-end">
          <Text>{intl.formatMessage({ id: 'orderForm.subtotalLabel', defaultMessage: 'Subtotal:' })} {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={{ base: 12, sm: 6, md: 4 }} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">
            {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
          </Text>
        </GridItem>
      </Grid>
    </Box>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.customerLabel', defaultMessage: 'Customer:' })}</b> {customers.find((c) => c.documentId === customerId)?.name ?? '—'}</Text>
        <Text><b>{intl.formatMessage({ id: 'orderForm.review.orderDateLabel', defaultMessage: 'Order date:' })}</b> {orderDate ?? '—'}</Text>
        <Box pt={4}>
          <DataTable
            columns={[
              intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
              intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
              intl.formatMessage({ id: 'orderForm.col.sellEgp', defaultMessage: 'Sell (EGP)' }),
            ]}
            isEmpty={draftLines.length === 0}
            emptyLabel={intl.formatMessage({ id: 'orderForm.lineItemsEmptyLabel', defaultMessage: 'No line items yet.' })}
          >
            {draftLines.map((l, i) => (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice.toFixed(2)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Box>
        <Text pt={4}>
          <b>{intl.formatMessage({ id: 'orderForm.review.discountLabel', defaultMessage: 'Discount:' })}</b> {(discount ?? 0).toFixed(2)} EGP
        </Text>
        <Text fontSize="lg" fontWeight="semibold">
          {intl.formatMessage({ id: 'orderForm.totalLabel', defaultMessage: 'Total:' })} {finalTotal.toFixed(2)} EGP
        </Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    {
      label: intl.formatMessage({ id: 'orderForm.step.customerDate', defaultMessage: 'Customer & Date' }),
      content: customerStep,
      isValid: () => Boolean(customerId),
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.lineItems', defaultMessage: 'Line Items' }),
      content: lineItemsStep,
      isValid: () => draftLines.length > 0,
    },
    {
      label: intl.formatMessage({ id: 'orderForm.step.review', defaultMessage: 'Review' }),
      content: reviewStep,
      isValid: () => true,
    },
  ];

  return (
    <Box p={embedded ? 0 : { base: 5, md: 10 }}>
      {!embedded && <PageHeader title={intl.formatMessage({ id: 'orderForm.pageTitle', defaultMessage: 'New order' })} />}
      {error && !isSubmitting && draftLines.length === 0 && <Text color="severity.critical.fg" pb={2}>{error}</Text>}
      <WizardShell
        steps={steps}
        onSubmit={saveDraft}
        submitLabel={intl.formatMessage({ id: 'orderForm.saveDraftButton', defaultMessage: 'Save draft' })}
        isSubmitting={isSubmitting}
        submitError={error}
      />
      <HStack spacing={2} pt={4}>
        <Button
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate('/plugins/inventory-dashboard/r/orders'))}
          isDisabled={isSubmitting}
        >
          {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
        </Button>
        {id && (
          <Button colorScheme="green" onClick={onConfirm}>
            {intl.formatMessage({ id: 'orderForm.confirmOrderButton', defaultMessage: 'Confirm order' })}
          </Button>
        )}
      </HStack>
    </Box>
  );
}

async function getSuggestedPrice(api: any, priceListDocumentId: string, costPriceUsd: number, quantity: number): Promise<number> {
  try {
    const r = await api.post('/pricing/suggest', { priceListDocumentId, costPriceUsd, quantity });
    return r.sellPrice;
  } catch {
    return 0;
  }
}


function ConfirmedOrderView({
  order, reload, api, cancel,
}: { order: any; reload: () => void; api: any; cancel: () => Promise<any> }) {
  const intl = useIntl();
  const { locale } = useLocale();
  const [amount, setAmount] = useState<number | undefined>(0);
  const [method, setMethod] = useState('cash');
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount: amount ?? 0, method, paymentDate: formatLocalDate(new Date()), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  const canCancel = order.status === 'confirmed' || order.status === 'partially_paid';

  const onCancelOrder = async () => {
    setCancelError(null);
    setIsCancelling(true);
    try {
      await cancel();
    } catch (e: any) {
      setCancelError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'orderForm.confirmed.cancelError', defaultMessage: 'Could not cancel order' }));
    } finally {
      setIsCancelling(false);
      setIsCancelOpen(false);
    }
  };

  return (
    <Box p={{ base: 5, md: 10 }}>
      <PageHeader
        title={intl.formatMessage({ id: 'orderForm.confirmed.orderTitle', defaultMessage: 'Order {id}' }, { id: order.documentId.slice(0, 8) })}
        badge={<SeverityBadge severity={orderStatusToSeverity(order.status)} fontSize="sm">{order.status}</SeverityBadge>}
        actions={canCancel && (
          <Button colorScheme="red" variant="outline" size="sm" onClick={() => setIsCancelOpen(true)} isDisabled={isCancelling}>
            {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
          </Button>
        )}
      />
      {cancelError && <Text color="severity.critical.fg" pb={4}>{cancelError}</Text>}

      <DataTable
        columns={[
          intl.formatMessage({ id: 'orderForm.col.variant', defaultMessage: 'Variant' }),
          intl.formatMessage({ id: 'orderForm.col.qty', defaultMessage: 'Qty' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.sell', defaultMessage: 'Sell' }),
          intl.formatMessage({ id: 'orderForm.confirmed.col.costUsdSnap', defaultMessage: 'Cost USD snap' }),
          intl.formatMessage({ id: 'orderForm.col.flag', defaultMessage: 'Flag' }),
        ]}
        isEmpty={order.lines.length === 0}
        emptyLabel={intl.formatMessage({ id: 'orderForm.lineItemsEmptyLabel', defaultMessage: 'No line items yet.' })}
      >
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>
              {l.belowCost ? (
                <SeverityBadge severity="critical">{intl.formatMessage({ id: 'orderForm.belowCostBadge', defaultMessage: 'Below cost' })}</SeverityBadge>
              ) : null}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" color="text.primary">
          {intl.formatMessage({ id: 'orderForm.confirmed.totalsTitle', defaultMessage: 'Totals' })}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.totalsSummary', defaultMessage: 'Subtotal: {subtotal} | Final: {final} | Profit: {profit}' },
            { subtotal: order.totals.subtotal, final: order.totals.finalTotal, profit: order.totals.netProfit }
          )}
        </Text>
        <Text>
          {intl.formatMessage(
            { id: 'orderForm.confirmed.paymentSummary', defaultMessage: 'Paid: {paid} | Balance due: {due}' },
            { paid: order.totals.totalPaid, due: order.totals.balanceDue }
          )}
        </Text>
      </Box>

      {order.status !== 'cancelled' && (
        <Box pt={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">
            {intl.formatMessage({ id: 'orderForm.confirmed.recordPaymentTitle', defaultMessage: 'Record payment' })}
          </Text>
          <Card>
            <CardBody>
              <HStack spacing={2} align="flex-end">
                <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.amountLabel', defaultMessage: 'Amount' })}>
                  <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                    <NumberInputField />
                  </NumberInput>
                </FormField>
                <FormField label={intl.formatMessage({ id: 'orderForm.confirmed.methodLabel', defaultMessage: 'Method' })}>
                  <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="cash">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodCash', defaultMessage: 'cash' })}</option>
                    <option value="transfer">{intl.formatMessage({ id: 'orderForm.confirmed.paymentMethodTransfer', defaultMessage: 'transfer' })}</option>
                  </Select>
                </FormField>
                <Button onClick={addPayment} isDisabled={!amount}>
                  {intl.formatMessage({ id: 'orderForm.confirmed.addPaymentButton', defaultMessage: 'Add payment' })}
                </Button>
              </HStack>
            </CardBody>
          </Card>
        </Box>
      )}

      <AlertDialog isOpen={isCancelOpen} leastDestructiveRef={cancelRef} onClose={() => setIsCancelOpen(false)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmTitle', defaultMessage: 'Cancel this order?' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmBody', defaultMessage: 'This restores any deducted stock and cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setIsCancelOpen(false)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={onCancelOrder} ms={3} isLoading={isCancelling}>
                {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
