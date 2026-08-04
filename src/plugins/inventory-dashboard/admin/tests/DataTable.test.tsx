import React from 'react';
import { render, screen } from './test-utils';
import { DataTable } from '../src/components/ui/DataTable';
import { Tr, Td } from '@chakra-ui/react';

describe('DataTable', () => {
  const columns = ['Name', 'Category', 'Price'];

  it('renders table headers and row content when not empty', () => {
    render(
      <DataTable columns={columns} isEmpty={false}>
        <Tr>
          <Td>Foundation X</Td>
          <Td>High-End Makeup</Td>
          <Td>$45.00</Td>
        </Tr>
      </DataTable>
    );

    columns.forEach((col) => {
      expect(screen.getByText(col)).toBeInTheDocument();
    });
    expect(screen.getByText('Foundation X')).toBeInTheDocument();
    expect(screen.getByText('High-End Makeup')).toBeInTheDocument();
  });

  it('renders default empty message when isEmpty is true', () => {
    render(<DataTable columns={columns} isEmpty={true}>{null}</DataTable>);
    expect(screen.getByText(/no records found/i)).toBeInTheDocument();
  });

  it('renders custom emptyLabel when provided', () => {
    render(
      <DataTable
        columns={columns}
        isEmpty={true}
        emptyLabel="No matching products found."
      >
        {null}
      </DataTable>
    );
    expect(screen.getByText('No matching products found.')).toBeInTheDocument();
  });
});
