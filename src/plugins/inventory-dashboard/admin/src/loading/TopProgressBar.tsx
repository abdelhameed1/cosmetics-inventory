// src/plugins/inventory-dashboard/admin/src/loading/TopProgressBar.tsx
import { Box } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { useIsLoading } from './LoadingProvider';

const SHOW_DELAY_MS = 150;
const MIN_VISIBLE_MS = 200;

export function TopProgressBar() {
  const isLoading = useIsLoading();
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    } else if (shownAtRef.current !== null) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimer = setTimeout(() => {
        shownAtRef.current = null;
        setVisible(false);
      }, remaining);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isLoading]);

  if (!visible) return null;

  return (
    <Box position="absolute" top={0} left={0} right={0} height="3px" overflow="hidden" zIndex={10}>
      <Box
        position="absolute"
        top={0}
        bottom={0}
        width="40%"
        bg="accent.fg"
        borderRadius="full"
        sx={{
          animation: 'inventory-dashboard-progress-slide 1.1s ease-in-out infinite',
          '@keyframes inventory-dashboard-progress-slide': {
            '0%': { insetInlineStart: '-40%' },
            '100%': { insetInlineStart: '100%' },
          },
        }}
      />
    </Box>
  );
}
