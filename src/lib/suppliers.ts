import { prisma } from "@/lib/prisma";
import { toClientSupplier } from "@/lib/serializers";

export const DEFAULT_SUPPLIER_MESSAGE_TEMPLATE =
  "Здравствуйте! Нужен товар для заказа Avito #{orderId}: {itemTitle}. Цвет: {color}, размер: {size}, количество: {quantity}. Подтвердите наличие, цену и когда сможете отправить.";

export async function listSuppliers(options: { includeInactive?: boolean } = {}) {
  const suppliers = await prisma.supplier.findMany({
    where: options.includeInactive ? undefined : { active: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  return suppliers.map(toClientSupplier);
}

export async function getSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({ where: { id } });
  return supplier ? toClientSupplier(supplier) : null;
}

export async function createSupplier(input: SupplierInput) {
  const supplier = await prisma.supplier.create({
    data: {
      name: input.name.trim(),
      contactName: input.contactName?.trim() || null,
      phone: input.phone?.trim() || null,
      whatsapp: input.whatsapp?.trim() || null,
      telegram: input.telegram?.trim() || null,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() ?? "",
      defaultMessageTemplate: input.defaultMessageTemplate?.trim() || DEFAULT_SUPPLIER_MESSAGE_TEMPLATE,
      active: input.active ?? true,
    },
  });
  return toClientSupplier(supplier);
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
  const supplier = await prisma.supplier.update({
    where: { id },
    data: normalizeSupplierInput(input, true),
  });
  return toClientSupplier(supplier);
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({ where: { id } });
  return { ok: true };
}

type SupplierInput = {
  name: string;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  website?: string | null;
  notes?: string;
  defaultMessageTemplate?: string;
  active?: boolean;
};

function normalizeSupplierInput(input: Partial<SupplierInput>, partial = false) {
  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : partial ? {} : { name: "Новый поставщик" }),
    ...(input.contactName !== undefined ? { contactName: input.contactName?.trim() || null } : {}),
    ...(input.phone !== undefined ? { phone: input.phone?.trim() || null } : {}),
    ...(input.whatsapp !== undefined ? { whatsapp: input.whatsapp?.trim() || null } : {}),
    ...(input.telegram !== undefined ? { telegram: input.telegram?.trim() || null } : {}),
    ...(input.website !== undefined ? { website: input.website?.trim() || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes.trim() } : partial ? {} : { notes: "" }),
    ...(input.defaultMessageTemplate !== undefined
      ? { defaultMessageTemplate: input.defaultMessageTemplate.trim() || DEFAULT_SUPPLIER_MESSAGE_TEMPLATE }
      : partial
        ? {}
        : { defaultMessageTemplate: DEFAULT_SUPPLIER_MESSAGE_TEMPLATE }),
    ...(input.active !== undefined ? { active: input.active } : partial ? {} : { active: true }),
  };
}
