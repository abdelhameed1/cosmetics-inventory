import { useState, useEffect } from 'react';
import { Box, Button, Heading, HStack, NumberInput, NumberInputField, SimpleGrid, Text } from '@chakra-ui/react';
import { FiArchive, FiTrendingUp, FiPieChart, FiRepeat } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useOverview } from '../hooks/useOverview';
import { useSettings } from '../hooks/useSettings';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { SignalList } from '../components/ui/SignalList';
import { FormField } from '../components/ui/FormField';
import { LoadingState } from '../components/ui/LoadingState';

export default function Overview() {
  const intl = useIntl();
  const navigate = useNavigate();
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
        <Box p={{ base: 5, md: 10 }}>
          <Text color="severity.critical.fg">{intl.formatMessage({ id: 'overview.loadError', defaultMessage: 'Could not load overview data' })}</Text>
        </Box>
      );
    }
    return <LoadingState />;
  }

  const outOfStockRows = (data.outOfStock ?? []).map((r: any) => ({
    id: r.variantId,
    label: r.label,
    context: intl.formatMessage(
      { id: 'overview.signalList.outOfStockContext', defaultMessage: '0 of {threshold} threshold' },
      { threshold: r.threshold }
    ),
    onClick: () => navigate(`/plugins/inventory-catalog/variants/${r.variantId}`),
  }));

  const lowStockRows = (data.lowStock ?? []).map((r: any) => ({
    id: r.variantId,
    label: r.label,
    context: intl.formatMessage(
      { id: 'overview.signalList.lowStockContext', defaultMessage: '{quantity} of {threshold} threshold' },
      { quantity: r.quantity, threshold: r.threshold }
    ),
    onClick: () => navigate(`/plugins/inventory-catalog/variants/${r.variantId}`),
  }));

  const expiredRows = (data.expired ?? []).map((b: any) => ({
    id: b.batchId,
    label: b.variantLabel,
    context: intl.formatMessage({ id: 'overview.signalList.expiredContext', defaultMessage: 'expired {date}' }, { date: b.expiryDate }),
    onClick: () => navigate(`/plugins/inventory-catalog/stock-batches/${b.batchId}`),
  }));

  const expiringSoonRows = (data.expiringSoon ?? []).map((b: any) => ({
    id: b.batchId,
    label: b.variantLabel,
    context: intl.formatMessage({ id: 'overview.signalList.expiringSoonContext', defaultMessage: 'expires {date}' }, { date: b.expiryDate }),
    onClick: () => navigate(`/plugins/inventory-catalog/stock-batches/${b.batchId}`),
  }));

  return (
    <Box p={{ base: 5, md: 10 }}>
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
        <Heading size="md" color="text.primary" pb={4}>
          {intl.formatMessage({ id: 'overview.alertsTitle', defaultMessage: 'Alerts' })}
        </Heading>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          <SignalList
            severity="critical"
            title={intl.formatMessage({ id: 'overview.outOfStockTitle', defaultMessage: 'Out of stock' })}
            rows={outOfStockRows}
            emptyLabel={intl.formatMessage({ id: 'overview.signalList.outOfStockEmpty', defaultMessage: 'Nothing out of stock' })}
          />
          <SignalList
            severity="warning"
            title={intl.formatMessage({ id: 'overview.lowStockTitle', defaultMessage: 'Low stock' })}
            rows={lowStockRows}
            emptyLabel={intl.formatMessage({ id: 'overview.signalList.lowStockEmpty', defaultMessage: 'No items below threshold' })}
          />
          <SignalList
            severity="critical"
            title={intl.formatMessage({ id: 'overview.expiredTitle', defaultMessage: 'Expired' })}
            rows={expiredRows}
            emptyLabel={intl.formatMessage({ id: 'overview.signalList.expiredEmpty', defaultMessage: 'Nothing expired' })}
          />
          <SignalList
            severity="warning"
            title={intl.formatMessage({ id: 'overview.expiringSoonTitle', defaultMessage: 'Expiring soon (90 days)' })}
            rows={expiringSoonRows}
            emptyLabel={intl.formatMessage({ id: 'overview.signalList.expiringSoonEmpty', defaultMessage: 'Nothing expiring soon' })}
          />
        </SimpleGrid>
      </Box>
    </Box>
  );
}
