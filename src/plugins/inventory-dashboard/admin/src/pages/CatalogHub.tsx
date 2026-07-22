// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { useEffect, useState } from 'react';
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { PageHeader } from '../components/ui/PageHeader';
import { CATALOG_GROUPS } from '../config/navConfig';

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const slugs = CATALOG_GROUPS.flatMap((g) => g.items.map((i) => i.slug));

    Promise.all(
      slugs.map((slug) =>
        api
          .get<{ pagination: { total: number } }>(`/resources/${slug}`, { pageSize: 1 })
          .then((d) => [slug, d.pagination.total] as const)
          .catch(() => [slug, null] as const)
      )
    ).then((entries) => {
      if (!active) return;
      setCounts(Object.fromEntries(entries) as Record<string, number>);
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <Box p={8}>
      <PageHeader title="Catalog" />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} pb={8}>
          <Heading size="md" color="gray.800" pb={4}>
            {group.label}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="left"
                cursor="pointer"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                onClick={() => navigate(item.slug)}
              >
                <CardBody>
                  <HStack spacing={4} align="flex-start">
                    <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={10} flexShrink={0}>
                      <Icon as={item.icon} boxSize={5} color="brand.600" />
                    </VStack>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontSize="sm" color="gray.500" fontWeight="medium">
                        {item.label}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                        {counts[item.slug] ?? '—'}
                      </Text>
                    </VStack>
                  </HStack>
                </CardBody>
              </Card>
            ))}
          </SimpleGrid>
        </Box>
      ))}
    </Box>
  );
}
