import { Table, TableContainer, Tbody, Td, Text, Th, Thead, Tr } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function DataTable({
  columns, isEmpty, emptyLabel = 'No records found', children,
}: { columns: string[]; isEmpty: boolean; emptyLabel?: string; children: ReactNode }) {
  return (
    <TableContainer bg="white" borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100">
      <Table variant="simple">
        <Thead bg="gray.50">
          <Tr>
            {columns.map((c) => <Th key={c}>{c}</Th>)}
          </Tr>
        </Thead>
        <Tbody>
          {isEmpty ? (
            <Tr>
              <Td colSpan={columns.length}>
                <Text color="gray.500" textAlign="center" py={6}>{emptyLabel}</Text>
              </Td>
            </Tr>
          ) : children}
        </Tbody>
      </Table>
    </TableContainer>
  );
}
