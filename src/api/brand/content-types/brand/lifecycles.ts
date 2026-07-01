import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::product.product')
      .count({ where: { brand: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this brand: ${count} product(s) still reference it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::product.product')
        .count({ where: { brand: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a brand that still has products.'
        );
      }
    }
  },
};
