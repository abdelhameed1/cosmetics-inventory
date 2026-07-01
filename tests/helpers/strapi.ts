import type { Core } from '@strapi/strapi';
import { compileStrapi, createStrapi } from '@strapi/strapi';

let instance: Core.Strapi | null = null;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (!instance) {
    const { appDir, distDir } = await compileStrapi();
    instance = await createStrapi({ appDir, distDir }).load();
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
