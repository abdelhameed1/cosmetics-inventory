import { errors } from '@strapi/utils';

const ORDER_UID = 'api::order.order';

export default {
  async beforeUpdate(event) {
    const data: any = event.params.data ?? {};
    if (data.__trusted) {
      delete data.__trusted;
      return;
    }

    const where = event.params.where as { id: number };
    const current = await strapi.db.query(ORDER_UID).findOne({ where });

    if (current && current.status !== 'draft') {
      throw new errors.ApplicationError(
        'This order is already confirmed; use the confirm/payment endpoints to change it.'
      );
    }
    if ('status' in data) {
      throw new errors.ApplicationError(
        'Order status cannot be set directly; use the confirm endpoint.'
      );
    }
  },
  async beforeDelete(event) {
    const where = event.params.where as { id: number };
    const current = await strapi.db.query(ORDER_UID).findOne({ where });
    if (current && current.status !== 'draft') {
      throw new errors.ApplicationError(
        'Cannot delete an order that is already confirmed; its stock changes cannot be undone automatically.'
      );
    }
  },
};
