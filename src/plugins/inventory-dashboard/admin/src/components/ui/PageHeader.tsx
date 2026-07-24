import { Flex, Heading, HStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" mb={8}>
      <Heading size="lg" color="text.primary" fontWeight="bold" textTransform="capitalize">{title}</Heading>
      {actions && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}
