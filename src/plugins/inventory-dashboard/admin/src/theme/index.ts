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
  radii: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
  },
  fonts: {
    heading: fontStack,
    body: fontStack,
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
      'severity.critical.bg': { default: 'oklch(94% .05 22)', _dark: 'oklch(30% .07 22)' },
      'severity.critical.fg': { default: 'oklch(46% .16 22)', _dark: 'oklch(74% .14 22)' },
      'severity.critical.border': { default: 'oklch(82% .09 22)', _dark: 'oklch(42% .1 22)' },
      'severity.warning.bg': { default: 'oklch(94% .05 75)', _dark: 'oklch(30% .07 75)' },
      'severity.warning.fg': { default: 'oklch(46% .16 75)', _dark: 'oklch(74% .14 75)' },
      'severity.warning.border': { default: 'oklch(82% .09 75)', _dark: 'oklch(42% .1 75)' },
      'severity.success.bg': { default: 'oklch(94% .05 152)', _dark: 'oklch(30% .07 152)' },
      'severity.success.fg': { default: 'oklch(46% .16 152)', _dark: 'oklch(74% .14 152)' },
      'severity.success.border': { default: 'oklch(82% .09 152)', _dark: 'oklch(42% .1 152)' },
      'severity.info.bg': { default: 'oklch(94% .03 258)', _dark: 'oklch(32% .05 258)' },
      'severity.info.fg': { default: 'oklch(52% .17 258)', _dark: 'oklch(76% .12 258)' },
      'severity.info.border': { default: 'oklch(88% .06 258)', _dark: 'oklch(44% .09 258)' },
      'severity.neutral.bg': { default: 'gray.100', _dark: 'gray.700' },
      'severity.neutral.fg': { default: 'gray.600', _dark: 'gray.300' },
      'severity.neutral.border': { default: 'gray.200', _dark: 'gray.600' },
    },
    shadows: {
      'shadow.resting': {
        default: '0 1px 3px rgba(20,20,30,.07), 0 1px 2px rgba(20,20,30,.05)',
        _dark: 'none',
      },
      'shadow.raised': {
        default: '0 8px 24px rgba(20,20,30,.12), 0 2px 6px rgba(20,20,30,.06)',
        _dark: '0 8px 24px rgba(0,0,0,.35), 0 0 0 1px rgba(77,139,255,0.4)',
      },
    },
  },
  components: {
    Button: {
      baseStyle: { borderRadius: 'md', fontWeight: 'semibold' },
      defaultProps: { colorScheme: 'brand' },
    },
    Badge: {
      baseStyle: { borderRadius: 'sm', px: 2, py: 0.5 },
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
            py: 4,
          },
          td: { borderColor: 'border.default', py: 4 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'bg.surface',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderColor: 'border.default',
          boxShadow: 'shadow.resting',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'md', bg: 'bg.surface' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'md', bg: 'bg.surface' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'md', bg: 'bg.surface' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'md', bg: 'bg.surface' },
    },
    Stepper: {
      baseStyle: {
        indicator: {
          '&[data-status=active], &[data-status=complete]': {
            bg: 'accent.fg',
            borderColor: 'accent.fg',
            color: 'white',
          },
          '&[data-status=incomplete]': {
            borderColor: 'border.default',
          },
        },
        separator: {
          bg: 'border.default',
          '&[data-status=complete]': {
            bg: 'accent.fg',
          },
        },
      },
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
