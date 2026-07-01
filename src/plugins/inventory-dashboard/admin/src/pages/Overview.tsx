import { useState, useEffect } from 'react';
import {
  Box, Flex, Grid, Typography, NumberInput, Field, Button,
  Table, Thead, Tbody, Tr, Th, Td,
  Card, CardBody, CardContent, CardTitle, CardSubtitle,
} from '@strapi/design-system';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';

export default function Overview() {
  const { data, loading, error, reload } = useOverview();
  const { exchangeRate, exchangeRateUpdatedAt, save } = useSettings();
  const [rateInput, setRateInput] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeRate != null) setRateInput(exchangeRate);
  }, [exchangeRate]);

  const onSaveRate = async () => {
    setSaveError(null);
    if (rateInput == null || Number.isNaN(rateInput)) {
      setSaveError('Enter a valid exchange rate');
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? 'Could not save rate');
    }
  };

  if (error) {
    return (
      <Box padding={8}>
        <Typography textColor="danger600">Could not load overview data</Typography>
      </Box>
    );
  }

  if (loading || !data) return <Box padding={8}><Typography>Loading…</Typography></Box>;

  return (
    <Box padding={8}>
      <Typography variant="alpha">Overview</Typography>

      <Box paddingTop={4} paddingBottom={6}>
        <Flex gap={2} alignItems="flex-end">
          <Field.Root name="rate">
            <Field.Label>Exchange rate (EGP per USD)</Field.Label>
            <NumberInput
              value={rateInput}
              onValueChange={(value: number | undefined) => setRateInput(value)}
            />
          </Field.Root>
          <Button onClick={onSaveRate}>Save rate</Button>
        </Flex>
        {exchangeRateUpdatedAt && (
          <Typography variant="pi" textColor="neutral600">Updated: {exchangeRateUpdatedAt}</Typography>
        )}
        {saveError && <Typography textColor="danger600">{saveError}</Typography>}
      </Box>

      <Grid.Root gap={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} />
      </Grid.Root>

      <Box paddingTop={6}>
        <Typography variant="beta">Low stock</Typography>
        <Table colCount={3} rowCount={data.lowStock.length}>
          <Thead><Tr><Th>Variant</Th><Th>Qty</Th><Th>Threshold</Th></Tr></Thead>
          <Tbody>
            {data.lowStock.map((r: any) => (
              <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Grid.Root gap={4} paddingTop={6}>
        <Grid.Item col={6}>
          <Typography variant="beta">Expired</Typography>
          {data.expired.map((b: any) => (
            <Typography key={b.batchId} textColor="danger600">{b.variantLabel} — {b.expiryDate}</Typography>
          ))}
        </Grid.Item>
        <Grid.Item col={6}>
          <Typography variant="beta">Expiring soon (90 days)</Typography>
          {data.expiringSoon.map((b: any) => (
            <Typography key={b.batchId} textColor="warning600">{b.variantLabel} — {b.expiryDate}</Typography>
          ))}
        </Grid.Item>
      </Grid.Root>
    </Box>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Grid.Item col={3}>
      <Card>
        <CardBody>
          <CardContent>
            <CardTitle>{value}</CardTitle>
            <CardSubtitle>{label}</CardSubtitle>
          </CardContent>
        </CardBody>
      </Card>
    </Grid.Item>
  );
}
