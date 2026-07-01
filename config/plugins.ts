import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  'inventory-dashboard': {
    enabled: true,
    resolve: './src/plugins/inventory-dashboard',
  },
});

export default config;
