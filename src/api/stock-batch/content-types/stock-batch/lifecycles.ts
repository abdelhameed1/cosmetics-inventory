export default {
  async beforeCreate(event) {
    const { data } = event.params;
    if (data.quantityRemaining === undefined || data.quantityRemaining === null) {
      data.quantityRemaining = data.quantityPurchased;
    }
  },
};
