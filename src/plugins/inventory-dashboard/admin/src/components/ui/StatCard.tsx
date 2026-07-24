import { Card, CardBody, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { type IconComponent } from '../../config/navConfig';

export function StatCard({ label, value, icon }: { label: string; value: string; icon: IconComponent }) {
  return (
    <Card>
      <CardBody>
        <HStack spacing={4} align="flex-start">
          <VStack align="center" justify="center" bg="accent.bg" borderRadius="lg" boxSize={10} flexShrink={0}>
            <Icon as={icon} boxSize={5} color="accent.fg" />
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="sm" color="text.secondary" fontWeight="medium">{label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="text.primary">{value}</Text>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}
