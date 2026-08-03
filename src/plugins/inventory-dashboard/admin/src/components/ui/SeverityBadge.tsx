import { Badge, type BadgeProps } from '@chakra-ui/react';
import { type ReactNode } from 'react';
import { type Severity } from '../../utils/severity';

export function SeverityBadge({
  severity, children, ...rest
}: { severity: Severity; children: ReactNode } & Omit<BadgeProps, 'bg' | 'color' | 'borderColor'>) {
  return (
    <Badge
      bg={`severity.${severity}.bg`}
      color={`severity.${severity}.fg`}
      borderWidth="1px"
      borderColor={`severity.${severity}.border`}
      {...rest}
    >
      {children}
    </Badge>
  );
}
