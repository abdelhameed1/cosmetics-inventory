import { getTranslation } from "./utils/getTranslation";
import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import { Database, Briefcase, ShoppingCart, Folder } from "@strapi/icons";

import type { StrapiApp } from "@strapi/strapi/admin";

const REQUIRED_PERMISSIONS = [
  { action: 'plugin::inventory-dashboard.access', subject: null },
];

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: Database,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Inventory',
      },
      Component: () => import("./pages/App"),
      permissions: REQUIRED_PERMISSIONS,
    });

    app.addMenuLink({
      to: `/plugins/inventory-stock`,
      icon: Briefcase,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.stock-purchase`,
        defaultMessage: 'Stock purchase',
      },
      Component: () => import("./pages/StockPurchaseStandalone"),
      permissions: REQUIRED_PERMISSIONS,
    });

    app.addMenuLink({
      to: `/plugins/inventory-orders`,
      icon: ShoppingCart,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.orders`,
        defaultMessage: 'New Order',
      },
      Component: () => import("./pages/OrderFormStandalone"),
      permissions: REQUIRED_PERMISSIONS,
    });

    app.addMenuLink({
      to: `/plugins/inventory-catalog`,
      icon: Folder,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.catalog`,
        defaultMessage: 'Catalog',
      },
      Component: () => import("./pages/CatalogStandalone"),
      permissions: REQUIRED_PERMISSIONS,
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(
            `./translations/${locale}.json`
          )) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};

export default plugin;