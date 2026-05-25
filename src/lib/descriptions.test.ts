import { describe, expect, it } from "vitest";
import { buildTemplateDescription, sanitizeAvitoText } from "@/lib/descriptions";

describe("descriptions", () => {
  it("sanitizes html and control characters", () => {
    expect(sanitizeAvitoText("<b>Товар</b>\u0001\n\n\n\nРазмер")).toBe("Товар\n\n\nРазмер");
  });

  it("builds fallback description with sizes and colors", () => {
    const text = buildTemplateDescription({
      title: "Футболка Nike Forza Nocta",
      brand: "Nike",
      condition: "Новое",
      basePrice: 4990,
      description: "Плотный хлопок.",
      generatedDescription: null,
      variants: [
        { color: "Белый", size: "M", stockQty: 2, price: 4990 },
        { color: "Черный", size: "L", stockQty: 1, price: 4990 },
        { color: "Черный", size: "XL", stockQty: 0, price: 4990 },
      ],
    });

    expect(text).toContain("Футболка Nike Forza Nocta");
    expect(text).toContain("Цвета в наличии: Белый, Черный");
    expect(text).toContain("Размеры в наличии: M, L");
    expect(text).toContain("Плотный хлопок.");
  });
});
