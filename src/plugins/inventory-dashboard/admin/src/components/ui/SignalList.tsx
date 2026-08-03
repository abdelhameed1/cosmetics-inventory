import { Box, Card, CardBody, Divider, Heading, HStack, Icon, Text, Tooltip, VStack, useColorModeValue } from '@chakra-ui/react';
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
  const hoverBg = useColorModeValue('gray.100', 'gray.700');
  const contextColor = useColorModeValue('gray.600', 'gray.400');

  return (
    <Card>
      <CardBody>
        <HStack justify="space-between" mb={4}>
          <HStack spacing={2}>
            <Icon as={HeaderIcon} boxSize={6} color={`severity.${severity}.fg`} />
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
          <VStack align="stretch" spacing={0} maxH="360px" overflowY="auto" divider={<Divider borderColor="border.default" />}>
            {rows.map((row) => {
              const rowContent = (
                <>
                  <Box w="4px" alignSelf="stretch" bg={`severity.${severity}.fg`} borderRadius="full" flexShrink={0} />
                  <VStack align="flex-start" spacing={0} flex={1} minW={0}>
                    <Tooltip label={row.label} openDelay={400} hasArrow>
                      <Text fontSize="sm" fontWeight="medium" color="text.primary" noOfLines={1}>{row.label}</Text>
                    </Tooltip>
                    <Tooltip label={row.context} openDelay={400} hasArrow>
                      <Text fontSize="xs" color={contextColor} noOfLines={1}>{row.context}</Text>
                    </Tooltip>
                  </VStack>
                  {row.metric && <Text fontSize="sm" color="text.secondary" flexShrink={0}>{row.metric}</Text>}
                </>
              );

              return row.onClick ? (
                <HStack
                  key={row.id}
                  as="button"
                  type="button"
                  py={2}
                  px={0}
                  spacing={3}
                  align="center"
                  width="100%"
                  textAlign="start"
                  bg="transparent"
                  border="none"
                  cursor="pointer"
                  onClick={row.onClick}
                  _hover={{ bg: hoverBg }}
                >
                  {rowContent}
                </HStack>
              ) : (
                <HStack
                  key={row.id}
                  py={2}
                  px={0}
                  spacing={3}
                  align="center"
                  width="100%"
                  textAlign="start"
                >
                  {rowContent}
                </HStack>
              );
            })}
          </VStack>
        )}
      </CardBody>
    </Card>
  );
}
