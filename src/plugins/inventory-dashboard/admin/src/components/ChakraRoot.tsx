import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import theme from '../theme';

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={theme.config.initialColorMode} />
      <ChakraProvider theme={theme} resetCSS={false}>
        <Box bg="bg.canvas" color="text.primary" minH="100%">
          {children}
        </Box>
      </ChakraProvider>
    </>
  );
}
