import { errors } from '@strapi/utils';

export default {
  async beforeDelete(event) {
    const { id } = event.params.where as { id: number };
    const count = await strapi.db
      .query('api::customer.customer')
      .count({ where: { priceList: id } });
    if (count > 0) {
      throw new errors.ApplicationError(
        `Cannot delete this price list: ${count} customer(s) are assigned to it.`
      );
    }
  },
  async beforeDeleteMany(event) {
    const ids: number[] = event.params?.where?.id?.$in ?? [];
    for (const id of ids) {
      const count = await strapi.db
        .query('api::customer.customer')
        .count({ where: { priceList: id } });
      if (count > 0) {
        throw new errors.ApplicationError(
          'Cannot delete a price list assigned to customers.'
        );
      }
    }
  },
};
