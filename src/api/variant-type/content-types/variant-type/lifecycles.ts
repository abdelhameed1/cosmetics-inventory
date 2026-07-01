import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::variant.variant')
      .count({ where: { variantType: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this variant type: ${count} variant(s) still use it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::variant.variant')
        .count({ where: { variantType: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a variant type that still has variants.'
        );
      }
    }
  },
};
