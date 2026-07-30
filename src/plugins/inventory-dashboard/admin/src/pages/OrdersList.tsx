// src/plugins/inventory-dashboard/admin/src/pages/OrdersList.tsx
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay,
  Badge, Box, Button, Td, Text, Tr,
} from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { useLocale } from '../i18n/LocaleProvider';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';

const STATUS_COLOR_SCHEME: Record<string, string> = {
  draft: 'gray',
  confirmed: 'yellow',
  partially_paid: 'orange',
  paid: 'green',
  cancelled: 'red',
};

function orderFinalTotal(order: any): number {
  const subtotal = (order.lines ?? []).reduce(
    (s: number, l: any) => s + Number(l.sellPrice) * Number(l.quantitySold),
    0
  );
  return subtotal - (Number(order.discountAmount) || 0);
}

export default function OrdersList() {
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { locale } = useLocale();
  const { data, error: loadError, isInitialLoading, reload } = useAsyncResource<{ results: any[]; pagination: { total: number } }>(
    () => api.get<{ results: any[]; pagination: { total: number } }>('/resources/orders', { pageSize: 100 }),
    []
  );
  const rows = data?.results ?? [];
  const total = data?.pagination.total ?? null;
  const [actionError, setActionError] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<any | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const displayError = actionError ?? (loadError ? String(loadError) : null);

  const confirmCancel = async () => {
    if (!toCancel) return;
    setIsCancelling(true);
    try {
      await api.post(`/orders/${toCancel.documentId}/cancel`);
      setActionError(null);
      reload();
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'ordersList.cancelError', defaultMessage: 'Could not cancel order' }));
    } finally {
      setIsCancelling(false);
      setToCancel(null);
    }
  };

  if (isInitialLoading) return <LoadingState />;

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.orders', defaultMessage: 'Orders' })} />

      {displayError && <Text color="red.600" pb={4}>{displayError}</Text>}
      {total !== null && total > rows.length && (
        <Text color="text.secondary" fontSize="sm" pb={4}>
          {intl.formatMessage(
            { id: 'ordersList.showingCount', defaultMessage: 'Showing the {shown} most recent of {total} orders.' },
            { shown: rows.length, total }
          )}
        </Text>
      )}

      <DataTable
        columns={[
          intl.formatMessage({ id: 'ordersList.col.date', defaultMessage: 'Date' }),
          intl.formatMessage({ id: 'ordersList.col.customer', defaultMessage: 'Customer' }),
          intl.formatMessage({ id: 'ordersList.col.status', defaultMessage: 'Status' }),
          intl.formatMessage({ id: 'ordersList.col.total', defaultMessage: 'Total (EGP)' }),
          intl.formatMessage({ id: 'resourceList.actionsColumn', defaultMessage: 'Actions' }),
        ]}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr key={row.documentId} cursor="pointer" _hover={{ bg: 'bg.subtle' }} onClick={() => navigate(row.documentId)}>
            <Td>{row.orderDate}</Td>
            <Td>{row.customer?.name ?? '—'}</Td>
            <Td><Badge colorScheme={STATUS_COLOR_SCHEME[row.status] ?? 'gray'}>{row.status}</Badge></Td>
            <Td>{orderFinalTotal(row).toFixed(2)}</Td>
            <Td onClick={(e) => e.stopPropagation()}>
              {row.status === 'draft' && (
                <Button size="sm" variant="ghost" colorScheme="red" onClick={() => setToCancel(row)} isDisabled={isCancelling}>
                  {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
                </Button>
              )}
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog isOpen={!!toCancel} leastDestructiveRef={cancelRef} onClose={() => setToCancel(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmTitle', defaultMessage: 'Cancel this order?' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'orderForm.confirmed.cancelConfirmBody', defaultMessage: 'This restores any deducted stock and cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToCancel(null)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={confirmCancel} ms={3} isLoading={isCancelling}>
                {intl.formatMessage({ id: 'orderForm.confirmed.cancelOrderButton', defaultMessage: 'Cancel order' })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}
