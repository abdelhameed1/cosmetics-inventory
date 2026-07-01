export default {
  admin: {
    type: 'admin',
    routes: [
      { method: 'GET', path: '/health', handler: 'health.index', config: { policies: [] } },
    ],
  },
};
