import { ChakraProvider, ColorModeScript, Box } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { getTheme, themeConfig } from '../theme';
import { LocaleProvider, useLocale } from '../i18n/LocaleProvider';
import { FontSizeProvider, useFontSizePreset } from '../theme/FontSizeProvider';
import { LoadingProvider } from '../loading/LoadingProvider';

function ThemedShell({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const { fontSizePreset } = useFontSizePreset();

  return (
    <ChakraProvider theme={getTheme(locale, fontSizePreset)} resetCSS={false}>
      <Box bg="bg.canvas" color="text.primary" minH="100%" fontSize="md" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {children}
      </Box>
    </ChakraProvider>
  );
}

export function ChakraRoot({ children }: { children: ReactNode }) {
  return (
    <>
      <ColorModeScript initialColorMode={themeConfig.initialColorMode} />
      <LoadingProvider>
        <LocaleProvider>
          <FontSizeProvider>
            <ThemedShell>{children}</ThemedShell>
          </FontSizeProvider>
        </LocaleProvider>
      </LoadingProvider>
    </>
  );
}
