// src/plugins/inventory-dashboard/admin/src/components/FontSizeToggle.tsx
import { Box, HStack, Text } from '@chakra-ui/react';
import { useIntl } from 'react-intl';
import { useFontSizePreset, type FontSizePreset } from '../theme/FontSizeProvider';

const PRESETS: FontSizePreset[] = ['small', 'medium', 'large'];

const PRESET_LETTER: Record<FontSizePreset, string> = { small: 'S', medium: 'M', large: 'L' };

const PRESET_LABEL_ID: Record<FontSizePreset, string> = {
  small: 'fontSize.small',
  medium: 'fontSize.medium',
  large: 'fontSize.large',
};

export function FontSizeToggle() {
  const { fontSizePreset, setFontSizePreset } = useFontSizePreset();
  const intl = useIntl();

  return (
    <Box px={3} py={2}>
      <Text fontSize="xs" color="text.secondary" pb={1}>
        {intl.formatMessage({ id: 'fontSize.label', defaultMessage: 'Text size' })}
      </Text>
      <HStack spacing={1}>
        {PRESETS.map((preset) => {
          const isActive = preset === fontSizePreset;
          return (
            <Box
              key={preset}
              as="button"
              aria-label={intl.formatMessage({ id: PRESET_LABEL_ID[preset] })}
              aria-pressed={isActive}
              flex={1}
              py={1}
              borderRadius="md"
              textAlign="center"
              bg={isActive ? 'accent.bg' : 'transparent'}
              color={isActive ? 'accent.fg' : 'text.secondary'}
              fontWeight={isActive ? 'semibold' : 'normal'}
              fontSize="sm"
              _hover={{ bg: isActive ? 'accent.bg' : 'bg.subtle' }}
              onClick={() => setFontSizePreset(preset)}
            >
              {PRESET_LETTER[preset]}
            </Box>
          );
        })}
      </HStack>
    </Box>
  );
}
