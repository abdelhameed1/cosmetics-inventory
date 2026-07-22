// src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
import { Flex, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Flex minH="100%">
      <AppSidebar />
      <Box flex={1}>{children}</Box>
    </Flex>
  );
}
