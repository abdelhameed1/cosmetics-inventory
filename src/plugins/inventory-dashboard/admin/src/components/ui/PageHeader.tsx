import { Flex, Heading, HStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function PageHeader({ title, badge, actions }: { title: string; badge?: ReactNode; actions?: ReactNode }) {
  return (
    <Flex justify="space-between" align="center" mb={8}>
      <HStack spacing={3}>
        <Heading size="lg" color="text.primary" fontWeight="bold" textTransform="capitalize">{title}</Heading>
        {badge}
      </HStack>
      {actions && <HStack spacing={2}>{actions}</HStack>}
    </Flex>
  );
}
