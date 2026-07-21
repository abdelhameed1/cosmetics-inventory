// src/plugins/inventory-dashboard/admin/src/components/CatalogSidebar.tsx
import { Box, Heading, VStack, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CATALOG_GROUPS } from '../config/catalogGroups';

export function CatalogSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box
      as="nav"
      w="240px"
      flexShrink={0}
      bg="white"
      borderRightWidth="1px"
      borderColor="gray.100"
      minH="100%"
      py={6}
      px={4}
    >
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="gray.500" mb={2} px={2}>
            {group.label}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const isActive = pathname.startsWith(`/plugins/inventory-catalog/${item.slug}`);
              return (
                <Box
                  key={item.slug}
                  as="button"
                  textAlign="left"
                  px={2}
                  py={2}
                  borderRadius="md"
                  bg={isActive ? 'brand.50' : 'transparent'}
                  _hover={{ bg: isActive ? 'brand.50' : 'gray.50' }}
                  onClick={() => navigate(`/plugins/inventory-catalog/${item.slug}`)}
                >
                  <Text
                    fontSize="sm"
                    fontWeight={isActive ? 'semibold' : 'normal'}
                    color={isActive ? 'brand.700' : 'gray.700'}
                  >
                    {item.label}
                  </Text>
                </Box>
              );
            })}
          </VStack>
        </Box>
      ))}
    </Box>
  );
}
