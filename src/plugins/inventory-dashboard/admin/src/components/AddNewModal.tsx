// src/plugins/inventory-dashboard/admin/src/components/AddNewModal.tsx
import {
  Badge, Box, Card, CardBody, Heading, HStack, Icon, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalHeader, ModalOverlay, SimpleGrid, Text, VStack,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { ADD_NEW_GROUPS } from '../config/addNewConfig';

export function AddNewModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const navigate = useNavigate();

  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add new</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {ADD_NEW_GROUPS.map((group) => (
            <Box key={group.label} pb={6}>
              <Heading size="xs" textTransform="uppercase" color="gray.500" pb={3}>
                {group.label}
              </Heading>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                {group.items.map((item) => (
                  <Card
                    key={item.slug}
                    as="button"
                    textAlign="left"
                    cursor="pointer"
                    transition="box-shadow 0.15s, border-color 0.15s"
                    _hover={{ borderColor: 'brand.200', boxShadow: 'cardHover' }}
                    onClick={() => go(item.path)}
                  >
                    <CardBody>
                      <HStack justify="space-between">
                        <HStack spacing={3}>
                          <VStack align="center" justify="center" bg="brand.50" borderRadius="lg" boxSize={9} flexShrink={0}>
                            <Icon as={item.icon} boxSize={4} color="brand.600" />
                          </VStack>
                          <Text fontSize="sm" fontWeight="semibold" color="gray.800">{item.label}</Text>
                        </HStack>
                        {item.kind === 'wizard' && <Badge colorScheme="brand">Guided</Badge>}
                      </HStack>
                    </CardBody>
                  </Card>
                ))}
              </SimpleGrid>
            </Box>
          ))}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
