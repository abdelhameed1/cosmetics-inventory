// src/plugins/inventory-dashboard/admin/src/components/ColorModeToggle.tsx
import { Box, HStack, Icon, Text, useColorMode } from '@chakra-ui/react';
import { FiMoon, FiSun } from 'react-icons/fi';

export function ColorModeToggle() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  return (
    <Box
      as="button"
      w="100%"
      textAlign="left"
      px={3}
      py={2}
      borderRadius="lg"
      _hover={{ bg: 'bg.subtle' }}
      onClick={toggleColorMode}
    >
      <HStack spacing={3}>
        <Icon as={isDark ? FiSun : FiMoon} boxSize={4} color="text.secondary" />
        <Text fontSize="sm" color="text.secondary">
          {isDark ? 'Light mode' : 'Dark mode'}
        </Text>
      </HStack>
    </Box>
  );
}
