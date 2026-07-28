// src/plugins/inventory-dashboard/admin/src/pages/OrderForm.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge, Box, Button, Card, CardBody, Grid, GridItem, HStack, Input, NumberInput, NumberInputField,
  Select, Td, Text, Tr,
} from '@chakra-ui/react';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';
import { PageHeader } from '../components/ui/PageHeader';
import { FormField } from '../components/ui/FormField';
import { DataTable } from '../components/ui/DataTable';
import { WizardShell, type WizardStep } from '../components/WizardShell';
import { QuickCreateSelect } from '../components/QuickCreateSelect';

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
  const { order, reload, confirm } = useOrder(id);

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

  const addLine = async () => {
    if (!addVariantId || !priceListId) return;
    setError(null);
    // FIFO segments for the chosen variant + quantity
    const fifo = await api.get<{ segments: any[]; shortfall: number }>(
      `/fifo/${addVariantId}`, { quantity: addQty ?? 1 }
    );
    if (fifo.shortfall > 0) setError(`Not enough stock: short by ${fifo.shortfall} unit(s).`);

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
        variantLabel: variant?.label ?? 'Default',
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
      setError(e?.response?.data?.error?.message ?? 'Could not save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirm = async () => {
    setError(null);
    try { await confirm(); reload(); }
    catch (e: any) { setError(e?.response?.data?.error?.message ?? 'Could not confirm order'); }
  };

  // ----- confirmed view (read-only lines + payments) -----
  if (isConfirmed) {
    return <ConfirmedOrderView order={order} reload={reload} api={api} />;
  }

  const customerStep = (
    <Card>
      <CardBody>
        <Grid templateColumns="repeat(12, 1fr)" gap={4}>
          <GridItem colSpan={4}>
            <QuickCreateSelect
              resource="customers"
              label="Customer"
              required
              value={customerId}
              onChange={setCustomerId}
              options={customers}
              onCreated={(c) => setCustomers((prev) => [...prev, c])}
            />
          </GridItem>
          <GridItem colSpan={4}>
            <FormField label="Order date">
              <Input type="date" value={orderDate ?? ''} onChange={(e) => setOrderDate(e.target.value || null)} />
            </FormField>
          </GridItem>
        </Grid>
      </CardBody>
    </Card>
  );

  const lineItemsStep = (
    <Box>
      <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">Add product</Text>
      <Card>
        <CardBody>
          <Grid templateColumns="repeat(12, 1fr)" gap={4}>
            <GridItem colSpan={4}>
              <FormField label="Product">
                <Select
                  value={addProductId}
                  onChange={(e) => { setAddProductId(e.target.value); setAddVariantId(''); }}
                  placeholder="Select product"
                >
                  {products.map((p) => <option key={p.documentId} value={p.documentId}>{p.name}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={4}>
              <FormField label="Variant">
                <Select
                  value={addVariantId}
                  onChange={(e) => setAddVariantId(e.target.value)}
                  isDisabled={!addProductId}
                  placeholder="Select variant"
                >
                  {variantsForProduct.map((v) => <option key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</option>)}
                </Select>
              </FormField>
            </GridItem>
            <GridItem colSpan={3}>
              <FormField label="Quantity">
                <NumberInput value={addQty ?? ''} onChange={(_, v) => setAddQty(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
            </GridItem>
            <GridItem colSpan={1} display="flex" alignItems="flex-end">
              <Button onClick={addLine} isDisabled={!addVariantId}>Add</Button>
            </GridItem>
          </Grid>
        </CardBody>
      </Card>

      {relatedSuggestions.length > 0 && (
        <Box mt={4} bg="accent.bg" p={3} borderRadius="lg">
          <Text as="span" fontSize="sm">Customers also buy:&nbsp;</Text>
          {relatedSuggestions.map((rp: any) => (
            <Button
              key={rp.documentId}
              variant="link"
              size="sm"
              mr={2}
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}
            >
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box pt={6}>
        <DataTable columns={['Variant', 'Batch', 'Qty', 'Sell (EGP)', 'Cost EGP', 'Flag']} isEmpty={draftLines.length === 0}>
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
                    <NumberInputField aria-label="sell" />
                  </NumberInput>
                </Td>
                <Td>{costEgp.toFixed(2)}</Td>
                <Td>{below ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
              </Tr>
            );
          })}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={6}>
        <GridItem colSpan={4}>
          <FormField label="Discount (EGP)">
            <NumberInput value={discount ?? ''} onChange={(_, v) => setDiscount(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text>Subtotal: {subtotal.toFixed(2)} EGP</Text>
        </GridItem>
        <GridItem colSpan={4} display="flex" alignItems="flex-end">
          <Text fontSize="lg" fontWeight="semibold">Total: {finalTotal.toFixed(2)} EGP</Text>
        </GridItem>
      </Grid>
    </Box>
  );

  const reviewStep = (
    <Card>
      <CardBody>
        <Text><b>Customer:</b> {customers.find((c) => c.documentId === customerId)?.name ?? '—'}</Text>
        <Text><b>Order date:</b> {orderDate ?? '—'}</Text>
        <Box pt={4}>
          <DataTable columns={['Variant', 'Qty', 'Sell (EGP)']} isEmpty={draftLines.length === 0}>
            {draftLines.map((l, i) => (
              <Tr key={i}>
                <Td>{l.variantLabel}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice.toFixed(2)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Box>
        <Text pt={4}><b>Discount:</b> {(discount ?? 0).toFixed(2)} EGP</Text>
        <Text fontSize="lg" fontWeight="semibold">Total: {finalTotal.toFixed(2)} EGP</Text>
      </CardBody>
    </Card>
  );

  const steps: WizardStep[] = [
    { label: 'Customer & Date', content: customerStep, isValid: () => Boolean(customerId) },
    { label: 'Line Items', content: lineItemsStep, isValid: () => draftLines.length > 0 },
    { label: 'Review', content: reviewStep, isValid: () => true },
  ];

  return (
    <Box p={embedded ? 0 : 8}>
      {!embedded && <PageHeader title="New order" />}
      {error && !isSubmitting && draftLines.length === 0 && <Text color="red.600" pb={2}>{error}</Text>}
      <WizardShell steps={steps} onSubmit={saveDraft} submitLabel="Save draft" isSubmitting={isSubmitting} submitError={error} />
      <HStack spacing={2} pt={4}>
        <Button
          variant="ghost"
          onClick={() => (onCancel ? onCancel() : navigate('/plugins/inventory-dashboard/r/orders'))}
          isDisabled={isSubmitting}
        >
          Cancel
        </Button>
        {id && <Button colorScheme="green" onClick={onConfirm}>Confirm order</Button>}
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

function ConfirmedOrderView({ order, reload, api }: { order: any; reload: () => void; api: any }) {
  const [amount, setAmount] = useState<number | undefined>(0);
  const [method, setMethod] = useState('cash');

  const addPayment = async () => {
    await api.post('/resources/payments', {
      amount: amount ?? 0, method, paymentDate: formatLocalDate(new Date()), order: order.documentId,
    });
    setAmount(0);
    reload();
  };

  return (
    <Box p={8}>
      <HStack justify="space-between" mb={6}>
        <Text fontSize="lg" fontWeight="bold" color="text.primary">{`Order ${order.documentId.slice(0, 8)}`}</Text>
        <Badge fontSize="sm">{order.status}</Badge>
      </HStack>

      <DataTable columns={['Variant', 'Qty', 'Sell', 'Cost USD snap', 'Flag']} isEmpty={order.lines.length === 0}>
        {order.lines.map((l: any) => (
          <Tr key={l.documentId}>
            <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
            <Td>{l.quantitySold}</Td>
            <Td>{l.sellPrice}</Td>
            <Td>{l.costPriceUsdSnapshot}</Td>
            <Td>{l.belowCost ? <Badge colorScheme="red">Below cost</Badge> : null}</Td>
          </Tr>
        ))}
      </DataTable>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" color="text.primary">Totals</Text>
        <Text>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Text>
        <Text>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Text>
      </Box>

      <Box pt={6}>
        <Text fontSize="lg" fontWeight="semibold" pb={2} color="text.primary">Record payment</Text>
        <Card>
          <CardBody>
            <HStack spacing={2} align="flex-end">
              <FormField label="Amount">
                <NumberInput value={amount ?? ''} onChange={(_, v) => setAmount(Number.isNaN(v) ? undefined : v)}>
                  <NumberInputField />
                </NumberInput>
              </FormField>
              <FormField label="Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">cash</option>
                  <option value="transfer">transfer</option>
                </Select>
              </FormField>
              <Button onClick={addPayment} isDisabled={!amount}>Add payment</Button>
            </HStack>
          </CardBody>
        </Card>
      </Box>
    </Box>
  );
}
