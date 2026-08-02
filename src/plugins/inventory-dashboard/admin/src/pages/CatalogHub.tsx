// src/plugins/inventory-dashboard/admin/src/pages/CatalogHub.tsx
import { Box, Card, CardBody, Heading, HStack, Icon, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../utils/api';
import { useAsyncResource } from '../hooks/useAsyncResource';
import { PageHeader } from '../components/ui/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { CATALOG_GROUPS } from '../config/navConfig';

type CatalogCounts = Record<string, number | null>;

export default function CatalogHub() {
  const api = useApi();
  const navigate = useNavigate();
  const intl = useIntl();

  const { data: counts, isInitialLoading } = useAsyncResource<CatalogCounts>(
    () => {
      const slugs = CATALOG_GROUPS.flatMap((g) => g.items.map((i) => i.slug));
      return Promise.all(
        slugs.map((slug) =>
          api
            .get<{ pagination: { total: number } }>(`/resources/${slug}`, { pageSize: 1 })
            .then((d) => [slug, d.pagination.total] as const)
            .catch(() => [slug, null] as const)
        )
      ).then((entries) => Object.fromEntries(entries) as CatalogCounts);
    },
    []
  );

  if (isInitialLoading) {
    return <LoadingState />;
  }

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader title={intl.formatMessage({ id: 'nav.catalog', defaultMessage: 'Catalog' })} />
      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} pb={8}>
          <Heading size="md" color="text.primary" pb={4}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            {group.items.map((item) => (
              <Card
                key={item.slug}
                as="button"
                textAlign="start"
                cursor="pointer"
                transition="box-shadow 0.15s, border-color 0.15s"
                _hover={{ borderColor: 'brand.200', boxShadow: 'shadow.raised' }}
                onClick={() => navigate(item.slug)}
              >
                <CardBody>
                  <HStack spacing={4} align="flex-start">
                    <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={10} flexShrink={0}>
                      <Icon as={item.icon} boxSize={5} color="accent.fg" />
                    </VStack>
                    <VStack align="flex-start" spacing={0}>
                      <Text fontSize="sm" color="text.secondary" fontWeight="medium">
                        {intl.formatMessage({ id: item.labelId })}
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="text.primary">
                        {counts?.[item.slug] ?? '—'}
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
