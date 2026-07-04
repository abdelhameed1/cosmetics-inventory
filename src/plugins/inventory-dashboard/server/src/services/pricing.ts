import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';

const pricing = ({ strapi }: { strapi: Core.Strapi }) => ({
  async suggest(input: { priceListDocumentId: string; costPriceUsd: number; quantity: number }) {
    const settings = await strapi.documents('api::system-settings.system-settings' as any).findFirst();
    const exchangeRate = settings ? Number(settings.exchangeRate) : 0;

    const priceList = await strapi.documents('api::price-list.price-list' as any).findOne({
      documentId: input.priceListDocumentId,
    } as any);
    if (!priceList) throw new errors.NotFoundError('Price list not found');

    const egpCost = Number(input.costPriceUsd) * exchangeRate;

    // retail margin (used by wholesale fallback and vip base)
    const [retailList] = await strapi.documents('api::price-list.price-list' as any).findMany({
      filters: { type: 'retail' },
    } as any);
    const retailMargin = Number(retailList?.marginPercent ?? 0);
    const retailPrice = egpCost * (1 + retailMargin / 100);

    let sellPrice: number;
    switch (priceList.type) {
      case 'retail':
        sellPrice = egpCost * (1 + Number(priceList.marginPercent ?? 0) / 100);
        break;
      case 'wholesale': {
        const minQty = Number(priceList.wholesaleMinQty ?? Number.POSITIVE_INFINITY);
        sellPrice =
          input.quantity >= minQty
            ? egpCost * (1 + Number(priceList.marginPercent ?? 0) / 100)
            : retailPrice;
        break;
      }
      case 'vip':
        sellPrice = retailPrice * (1 - Number(priceList.vipDiscountPercent ?? 0) / 100);
        break;
      default:
        sellPrice = retailPrice;
    }

    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    return { sellPrice: round2(sellPrice), retailPrice: round2(retailPrice), exchangeRate };
  },
});

export default pricing;
