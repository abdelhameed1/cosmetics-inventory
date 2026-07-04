import { errors } from '@strapi/utils';

const LINE_UID = 'api::order-line.order-line';

async function parentOrderStatus(where: { id: number }): Promise<string | null> {
  const line = await strapi.db.query(LINE_UID).findOne({ where, populate: { order: true } });
  return line?.order?.status ?? null;
}

export default {
  async beforeUpdate(event) {
    const where = event.params.where as { id: number };
    const status = await parentOrderStatus(where);
    if (status && status !== 'draft') {
      throw new errors.ApplicationError('Cannot edit a line on an order that is already confirmed.');
    }
  },
  async beforeDelete(event) {
    const where = event.params.where as { id: number };
    const status = await parentOrderStatus(where);
    if (status && status !== 'draft') {
      throw new errors.ApplicationError('Cannot delete a line from an order that is already confirmed.');
    }
  },
};
