import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertDialog, AlertDialogBody, AlertDialogContent, AlertDialogFooter,
  AlertDialogHeader, AlertDialogOverlay, Box, Button, IconButton, Input,
  InputGroup, InputLeftElement, InputRightElement, Text, Td, Tr,
} from '@chakra-ui/react';
import { FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { useApi } from '../utils/api';
import { useSchema } from '../hooks/useSchema';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable } from '../components/ui/DataTable';
import { getFieldLabel } from '../i18n/fieldLabels';
import { getResourceLabel } from '../i18n/resourceLabels';
import { useLocale } from '../i18n/LocaleProvider';

export default function ResourceListPage() {
  const { resource = '' } = useParams();
  const navigate = useNavigate();
  const api = useApi();
  const intl = useIntl();
  const { locale } = useLocale();
  const { schema } = useSchema(resource);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

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
      setError(e?.response?.data?.error?.message ?? intl.formatMessage({ id: 'error.deleteFailed', defaultMessage: 'Delete failed' }));
      setToDelete(null);
    }
  };

  return (
    <Box p={{ base: 4, md: 8 }}>
      <PageHeader
        title={getResourceLabel(intl, resource)}
        actions={<Button onClick={() => navigate('new')}>{intl.formatMessage({ id: 'common.new', defaultMessage: 'New' })}</Button>}
      />

      <Box pb={4}>
        <InputGroup maxW="sm">
          <InputLeftElement pointerEvents="none"><FiSearch color="var(--chakra-colors-gray-400)" /></InputLeftElement>
          <Input
            aria-label={intl.formatMessage({ id: 'resourceList.searchAria', defaultMessage: 'Search' })}
            placeholder={intl.formatMessage({ id: 'resourceList.searchPlaceholder', defaultMessage: 'Search by name' })}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <InputRightElement>
              <IconButton
                aria-label={intl.formatMessage({ id: 'resourceList.clearSearchAria', defaultMessage: 'Clear search' })}
                icon={<FiX />}
                size="sm"
                variant="ghost"
                onClick={() => setSearch('')}
              />
            </InputRightElement>
          )}
        </InputGroup>
      </Box>

      {error && <Text color="red.600" pb={4}>{error}</Text>}

      <DataTable
        columns={[
          ...visibleFields.map((f) => getFieldLabel(intl, f.name)),
          intl.formatMessage({ id: 'resourceList.actionsColumn', defaultMessage: 'Actions' }),
        ]}
        isEmpty={rows.length === 0}
      >
        {rows.map((row) => (
          <Tr
            key={row.documentId}
            cursor="pointer"
            _hover={{ bg: 'bg.subtle' }}
            onClick={() => navigate(row.documentId)}
          >
            {visibleFields.map((f) => (
              <Td key={f.name}>{renderCell(row[f.name])}</Td>
            ))}
            <Td onClick={(e) => e.stopPropagation()}>
              <IconButton
                aria-label={intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
                icon={<FiTrash2 />}
                size="sm"
                variant="ghost"
                colorScheme="red"
                onClick={() => setToDelete(row)}
              />
            </Td>
          </Tr>
        ))}
      </DataTable>

      <AlertDialog isOpen={!!toDelete} leastDestructiveRef={cancelRef} onClose={() => setToDelete(null)}>
        <AlertDialogOverlay>
          <AlertDialogContent borderRadius="xl" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>{intl.formatMessage({ id: 'resourceList.confirmDeleteTitle', defaultMessage: 'Confirm delete' })}</AlertDialogHeader>
            <AlertDialogBody>{intl.formatMessage({ id: 'resourceList.confirmDeleteBody', defaultMessage: 'Delete this record? This cannot be undone.' })}</AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} variant="ghost" onClick={() => setToDelete(null)}>
                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
              </Button>
              <Button colorScheme="red" onClick={confirmDelete} ms={3}>
                {intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
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
