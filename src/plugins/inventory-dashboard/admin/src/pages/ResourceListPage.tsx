import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Button, Flex, Searchbar, Table, Thead, Tbody, Tr, Th, Td,
  Typography, IconButton, Dialog,
} from '@strapi/design-system';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const { schema } = useSchema(resource);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visibleFields = useMemo(
    () => (schema?.fields ?? []).filter((f) => !f.hidden).slice(0, 6),
    [schema]
  );

  const load = () => {
    api
      .get<{ results: any[] }>(`/resources/${resource}`, { search, pageSize: 100 })
      .then((d) => setRows(d.results))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => { if (resource) load(); /* eslint-disable-next-line */ }, [resource, search]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await api.del(`/resources/${resource}/${toDelete.documentId}`);
      setToDelete(null);
      setError(null);
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Delete failed');
      setToDelete(null);
    }
  };

  return (
    <Box padding={8}>
      <Flex justifyContent="space-between" paddingBottom={4}>
        <Typography variant="alpha">{resource}</Typography>
        <Button onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/new`)}>New</Button>
      </Flex>

      <Box paddingBottom={4}>
        <Searchbar name="search" value={search} onChange={(e: any) => setSearch(e.target.value)}
          onClear={() => setSearch('')} clearLabel="Clear search" placeholder="Search by name">Search</Searchbar>
      </Box>

      {error && <Box paddingBottom={4}><Typography textColor="danger600">{error}</Typography></Box>}

      <Table colCount={visibleFields.length + 1} rowCount={rows.length}>
        <Thead>
          <Tr>
            {visibleFields.map((f) => (<Th key={f.name}><Typography variant="sigma">{f.name}</Typography></Th>))}
            <Th><Typography variant="sigma">Actions</Typography></Th>
          </Tr>
        </Thead>
        <Tbody>
          {rows.map((row) => (
            <Tr key={row.documentId} onClick={() => navigate(`/plugins/inventory-dashboard/r/${resource}/${row.documentId}`)}>
              {visibleFields.map((f) => (
                <Td key={f.name}><Typography>{renderCell(row[f.name])}</Typography></Td>
              ))}
              <Td onClick={(e: any) => e.stopPropagation()}>
                <IconButton onClick={() => setToDelete(row)} label="Delete">✕</IconButton>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Dialog.Root open={!!toDelete} onOpenChange={(open: boolean) => { if (!open) setToDelete(null); }}>
        <Dialog.Content>
          <Dialog.Header>Confirm delete</Dialog.Header>
          <Dialog.Body>
            <Typography>Delete this record? This cannot be undone.</Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button fullWidth variant="tertiary" onClick={() => setToDelete(null)}>Cancel</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button fullWidth variant="danger-light" onClick={confirmDelete}>Delete</Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </Box>
  );
}

function renderCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const v: any = value;
    return v.name ?? v.label ?? v.documentId ?? JSON.stringify(v);
  }
  return String(value);
}
