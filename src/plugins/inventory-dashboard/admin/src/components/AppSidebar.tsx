// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { useState } from 'react';
import { Box, Button, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';
import { AddNewModal } from './AddNewModal';
import { ColorModeToggle } from './ColorModeToggle';
import { FontSizeToggle } from './FontSizeToggle';
import { LanguageToggle } from './LanguageToggle';
import { LogoutButton } from './LogoutButton';

function isLinkActive(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavButton({
  label, icon: IconComp, isActive, onClick,
}: { label: string; icon: IconComponent; isActive: boolean; onClick: () => void }) {
  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="md"
      bg={isActive ? 'accent.bg' : 'transparent'}
      _hover={{ bg: isActive ? 'accent.bg' : 'bg.subtle' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'accent.fg' : 'text.secondary'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'accent.fg' : 'text.secondary'}>
          {label}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const intl = useIntl();
  const [isAddNewOpen, setIsAddNewOpen] = useState(false);

  return (
    <Box
      as="nav"
      w="260px"
      flexShrink={0}
      bg="bg.surface"
      borderInlineEndWidth="1px"
      borderColor="border.default"
      minH="100%"
      py={6}
      px={4}
      display="flex"
      flexDirection="column"
    >
      <Button
        leftIcon={<Icon as={FiPlus} boxSize={4} />}
        w="100%"
        mb={4}
        onClick={() => setIsAddNewOpen(true)}
      >
        {intl.formatMessage({ id: 'addNew.buttonLabel', defaultMessage: 'Add new' })}
      </Button>

      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={intl.formatMessage({ id: link.labelId })}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to, link.exact)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.labelId} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="text.secondary" mt={4} mb={2} px={3}>
            {intl.formatMessage({ id: group.labelId })}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={intl.formatMessage({ id: item.labelId })}
                  icon={item.icon}
                  isActive={isLinkActive(pathname, to)}
                  onClick={() => navigate(to)}
                />
              );
            })}
          </VStack>
        </Box>
      ))}

      <Box flex={1} />
      <LanguageToggle />
      <FontSizeToggle />
      <ColorModeToggle />
      <LogoutButton />

      <AddNewModal isOpen={isAddNewOpen} onClose={() => setIsAddNewOpen(false)} />
    </Box>
  );
}
