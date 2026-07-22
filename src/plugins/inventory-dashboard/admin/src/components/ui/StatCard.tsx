import { Card, CardBody, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { type IconComponent } from '../../config/navConfig';

export function StatCard({ label, value, icon }: { label: string; value: string; icon: IconComponent }) {
  return (
    <Card>
      <CardBody>
        <HStack spacing={4} align="flex-start">
          <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={10} flexShrink={0}>
            <Icon as={icon} boxSize={5} color="brand.600" />
          </VStack>
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="sm" color="gray.500" fontWeight="medium">{label}</Text>
            <Text fontSize="2xl" fontWeight="bold" color="gray.800">{value}</Text>
          </VStack>
        </HStack>
      </CardBody>
    </Card>
  );
}
