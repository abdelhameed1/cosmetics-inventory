import type { Core } from "@strapi/strapi";

const bootstrap = async ({ strapi }: { strapi: Core.Strapi }) => {
  await strapi.service("admin::permission").actionProvider.registerMany([
    {
      section: "plugins",
      displayName: "Access the Inventory Dashboard",
      uid: "access",
      pluginName: "inventory-dashboard",
    },
  ]);
};

export default bootstrap;