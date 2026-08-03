// src/plugins/inventory-dashboard/admin/src/components/ui/LoadingState.tsx
import { Box, Spinner, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';

export function LoadingState({ label }: { label?: string }) {
  const intl = useIntl();
  const resolved = label ?? intl.formatMessage({ id: 'common.loading', defaultMessage: 'Loading…' });

  return (
    <Box p={{ base: 5, md: 10 }} display="flex" alignItems="center" justifyContent="center">
      <Spinner />
      <Text ms={3}>{resolved}</Text>
    </Box>
  );
}
