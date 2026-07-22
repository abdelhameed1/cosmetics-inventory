// src/plugins/inventory-dashboard/admin/src/components/AppSidebar.tsx
import { Box, Heading, HStack, Icon, VStack, Text } from '@chakra-ui/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TOP_LINKS, CATALOG_GROUPS, type IconComponent } from '../config/navConfig';

function isLinkActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NavButton({
  label, icon: IconComp, isActive, onClick,
}: { label: string; icon: IconComponent; isActive: boolean; onClick: () => void }) {
  return (
    <Box
      as="button"
      w="100%"
      textAlign="left"
      px={3}
      py={2}
      borderRadius="lg"
      bg={isActive ? 'brand.50' : 'transparent'}
      _hover={{ bg: isActive ? 'brand.50' : 'gray.50' }}
      onClick={onClick}
    >
      <HStack spacing={3}>
        <Icon as={IconComp} boxSize={4} color={isActive ? 'brand.700' : 'gray.500'} />
        <Text fontSize="sm" fontWeight={isActive ? 'semibold' : 'normal'} color={isActive ? 'brand.700' : 'gray.700'}>
          {label}
        </Text>
      </HStack>
    </Box>
  );
}

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <Box as="nav" w="240px" flexShrink={0} bg="white" borderRightWidth="1px" borderColor="gray.100" minH="100%" py={6} px={4}>
      <VStack align="stretch" spacing={1} pb={6}>
        {TOP_LINKS.map((link) => (
          <NavButton
            key={link.to}
            label={link.label}
            icon={link.icon}
            isActive={isLinkActive(pathname, link.to)}
            onClick={() => navigate(link.to)}
          />
        ))}
      </VStack>

      {CATALOG_GROUPS.map((group) => (
        <Box key={group.label} mb={6}>
          <Heading size="xs" textTransform="uppercase" color="gray.500" mb={2} px={3}>
            {group.label}
          </Heading>
          <VStack align="stretch" spacing={1}>
            {group.items.map((item) => {
              const to = `/plugins/inventory-catalog/${item.slug}`;
              return (
                <NavButton
                  key={item.slug}
                  label={item.label}
                  icon={item.icon}
                  isActive={isLinkActive(pathname, to)}
                  onClick={() => navigate(to)}
                />
              );
            })}
          </VStack>
        </Box>
      ))}
    </Box>
  );
}
