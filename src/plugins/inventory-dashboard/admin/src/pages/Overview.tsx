import { useState, useEffect } from 'react';
import { Box, Button, Grid, GridItem, HStack, NumberInput, NumberInputField, SimpleGrid, Td, Text, Tr } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataTable } from '../components/ui/DataTable';
import { FormField } from '../components/ui/FormField';
import { LoadingState } from '../components/ui/LoadingState';

export default function Overview() {
  const intl = useIntl();
  const { data, error, isInitialLoading, reload } = useOverview();
  const { exchangeRate, exchangeRateUpdatedAt, save } = useSettings();
  const [rateInput, setRateInput] = useState<number | undefined>(undefined);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (exchangeRate != null) setRateInput(exchangeRate);
  }, [exchangeRate]);

  const onSaveRate = async () => {
    setSaveError(null);
    if (rateInput == null || Number.isNaN(rateInput)) {
      setSaveError(intl.formatMessage({ id: 'overview.invalidRateError', defaultMessage: 'Enter a valid exchange rate' }));
      return;
    }
    try {
      await save(rateInput);
      reload();
    } catch (e: any) {
      setSaveError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'overview.saveRateError', defaultMessage: 'Could not save rate' }));
    }
  };

  if (isInitialLoading || !data) {
    if (error) {
      return (
        <Box p={{ base: 4, md: 8 }}>
          <Text color="severity.critical.fg">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
        </Box>
      );
    }
    return <LoadingState />;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.overview', defaultMessage: 'Overview' })} />

      {error != null && (
        <Text color="severity.critical.fg" pb={4}>
          {intl.formatMessage({ id: 'overview.reloadError', defaultMessage: 'Could not refresh overview data — showing last loaded data' })}
        </Text>
      )}

      <Box pb={6}>
        <HStack spacing={2} align="flex-end">
          <FormField label={intl.formatMessage({ id: 'overview.exchangeRateLabel', defaultMessage: 'Exchange rate (EGP per USD)' })} maxW="xs">
            <NumberInput value={rateInput ?? ''} onChange={(_, v) => setRateInput(Number.isNaN(v) ? undefined : v)}>
              <NumberInputField />
            </NumberInput>
          </FormField>
          <Button onClick={onSaveRate}>{intl.formatMessage({ id: 'overview.saveRateButton', defaultMessage: 'Save rate' })}</Button>
        </HStack>
        {exchangeRateUpdatedAt && (
          <Text fontSize="xs" color="text.secondary" pt={1}>
            {intl.formatMessage({ id: 'overview.updatedLabel', defaultMessage: 'Updated: {date}' }, { date: exchangeRateUpdatedAt })}
          </Text>
        )}
        {saveError && <Text color="severity.critical.fg" pt={1}>{saveError}</Text>}
      </Box>

      <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={4}>
        <StatCard label={intl.formatMessage({ id: 'overview.stat.totalStockUnits', defaultMessage: 'Total stock units' })} value={String(data.totalStockUnits)} icon={FiArchive} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueUsd', defaultMessage: 'Stock value (USD)' })} value={`$${data.stockValueUsd.toFixed(2)}`} icon={FiTrendingUp} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.stockValueEgp', defaultMessage: 'Stock value (EGP)' })} value={`E£${data.stockValueEgp.toFixed(2)}`} icon={FiPieChart} />
        <StatCard label={intl.formatMessage({ id: 'overview.stat.exchangeRate', defaultMessage: 'Exchange rate' })} value={String(data.exchangeRate)} icon={FiRepeat} />
      </SimpleGrid>

      <Box pt={8}>
        <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
          {intl.formatMessage({ id: 'overview.lowStockTitle', defaultMessage: 'Low stock' })}
        </Text>
        <DataTable
          columns={[
            intl.formatMessage({ id: 'overview.col.variant', defaultMessage: 'Variant' }),
            intl.formatMessage({ id: 'overview.col.qty', defaultMessage: 'Qty' }),
            intl.formatMessage({ id: 'overview.col.threshold', defaultMessage: 'Threshold' }),
          ]}
          isEmpty={data.lowStock.length === 0}
        >
          {data.lowStock.map((r: any) => (
            <Tr key={r.variantId}><Td>{r.label}</Td><Td>{r.quantity}</Td><Td>{r.threshold}</Td></Tr>
          ))}
        </DataTable>
      </Box>

      <Grid templateColumns="repeat(12, 1fr)" gap={4} pt={8}>
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
          </Text>
          {data.expired.map((b: any) => (
            <Text key={b.batchId} color="red.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
        <GridItem colSpan={{ base: 12, md: 6 }}>
          <Text fontSize="lg" fontWeight="semibold" pb={3} color="text.primary">
            {intl.formatMessage({ id: 'overview.expiringSoonTitle', defaultMessage: 'Expiring soon (90 days)' })}
          </Text>
          {data.expiringSoon.map((b: any) => (
            <Text key={b.batchId} color="orange.600">{b.variantLabel} — {b.expiryDate}</Text>
          ))}
        </GridItem>
      </Grid>
    </Box>
  );
}
