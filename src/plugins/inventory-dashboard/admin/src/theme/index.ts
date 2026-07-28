import { extendTheme, type ThemeConfig } from '@chakra-ui/react';
import { type Locale } from '../i18n/LocaleProvider';
import { type FontSizePreset } from './FontSizeProvider';

export const themeConfig: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false,
};

const fontStack = `'Noto Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Roboto, sans-serif`;

const fontSizeScales: Record<FontSizePreset, Record<string, string>> = {
  small: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  },
  medium: {
    xs: '0.8125rem',
    sm: '0.9375rem',
    md: '1.0625rem',
    lg: '1.1875rem',
    xl: '1.375rem',
    '2xl': '1.625rem',
    '3xl': '2rem',
  },
  large: {
    xs: '0.875rem',
    sm: '1rem',
    md: '1.125rem',
    lg: '1.25rem',
    xl: '1.5rem',
    '2xl': '1.75rem',
    '3xl': '2.125rem',
  },
};

const baseTheme = {
  config: themeConfig,
  colors: {
    brand: {
      50: '#eef4ff',
      100: '#d9e6ff',
      200: '#b3ccff',
      300: '#82adff',
      400: '#4d8bff',
      500: '#2563eb',
      600: '#1d4fc4',
      700: '#173e99',
      800: '#122e73',
      900: '#0c1f4d',
    },
  },
  fonts: {
    heading: fontStack,
    body: fontStack,
  },
  shadows: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
    cardHover: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.06)',
  },
  semanticTokens: {
    colors: {
      'bg.canvas': { default: 'gray.50', _dark: 'gray.900' },
      'bg.surface': { default: 'white', _dark: 'gray.800' },
      'bg.subtle': { default: 'gray.50', _dark: 'gray.700' },
      'border.default': { default: 'gray.100', _dark: 'gray.700' },
      'text.primary': { default: 'gray.800', _dark: 'gray.100' },
      'text.secondary': { default: 'gray.500', _dark: 'gray.400' },
      'accent.bg': { default: 'brand.50', _dark: 'rgba(77, 139, 255, 0.16)' },
      'accent.fg': { default: 'brand.600', _dark: 'brand.300' },
    },
  },
  components: {
    Button: {
      baseStyle: { borderRadius: 'lg', fontWeight: 'semibold' },
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: {
      baseStyle: { borderRadius: 'md', px: 2, py: 0.5 },
    },
    Table: {
      variants: {
        simple: {
          th: {
            color: 'text.secondary',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'border.default',
            py: 3,
          },
          td: { borderColor: 'border.default', py: 3 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'border.default',
          boxShadow: 'card',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg', bg: 'bg.surface' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'lg', bg: 'bg.surface' },
    },
  },
};

export function getTheme(locale: Locale, fontSizePreset: FontSizePreset) {
  return extendTheme({
    ...baseTheme,
    fontSizes: fontSizeScales[fontSizePreset],
    direction: locale === 'ar' ? 'rtl' : 'ltr',
  });
}
