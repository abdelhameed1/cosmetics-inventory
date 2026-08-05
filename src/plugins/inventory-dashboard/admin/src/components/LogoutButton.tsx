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
    logout();
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
