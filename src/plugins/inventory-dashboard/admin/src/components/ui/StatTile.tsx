import { HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { type IconComponent } from '../../config/navConfig';

export function StatTile({
  label, value, icon, size = 'stat',
}: { label: string; value?: string; icon: IconComponent; size?: 'stat' | 'tile' }) {
  const chipSize = size === 'stat' ? 10 : 9;
  const iconSize = size === 'stat' ? 5 : 4;

  return (
    <HStack spacing={size === 'stat' ? 4 : 3} align={value ? 'flex-start' : 'center'}>
      <VStack align="center" justify="center" bg="accent.bg" borderRadius="sm" boxSize={chipSize} flexShrink={0}>
        <Icon as={icon} boxSize={iconSize} color="accent.fg" />
      </VStack>
      <VStack align="flex-start" spacing={0}>
        <Text fontSize="sm" color={value ? 'text.secondary' : 'text.primary'} fontWeight={value ? 'medium' : 'semibold'}>
          {label}
        </Text>
        {value && <Text fontSize="2xl" fontWeight="bold" color="text.primary">{value}</Text>}
      </VStack>
    </HStack>
  );
}
