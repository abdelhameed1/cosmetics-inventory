import { Card, CardBody, Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function DataTable({
  columns, isEmpty, emptyLabel = 'No records found', children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
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
                    <Text color="text.secondary" textAlign="center" py={6}>{emptyLabel}</Text>
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
