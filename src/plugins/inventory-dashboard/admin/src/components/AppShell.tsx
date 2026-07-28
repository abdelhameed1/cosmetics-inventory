// src/plugins/inventory-dashboard/admin/src/components/AppShell.tsx
import { useEffect, type ReactNode } from 'react';
import {
  Box, Drawer, DrawerBody, DrawerContent, DrawerOverlay, Flex, HStack, Icon, IconButton, useDisclosure,
} from '@chakra-ui/react';
import { FiMenu } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleProvider';
import { AppSidebar } from './AppSidebar';

function MobileTopBar({ onOpen }: { onOpen: () => void }) {
  const intl = useIntl();

  return (
    <HStack
      display={{ base: 'flex', md: 'none' }}
      bg="bg.surface"
      borderBottomWidth="1px"
      borderColor="border.default"
      px={4}
      py={3}
      flexShrink={0}
    >
      <IconButton
        aria-label={intl.formatMessage({ id: 'nav.openMenuAria', defaultMessage: 'Open menu' })}
        icon={<Icon as={FiMenu} boxSize={5} />}
        variant="ghost"
        onClick={onOpen}
      />
    </HStack>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { locale } = useLocale();
  const { pathname } = useLocation();

  // Close the mobile drawer whenever the route changes (e.g. a nav link was
  // tapped) — AppSidebar's own nav buttons have no knowledge of the drawer,
  // so this is the only hook point available without modifying them.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <Flex minH="100%" direction="column">
      <MobileTopBar onOpen={onOpen} />
      <Flex flex={1} minH={0}>
        <Box display={{ base: 'none', md: 'block' }}>
          <AppSidebar />
        </Box>
        <Drawer isOpen={isOpen} placement={locale === 'ar' ? 'end' : 'start'} onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent maxW="240px" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <DrawerBody p={0}>
              <AppSidebar />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <Box flex={1} minW={0}>{children}</Box>
      </Flex>
    </Flex>
  );
}
