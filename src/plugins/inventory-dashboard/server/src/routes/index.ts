export default {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/health', handler: 'health.index', config: { policies: [] } },
      { method: 'GET', path: '/resources', handler: 'resource.list', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource/schema', handler: 'resource.schema', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource', handler: 'resource.find', config: { policies: [] } },
      { method: 'GET', path: '/resources/:resource/:documentId', handler: 'resource.findOne', config: { policies: [] } },
      { method: 'POST', path: '/resources/:resource', handler: 'resource.create', config: { policies: [] } },
      { method: 'PUT', path: '/resources/:resource/:documentId', handler: 'resource.update', config: { policies: [] } },
      { method: 'DELETE', path: '/resources/:resource/:documentId', handler: 'resource.remove', config: { policies: [] } },
      { method: 'GET', path: '/settings', handler: 'settings.get', config: { policies: [] } },
      { method: 'PUT', path: '/settings', handler: 'settings.update', config: { policies: [] } },
      { method: 'GET', path: '/overview', handler: 'overview.index', config: { policies: [] } },
      { method: 'GET', path: '/fifo/:variantDocumentId', handler: 'orders.fifo', config: { policies: [] } },
      { method: 'GET', path: '/orders/:documentId', handler: 'orders.findOne', config: { policies: [] } },
      { method: 'POST', path: '/orders/:documentId/confirm', handler: 'orders.confirm', config: { policies: [] } },
    ],
  },
};
