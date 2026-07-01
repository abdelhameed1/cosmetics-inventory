import { errors } from '@strapi/utils';

function assertTypedIfNotDefault(isDefault: boolean, variantTypeId: unknown) {
  if (!isDefault && !variantTypeId) {
    throw new errors.ApplicationError('A non-default variant must have a variant type.');
  }
}

function relId(value: any): unknown {
  if (value == null) return null;
  if (typeof value === 'object') {
    // documents API connect/set shapes, or a populated relation
    if ('id' in value && value.id) return value.id;
    if ('documentId' in value && value.documentId) return value.documentId;
    if (Array.isArray(value.connect) && value.connect.length) return value.connect[0];
    if (Array.isArray(value.set) && value.set.length) return value.set[0];
    return null;
  }
  return value;
}

export default {
  async beforeCreate(event) {
    const data = event.params.data;
    assertTypedIfNotDefault(Boolean(data.isDefault), relId(data.variantType));
  },
  async beforeUpdate(event) {
    const data = event.params.data;
    const where = event.params.where as { id: number };
    const current = await strapi.db.query('api::variant.variant').findOne({
      where,
      populate: { variantType: true },
    });
    const isDefault = 'isDefault' in data ? Boolean(data.isDefault) : Boolean(current?.isDefault);
    const variantTypeId =
      'variantType' in data ? relId(data.variantType) : current?.variantType?.id ?? null;
    assertTypedIfNotDefault(isDefault, variantTypeId);
  },
};
