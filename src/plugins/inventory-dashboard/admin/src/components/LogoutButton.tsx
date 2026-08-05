// src/plugins/inventory-dashboard/admin/src/components/LogoutButton.tsx
import { Box, HStack, Icon, Text } from '@chakra-ui/react';
import { useAuth } from '@strapi/strapi/admin';
import { FiLogOut } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';

export function LogoutButton() {
  const intl = useIntl();
  const navigate = useNavigate();
  const logout = useAuth('LogoutButton', (state) => state.logout);

  const handleLogout = () => {
    // useAuth() is built on use-context-selector: if this component renders
    // before AuthProvider's context value is populated (a timing edge case
    // that only surfaces in production builds, not dev — see
    // @strapi/admin's own Auth.mjs comment and strapi/strapi#24384), it
    // silently returns undefined instead of throwing. Guard the call the
    // same way Strapi's own core does for its checkUserHasPermissions
    // consumer, so a stale/undefined `logout` can't crash the whole shell.
    if (typeof logout === 'function') {
      logout();
    }
    navigate('/auth/login');
  };

  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="md"
      _hover={{ bg: 'bg.subtle' }}
      onClick={handleLogout}
    >
      <HStack spacing={3}>
        <Icon as={FiLogOut} boxSize={4} color="text.secondary" />
        <Text fontSize="sm" color="text.secondary">
          {intl.formatMessage({ id: 'nav.logout', defaultMessage: 'Log out' })}
        </Text>
      </HStack>
    </Box>
  );
}
