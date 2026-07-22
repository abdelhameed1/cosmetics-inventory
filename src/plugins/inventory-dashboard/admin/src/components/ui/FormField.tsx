import { FormControl, FormLabel, type FormControlProps } from '@chakra-ui/react';
import { type ReactNode } from 'react';

export function FormField({
  label, required, children, ...rest
}: { label: string; required?: boolean; children: ReactNode } & FormControlProps) {
  return (
    <FormControl isRequired={required} {...rest}>
      <FormLabel textTransform="capitalize" fontSize="sm" fontWeight="semibold" color="gray.700">{label}</FormLabel>
      {children}
    </FormControl>
  );
}
