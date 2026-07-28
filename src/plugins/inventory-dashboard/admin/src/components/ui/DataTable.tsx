import { Card, CardBody, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { useIntl } from 'react-intl';

export function DataTable({
  columns, isEmpty, emptyLabel, children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  const intl = useIntl();
  const resolvedEmptyLabel = emptyLabel ?? intl.formatMessage({ id: 'dataTable.emptyLabel', defaultMessage: 'No records found' });

  return (
    <Card overflow="hidden">
      <CardBody p={0}>
        <TableContainer>
          <Table variant="simple">
            <Thead bg="bg.subtle">
              <Tr>
                {columns.map((c) => <Th key={c}>{c}</Th>)}
              </Tr>
            </Thead>
            <Tbody>
              {isEmpty ? (
                <Tr>
                  <Td colSpan={columns.length}>
                    <Text color="text.secondary" textAlign="center" py={6}>{resolvedEmptyLabel}</Text>
                  </Td>
                </Tr>
              ) : children}
            </Tbody>
          </Table>
        </TableContainer>
      </CardBody>
    </Card>
  );
}
