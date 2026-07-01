import type { Core } from '@strapi/strapi';
import { errors } from '@strapi/utils';
import { RESOURCES, resolveResource } from '../config/resources';

const SYSTEM_FIELDS = new Set([
  'id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt',
  'createdBy', 'updatedBy', 'locale',
]);

export interface FieldMeta {
  name: string;
  type: string;
  required: boolean;
  unique: boolean;
  hidden: boolean;
  min?: number;
  max?: number;
  values?: string[];
  relation?: { resource: string | null; kind: string; mainField: string };
}

function uidToSlug(uid: string): string | null {
  const entry = Object.entries(RESOURCES).find(([, def]) => def.uid === uid);
  return entry ? entry[0] : null;
}

const metadata = ({ strapi }: { strapi: Core.Strapi }) => ({
  getSchema(slug: string) {
    const def = resolveResource(slug);
    if (!def) throw new errors.NotFoundError(`Unknown resource: ${slug}`);

    const ct = strapi.contentType(def.uid as any);
    const fields: FieldMeta[] = [];

    for (const [name, attr] of Object.entries<any>(ct.attributes)) {
      const base: FieldMeta = {
        name,
        type: attr.type,
        required: Boolean(attr.required),
        unique: Boolean(attr.unique),
        hidden: SYSTEM_FIELDS.has(name),
      };

      if (attr.min !== undefined) base.min = attr.min;
      if (attr.max !== undefined) base.max = attr.max;
      if (attr.type === 'enumeration') base.values = attr.enum;

      if (attr.type === 'relation') {
        const targetSlug = uidToSlug(attr.target);
        base.relation = { resource: targetSlug, kind: attr.relation, mainField: 'name' };
        // hide relations whose target is not allow-listed, and *-to-many (managed from the other side)
        if (!targetSlug || attr.relation.endsWith('Many')) base.hidden = true;
      }

      fields.push(base);
    }

    return { resource: slug, uid: def.uid, fields };
  },
});

export default metadata;
