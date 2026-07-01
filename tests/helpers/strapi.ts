import type { Core } from '@strapi/strapi';
import { createStrapi } from '@strapi/strapi';

let instance: Core.Strapi | null = null;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (!instance) {
    instance = await createStrapi().load();
    await instance.server.mount();
  }
  return instance;
}

export async function teardownStrapi(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
