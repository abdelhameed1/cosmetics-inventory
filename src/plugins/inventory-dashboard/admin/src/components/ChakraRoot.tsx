import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { getTheme, themeConfig } from '../theme';
import { LocaleProvider, useLocale } from '../i18n/LocaleProvider';

function ThemedShell({ children }: { children: ReactNode }) {
  const { locale } = useLocale();

  return (
    <ChakraProvider theme={getTheme(locale)} resetCSS={false}>
      <Box bg="bg.canvas" color="text.primary" minH="100%" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </Box>
    </ChakraProvider>
  );
}

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={themeConfig.initialColorMode} />
      <LocaleProvider>
        <ThemedShell>{children}</ThemedShell>
      </LocaleProvider>
    </>
  );
}
