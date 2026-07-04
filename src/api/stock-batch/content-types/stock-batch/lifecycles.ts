import { errors } from '@strapi/utils';

export default {
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.quantityRemaining === undefined || data.quantityRemaining === null) {
      data.quantityRemaining = data.quantityPurchased;
    }
  },
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::order-line.order-line')
      .count({ where: { stockBatch: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this stock batch: ${count} order line(s) reference it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::order-line.order-line')
        .count({ where: { stockBatch: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a stock batch referenced by order lines.'
        );
      }
    }
  },
};
