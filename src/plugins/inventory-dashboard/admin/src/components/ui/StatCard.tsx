import { Box, Text } from '@chakra-ui/react';

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="white" borderRadius="xl" boxShadow="sm" borderWidth="1px" borderColor="gray.100" p={5}>
      <Text fontSize="sm" color="gray.500" fontWeight="medium">{label}</Text>
      <Text fontSize="2xl" fontWeight="bold" color="gray.800" mt={1}>{value}</Text>
    </Box>
  );
}
