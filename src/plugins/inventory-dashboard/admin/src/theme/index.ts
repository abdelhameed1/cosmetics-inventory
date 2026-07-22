import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
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
    heading: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
    body: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  },
  shadows: {
    card: '0 1px 3px rgba(17, 24, 39, 0.06), 0 1px 2px rgba(17, 24, 39, 0.04)',
    cardHover: '0 4px 12px rgba(17, 24, 39, 0.08), 0 2px 4px rgba(17, 24, 39, 0.06)',
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
            color: 'gray.500',
            fontSize: 'xs',
            textTransform: 'uppercase',
            letterSpacing: 'wide',
            borderColor: 'gray.100',
            py: 3,
          },
          td: { borderColor: 'gray.100', py: 3 },
        },
      },
    },
    Card: {
      baseStyle: {
        container: {
          bg: 'white',
          borderRadius: 'xl',
          borderWidth: '1px',
          borderColor: 'gray.100',
          boxShadow: 'card',
        },
      },
    },
    Input: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    NumberInput: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    Select: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { field: { borderRadius: 'lg' } },
    },
    Textarea: {
      defaultProps: { focusBorderColor: 'brand.500' },
      baseStyle: { borderRadius: 'lg' },
    },
  },
});

export default theme;
