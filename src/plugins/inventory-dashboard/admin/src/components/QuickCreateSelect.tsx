import { useState } from 'react';
import {
  HStack, IconButton, Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, Select,
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { FormField } from './ui/FormField';
import { InlineResourceForm } from './InlineResourceForm';

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
            placeholder={`Select ${label.toLowerCase()}`}
          >
            {options.map((o) => (
              <option key={o.documentId} value={o.documentId}>
                {String(o[mainField] ?? o.documentId)}
              </option>
            ))}
          </Select>
          <IconButton
            aria-label={`Create new ${label}`}
            icon={<FiPlus />}
            variant="outline"
            onClick={() => setIsCreateOpen(true)}
          />
        </HStack>
      </FormField>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{`New ${label}`}</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <InlineResourceForm
              resource={resource}
              onDone={handleCreated}
              onCancel={() => setIsCreateOpen(false)}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
