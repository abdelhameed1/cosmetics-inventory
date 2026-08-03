import { Box, Card, CardBody, Divider, Heading, HStack, Icon, Text, VStack } from '@chakra-ui/react';
import { FiAlertOctagon, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { SeverityBadge } from './SeverityBadge';

export interface SignalListRow {
  id: string;
  label: string;
  context: string;
  metric?: string;
  onClick?: () => void;
}

export function SignalList({
  severity, title, rows, emptyLabel,
}: { severity: 'critical' | 'warning'; title: string; rows: SignalListRow[]; emptyLabel: string }) {
  const HeaderIcon = severity === 'critical' ? FiAlertOctagon : FiAlertTriangle;

  return (
    <Card>
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <HStack spacing={2}>
            <Icon as={HeaderIcon} boxSize={5} color={`severity.${severity}.fg`} />
            <Heading size="sm" color="text.primary">{title}</Heading>
          </HStack>
          {rows.length > 0 && <SeverityBadge severity={severity}>{rows.length}</SeverityBadge>}
        </HStack>

        {rows.length === 0 ? (
          <HStack spacing={2} color="severity.success.fg">
            <Icon as={FiCheckCircle} boxSize={4} />
            <Text fontSize="sm">{emptyLabel}</Text>
          </HStack>
        ) : (
          <VStack align="stretch" spacing={0} divider={<Divider borderColor="border.default" />}>
            {rows.map((row) => (
              <HStack
                key={row.id}
                py={2}
                spacing={3}
                align="center"
                cursor={row.onClick ? 'pointer' : 'default'}
                onClick={row.onClick}
                _hover={row.onClick ? { bg: 'bg.subtle' } : undefined}
              >
                <Box w="4px" alignSelf="stretch" bg={`severity.${severity}.fg`} borderRadius="full" flexShrink={0} />
                <VStack align="flex-start" spacing={0} flex={1} minW={0}>
                  <Text fontSize="sm" fontWeight="medium" color="text.primary" noOfLines={1}>{row.label}</Text>
                  <Text fontSize="xs" color="text.secondary" noOfLines={1}>{row.context}</Text>
                </VStack>
                {row.metric && <Text fontSize="sm" color="text.secondary" flexShrink={0}>{row.metric}</Text>}
              </HStack>
            ))}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}
