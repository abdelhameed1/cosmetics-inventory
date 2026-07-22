// src/plugins/inventory-dashboard/admin/src/pages/CatalogStandalone.tsx
import { Page } from '@strapi/strapi/admin';
import { Routes, Route } from 'react-router-dom';
import { ChakraRoot } from '../components/ChakraRoot';
import { AppShell } from '../components/AppShell';
import CatalogHub from './CatalogHub';
import ResourceListPage from './ResourceListPage';
import ResourceFormPage from './ResourceFormPage';

export default function CatalogStandalone() {
  return (
    <ChakraRoot>
      <AppShell>
        <Routes>
          <Route index element={<CatalogHub />} />
          <Route path=":resource" element={<ResourceListPage />} />
          <Route path=":resource/new" element={<ResourceFormPage />} />
          <Route path=":resource/:id" element={<ResourceFormPage />} />
          <Route path="*" element={<Page.Error />} />
        </Routes>
      </AppShell>
    </ChakraRoot>
  );
}
