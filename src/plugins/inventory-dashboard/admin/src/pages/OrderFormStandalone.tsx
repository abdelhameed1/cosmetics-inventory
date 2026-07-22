import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import OrderForm from './OrderForm';

export default function OrderFormStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <OrderForm />
      </AppShell>
    </ChakraRoot>
  );
}
