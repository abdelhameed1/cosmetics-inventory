import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import Overview from './Overview';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';
import StockPurchase from './StockPurchase';
import OrderForm from './OrderForm';

const App = () => {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="stock-purchase" element={<StockPurchase />} />
      <Route path="orders/new" element={<OrderForm />} />
      <Route path="orders/:id" element={<OrderForm />} />
      <Route path="r/:resource" element={<ResourceListPage />} />
      <Route path="r/:resource/new" element={<ResourceFormPage />} />
      <Route path="r/:resource/:id" element={<ResourceFormPage />} />
      <Route path="*" element={<Page.Error />} />
    </Routes>
  );
};

export default App;
