// src/plugins/inventory-dashboard/admin/src/components/LanguageToggle.tsx
import { Box, HStack, Icon, Text } from '@chakra-ui/react';
import { FiGlobe } from 'react-icons/fi';
import { useLocale } from '../i18n/LocaleProvider';

export function LanguageToggle() {
  const { locale, setLocale } = useLocale();
  const isArabic = locale === 'ar';

  return (
    <Box
      as="button"
      w="100%"
      textAlign="start"
      px={3}
      py={2}
      borderRadius="lg"
      _hover={{ bg: 'bg.subtle' }}
      onClick={() => setLocale(isArabic ? 'en' : 'ar')}
    >
      <HStack spacing={3}>
        <Icon as={FiGlobe} boxSize={4} color="text.secondary" />
        {/* Target-language name, not translated content — always rendered in its
            own script regardless of the currently active locale. */}
        <Text fontSize="sm" color="text.secondary">{isArabic ? 'English' : 'العربية'}</Text>
      </HStack>
    </Box>
  );
}
