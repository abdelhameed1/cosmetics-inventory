const requireAccess = {
  name: 'admin::hasPermissions',
  config: { actions: ['plugin::inventory-dashboard.access'] },
};

export default {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/health', handler: 'health.index', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/resources', handler: 'resource.list', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/resources/:resource/schema', handler: 'resource.schema', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/resources/:resource', handler: 'resource.find', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/resources/:resource/:documentId', handler: 'resource.findOne', config: { policies: [requireAccess] } },
      { method: 'POST', path: '/resources/:resource', handler: 'resource.create', config: { policies: [requireAccess] } },
      { method: 'PUT', path: '/resources/:resource/:documentId', handler: 'resource.update', config: { policies: [requireAccess] } },
      { method: 'DELETE', path: '/resources/:resource/:documentId', handler: 'resource.remove', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/settings', handler: 'settings.get', config: { policies: [requireAccess] } },
      { method: 'PUT', path: '/settings', handler: 'settings.update', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/overview', handler: 'overview.index', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/fifo/:variantDocumentId', handler: 'orders.fifo', config: { policies: [requireAccess] } },
      { method: 'GET', path: '/orders/:documentId', handler: 'orders.findOne', config: { policies: [requireAccess] } },
      { method: 'POST', path: '/orders/:documentId/confirm', handler: 'orders.confirm', config: { policies: [requireAccess] } },
      { method: 'POST', path: '/orders/:documentId/cancel', handler: 'orders.cancel', config: { policies: [requireAccess] } },
      { method: 'POST', path: '/pricing/suggest', handler: 'orders.suggest', config: { policies: [requireAccess] } },
    ],
  },
};
