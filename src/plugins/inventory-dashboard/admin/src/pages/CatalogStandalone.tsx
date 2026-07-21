// src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import { ChakraRoot } from '../components/ChakraRoot';
import CatalogLayout from './CatalogLayout';
import CatalogHub from './CatalogHub';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';

export default function CatalogStandalone() {
  return (
    <ChakraRoot>
      <Routes>
        <Route element={<CatalogLayout />}>
          <Route index element={<CatalogHub />} />
          <Route path=":resource" element={<ResourceListPage />} />
          <Route path=":resource/new" element={<ResourceFormPage />} />
          <Route path=":resource/:id" element={<ResourceFormPage />} />
        </Route>
        <Route path="*" element={<Page.Error />} />
      </Routes>
    </ChakraRoot>
  );
}
