// src/plugins/inventory-dashboard/admin/src/pages/CatalogLayout.tsx
import { Flex, Box } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';
import { CatalogSidebar } from '../components/CatalogSidebar';

export default function CatalogLayout() {
  return (
    <Flex minH="100%">
      <CatalogSidebar />
      <Box flex={1}>
        <Outlet />
      </Box>
    </Flex>
  );
}
