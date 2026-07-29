import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';
import StockPurchase from './StockPurchase';
import OrderForm from './OrderForm';
import OrdersList from './OrdersList';
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';

const App = () => {
  return (
    <ChakraRoot>
      <AppShell>
        <Routes>
          <Route index element={<Overview />} />
          <Route path="stock-purchase" element={<StockPurchase />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/new" element={<OrderForm />} />
          <Route path="orders/:id" element={<OrderForm />} />
          <Route path="r/:resource" element={<ResourceListPage />} />
          <Route path="r/:resource/new" element={<ResourceFormPage />} />
          <Route path="r/:resource/:id" element={<ResourceFormPage />} />
          <Route path="*" element={<Page.Error />} />
        </Routes>
      </AppShell>
    </ChakraRoot>
  );
};

export default App;
