import { describe, expect, it } from "vitest";
import { validateProductForApi } from "@/lib/product-validation";

describe("product validation", () => {
  const baseProduct = {
    title: "Футболка Nike",
    basePrice: 2199,
    avitoCategorySlug: "shirts",
    avitoFieldsJson: JSON.stringify({ Brand: "Nike" }),
    photos: [{ id: "photo-1" }],
    variants: [
      {
        sku: "SKU-1",
        color: "Белый",
        size: "M",
        price: 2199,
        stockQty: 3,
        publicationStatus: "DRAFT",
      },
    ],
  };

  it("requires category, photos, active variants and required API fields", () => {
    expect(
      validateProductForApi(
        { ...baseProduct, avitoCategorySlug: null, photos: [], avitoFieldsJson: "{}" },
        [{ key: "Brand", label: "Бренд", type: "string", required: true, values: [] }],
      ),
    ).toEqual([
      "Выберите категорию Авито из справочника.",
      "Загрузите минимум одно фото товара.",
      "Заполните обязательное поле: Бренд.",
    ]);
  });

  it("passes a complete product", () => {
    expect(
      validateProductForApi(baseProduct, [{ key: "Brand", label: "Бренд", type: "string", required: true, values: [] }]),
    ).toEqual([]);
  });
});
