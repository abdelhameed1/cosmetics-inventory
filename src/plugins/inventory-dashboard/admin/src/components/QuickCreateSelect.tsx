import { lazy, Suspense, useState } from 'react';
import {
  Center, HStack, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Select,
  Spinner,
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { useIntl } from 'react-intl';
import { FormField } from './ui/FormField';
import { useLocale } from '../i18n/LocaleProvider';

// Lazy-loaded: only rendered once the "create new" modal is opened, and this
// keeps InlineResourceForm splittable into its own chunk instead of being
// pulled into every chunk that statically imports QuickCreateSelect.
const InlineResourceForm = lazy(() => import('./InlineResourceForm').then((m) => ({ default: m.InlineResourceForm })));

interface QuickCreateSelectProps {
  resource: string;
  label: string;
  value: string;
  onChange: (documentId: string) => void;
  options: any[];
  onCreated: (record: any) => void;
  required?: boolean;
  isDisabled?: boolean;
  mainField?: string;
}

export function QuickCreateSelect({
  resource, label, value, onChange, options, onCreated, required, isDisabled, mainField = 'name',
}: QuickCreateSelectProps) {
  const intl = useIntl();
  const { locale } = useLocale();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleCreated = (created?: any) => {
    if (created) {
      onCreated(created);
      onChange(created.documentId);
    }
    setIsCreateOpen(false);
  };

  return (
    <>
      <FormField label={label} required={required}>
        <HStack spacing={2}>
          <Select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            isDisabled={isDisabled}
            placeholder={intl.formatMessage(
              { id: 'quickCreate.selectPlaceholder', defaultMessage: 'Select {label}' },
              { label: label.toLowerCase() }
            )}
          >
            {options.map((o) => (
              <option key={o.documentId} value={o.documentId}>
                {String(o[mainField] ?? o.documentId)}
              </option>
            ))}
          </Select>
          <IconButton
            aria-label={intl.formatMessage(
              { id: 'quickCreate.createNewAria', defaultMessage: 'Create new {label}' },
              { label }
            )}
            icon={<FiPlus />}
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
          />
        </HStack>
      </FormField>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent fontSize="md" borderRadius="xl" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
          <ModalHeader>
            {intl.formatMessage({ id: 'addNew.newItemTitle', defaultMessage: 'New {label}' }, { label })}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <Suspense fallback={<Center py={10}><Spinner /></Center>}>
              <InlineResourceForm
                resource={resource}
                onDone={handleCreated}
                onCancel={() => setIsCreateOpen(false)}
              />
            </Suspense>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
