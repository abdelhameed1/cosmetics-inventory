// src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
import { lazy, Suspense, useState } from 'react';
import {
  Badge, Box, Card, CardBody, Center, Heading, HStack, Icon, IconButton, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, SimpleGrid, Spinner, Text, VStack,
} from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { ADD_NEW_GROUPS, type AddNewItem } from '../config/addNewConfig';
import { useLocale } from '../i18n/LocaleProvider';

// Lazy-loaded: AddNewModal is rendered unconditionally on every page via
// AppShell/AppSidebar, so a static import here would bundle every wizard's
// form logic (FIFO/pricing lookups, multi-step save/retry state, schema-driven
// field rendering) into the base shell chunk that loads on every page view,
// even when Add New is never opened. Loading these only once a card is picked
// keeps that shell chunk lightweight, matching how these forms were already
// code-split per-route before this modal embedded them.
const InlineResourceForm = lazy(() => import('./InlineResourceForm').then((m) => ({ default: m.InlineResourceForm })));
const ProductVariantsForm = lazy(() => import('./ProductVariantsForm'));
const StockPurchase = lazy(() => import('../pages/StockPurchase'));
const OrderForm = lazy(() => import('../pages/OrderForm'));

export function AddNewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const intl = useIntl();
  const { locale } = useLocale();
  const [active, setActive] = useState<AddNewItem | null>(null);

  const backToGrid = () => setActive(null);

  // Closes the modal and resets it back to the picker grid for next time it opens.
  const close = () => {
    onClose();
    setActive(null);
  };

  // For flows with no built-in redirect of their own (the 6 simple resources +
  // Product): land on that entity's list after a successful create, then close.
  const doneToList = () => {
    if (active) navigate(`/plugins/inventory-catalog/${active.slug}`);
    close();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} size={{ base: 'full', md: active ? '3xl' : '2xl' }} scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <ModalHeader>
          <HStack spacing={2}>
            {active && (
              <IconButton
                aria-label={intl.formatMessage({ id: 'common.back', defaultMessage: 'Back' })}
                icon={locale === 'ar' ? <FiArrowRight /> : <FiArrowLeft />}
                size="sm"
                variant="ghost"
                onClick={backToGrid}
              />
            )}
            <Text>
              {active
                ? intl.formatMessage(
                    { id: 'addNew.newItemTitle', defaultMessage: 'New {label}' },
                    { label: intl.formatMessage({ id: active.labelId }) }
                  )
                : intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
            </Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {!active && (
            <>
              {ADD_NEW_GROUPS.map((group) => (
                <Box key={group.labelId} pb={6}>
                  <Heading size="xs" textTransform="uppercase" color="text.secondary" pb={3}>
                    {intl.formatMessage({ id: group.labelId })}
                  </Heading>
                  <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                    {group.items.map((item) => (
                      <Card
                        key={item.slug}
                        as="button"
                        textAlign="start"
                        cursor="pointer"
                        transition="box-shadow 0.15s, border-color 0.15s"
                        _hover={{ borderColor: 'brand.200', boxShadow: 'shadow.raised' }}
                        onClick={() => setActive(item)}
                      >
                        <CardBody>
                          <HStack justify="space-between">
                            <HStack spacing={3}>
                              <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={9} flexShrink={0}>
                                <Icon as={item.icon} boxSize={4} color="accent.fg" />
                              </VStack>
                              <Text fontSize="sm" fontWeight="semibold" color="text.primary">
                                {intl.formatMessage({ id: item.labelId })}
                              </Text>
                            </HStack>
                            {item.kind === 'wizard' && (
                              <Badge colorScheme="brand">
                                {intl.formatMessage({ id: 'addNew.guidedBadge', defaultMessage: 'Guided' })}
                              </Badge>
                            )}
                          </HStack>
                        </CardBody>
                      </Card>
                    ))}
                  </SimpleGrid>
                </Box>
              ))}
            </>
          )}

          {active && (
            <Suspense fallback={<Center py={10}><Spinner /></Center>}>
              {active.slug === 'products' && (
                <ProductVariantsForm embedded onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.kind === 'simple' && (
                <InlineResourceForm resource={active.slug} onDone={doneToList} onCancel={backToGrid} />
              )}
              {active.slug === 'stock-purchase' && (
                <StockPurchase embedded onDone={close} onCancel={backToGrid} />
              )}
              {active.slug === 'order' && (
                <OrderForm embedded onDone={close} onCancel={backToGrid} />
              )}
            </Suspense>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
