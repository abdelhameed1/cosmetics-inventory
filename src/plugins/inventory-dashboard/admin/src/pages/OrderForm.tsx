import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Field, Flex, Grid, Typography, NumberInput, DatePicker,
  SingleSelect, SingleSelectOption, Table, Thead, Tbody, Tr, Th, Td, Badge,
} from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useOrder } from '../hooks/useOrder';

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

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export default function OrderForm() {
  const { id } = useParams();
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
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Could not save order');
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

  return (
    <Box padding={8}>
      <Typography variant="alpha">New order</Typography>
      {error && <Box paddingTop={2}><Typography textColor="danger600">{error}</Typography></Box>}

      <Grid.Root gap={4} paddingTop={6}>
        <Grid.Item col={4}>
          <Field.Root name="customer">
            <Field.Label>Customer</Field.Label>
            <SingleSelect value={customerId} onChange={(v: string | number) => setCustomerId(String(v))}>
              {customers.map((c) => <SingleSelectOption key={c.documentId} value={c.documentId}>{c.name}</SingleSelectOption>)}
            </SingleSelect>
          </Field.Root>
        </Grid.Item>
        <Grid.Item col={4}>
          <Field.Root name="orderDate">
            <Field.Label>Order date</Field.Label>
            <DatePicker
              value={orderDate ? parseLocalDate(orderDate) : undefined}
              onChange={(d?: Date) => setOrderDate(d ? formatLocalDate(d) : null)}
            />
          </Field.Root>
        </Grid.Item>
      </Grid.Root>

      <Box paddingTop={6}>
        <Typography variant="beta">Add product</Typography>
        <Grid.Root gap={4} paddingTop={2}>
          <Grid.Item col={4}>
            <Field.Root name="product">
              <Field.Label>Product</Field.Label>
              <SingleSelect value={addProductId} onChange={(v: string | number) => { setAddProductId(String(v)); setAddVariantId(''); }}>
                {products.map((p) => <SingleSelectOption key={p.documentId} value={p.documentId}>{p.name}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}>
            <Field.Root name="variant">
              <Field.Label>Variant</Field.Label>
              <SingleSelect value={addVariantId} onChange={(v: string | number) => setAddVariantId(String(v))} disabled={!addProductId}>
                {variantsForProduct.map((v) => <SingleSelectOption key={v.documentId} value={v.documentId}>{v.label ?? 'Default'}</SingleSelectOption>)}
              </SingleSelect>
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={3}>
            <Field.Root name="qty">
              <Field.Label>Quantity</Field.Label>
              <NumberInput value={addQty} onValueChange={setAddQty} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={1}><Box paddingTop={6}><Button onClick={addLine} disabled={!addVariantId}>Add</Button></Box></Grid.Item>
        </Grid.Root>
      </Box>

      {relatedSuggestions.length > 0 && (
        <Box paddingTop={4} background="primary100" padding={3} hasRadius>
          <Typography variant="omega">Customers also buy:&nbsp;</Typography>
          {relatedSuggestions.map((rp: any) => (
            <Button key={rp.documentId} variant="tertiary"
              onClick={() => { setAddProductId(rp.documentId); setAddVariantId(''); }}>
              {rp.name}
            </Button>
          ))}
        </Box>
      )}

      <Box paddingTop={6}>
        <Table colCount={6} rowCount={draftLines.length}>
          <Thead><Tr><Th>Variant</Th><Th>Batch</Th><Th>Qty</Th><Th>Sell (EGP)</Th><Th>Cost EGP</Th><Th>Flag</Th></Tr></Thead>
          <Tbody>
            {draftLines.map((l, i) => {
              const costEgp = l.costPriceUsd * exchangeRate;
              const below = l.sellPrice < costEgp;
              return (
                <Tr key={i}>
                  <Td>{l.variantLabel}</Td>
                  <Td>{l.stockBatchDocumentId.slice(0, 6)}</Td>
                  <Td>{l.quantitySold}</Td>
                  <Td>
                    <NumberInput aria-label="sell" value={l.sellPrice}
                      onValueChange={(v: number | undefined) => setDraftLines((prev) => prev.map((x, idx) => idx === i ? { ...x, sellPrice: v ?? 0 } : x))} />
                  </Td>
                  <Td>{costEgp.toFixed(2)}</Td>
                  <Td>{below ? <Badge backgroundColor="danger500" textColor="neutral0">Below cost</Badge> : null}</Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </Box>

      <Box paddingTop={6}>
        <Grid.Root gap={4}>
          <Grid.Item col={4}>
            <Field.Root name="discount">
              <Field.Label>Discount (EGP)</Field.Label>
              <NumberInput value={discount} onValueChange={setDiscount} />
            </Field.Root>
          </Grid.Item>
          <Grid.Item col={4}><Box paddingTop={6}><Typography>Subtotal: {subtotal.toFixed(2)} EGP</Typography></Box></Grid.Item>
          <Grid.Item col={4}><Box paddingTop={6}><Typography variant="beta">Total: {finalTotal.toFixed(2)} EGP</Typography></Box></Grid.Item>
        </Grid.Root>
      </Box>

      <Flex gap={2} paddingTop={6}>
        <Button onClick={saveDraft} disabled={!customerId || draftLines.length === 0}>Save draft</Button>
        {id && <Button variant="success" onClick={onConfirm}>Confirm order</Button>}
        <Button variant="tertiary" onClick={() => navigate('/plugins/inventory-dashboard/r/orders')}>Cancel</Button>
      </Flex>
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
    <Box padding={8}>
      <Flex justifyContent="space-between">
        <Typography variant="alpha">Order {order.documentId.slice(0, 8)}</Typography>
        <Badge>{order.status}</Badge>
      </Flex>

      <Box paddingTop={6}>
        <Table colCount={5} rowCount={order.lines.length}>
          <Thead><Tr><Th>Variant</Th><Th>Qty</Th><Th>Sell</Th><Th>Cost USD snap</Th><Th>Flag</Th></Tr></Thead>
          <Tbody>
            {order.lines.map((l: any) => (
              <Tr key={l.documentId}>
                <Td>{l.stockBatch?.documentId?.slice(0, 6) ?? '-'}</Td>
                <Td>{l.quantitySold}</Td>
                <Td>{l.sellPrice}</Td>
                <Td>{l.costPriceUsdSnapshot}</Td>
                <Td>{l.belowCost ? <Badge backgroundColor="danger500" textColor="neutral0">Below cost</Badge> : null}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Totals</Typography>
        <Typography>Subtotal: {order.totals.subtotal} | Final: {order.totals.finalTotal} | Profit: {order.totals.netProfit}</Typography>
        <Typography>Paid: {order.totals.totalPaid} | Balance due: {order.totals.balanceDue}</Typography>
      </Box>

      <Box paddingTop={6}>
        <Typography variant="beta">Record payment</Typography>
        <Flex gap={2} alignItems="flex-end" paddingTop={2}>
          <Field.Root name="amount">
            <Field.Label>Amount</Field.Label>
            <NumberInput value={amount} onValueChange={setAmount} />
          </Field.Root>
          <Field.Root name="method">
            <Field.Label>Method</Field.Label>
            <SingleSelect value={method} onChange={(v: string | number) => setMethod(String(v))}>
              <SingleSelectOption value="cash">cash</SingleSelectOption>
              <SingleSelectOption value="transfer">transfer</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
          <Button onClick={addPayment} disabled={!amount}>Add payment</Button>
        </Flex>
      </Box>
    </Box>
  );
}
