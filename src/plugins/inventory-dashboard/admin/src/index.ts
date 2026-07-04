import { getTranslation } from "./utils/getTranslation";
import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";

import type { StrapiApp } from "@strapi/strapi/admin";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: 'Inventory',
      },
      Component: () => import("./pages/App"),
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/stock-purchase`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.stock-purchase`,
        defaultMessage: 'Stock purchase',
      },
      Component: () => import("./pages/App"),
      permissions: [],
    });

    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}/orders/new`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.orders`,
        defaultMessage: 'New Order',
      },
      Component: () => import("./pages/App"),
      permissions: [],
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