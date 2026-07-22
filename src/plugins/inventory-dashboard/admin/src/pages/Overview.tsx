import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';

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
      <Box p={8}>
        <Text color="red.600">Could not load overview data</Text>
      </Box>
    );
  }

  if (loading || !data) return <Box p={8}><Text>Loading…</Text></Box>;

  return (
    <Box p={8}>
      <PageHeader title="Overview" />

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label="Exchange rate (EGP per USD)" maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField bg="white" />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>Save rate</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="gray.500" pt={1}>Updated: {exchangeRateUpdatedAt}</Text>
        )}
        {saveError && <Text color="red.600" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={4} spacing={4}>
        <StatCard label="Total stock units" value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label="Stock value (USD)" value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label="Stock value (EGP)" value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label="Exchange rate" value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Low stock</Text>
        <DataTable columns={['Variant', 'Qty', 'Threshold']} isEmpty={data.lowStock.length === 0}>
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Expired</Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={6}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="gray.800">Expiring soon (90 days)</Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
