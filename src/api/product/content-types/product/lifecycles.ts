export default {
  async afterCreate(event) {
    const { result } = event;
    const existing = await strapi.db.query('api::variant.variant').count({
      where: { product: result.id },
    });
    if (existing === 0) {
      await strapi.documents('api::variant.variant').create({
        data: {
          isDefault: true,
          label: 'Default',
          product: result.documentId,
        },
      });
    }
  },
};
