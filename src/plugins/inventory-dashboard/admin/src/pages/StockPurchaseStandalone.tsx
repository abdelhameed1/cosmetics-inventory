import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import StockPurchase from './StockPurchase';

export default function StockPurchaseStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <StockPurchase />
      </AppShell>
    </ChakraRoot>
  );
}
