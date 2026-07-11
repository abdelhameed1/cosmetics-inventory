import { ChakraProvider, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import theme from '../theme';

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <ChakraProvider theme={theme} resetCSS={false}>
      <Box bg="gray.50" color="gray.800" minH="100%">
        {children}
      </Box>
    </ChakraProvider>
  );
}
