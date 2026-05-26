import { describe, expect, it } from "vitest";
import { renderSupplierMessage, selectSupplierId } from "@/lib/orders";

describe("supplier order helpers", () => {
  it("uses color supplier before product supplier", () => {
    expect(
      selectSupplierId({
        productSupplierId: "supplier-product",
        color: "Черный",
        colorGroups: [
          { color: "Белый", supplierId: "supplier-white" },
          { color: "Черный", avitoColorValue: "Черный", supplierId: "supplier-black" },
        ],
      }),
    ).toBe("supplier-black");
  });

  it("falls back to product supplier", () => {
    expect(
      selectSupplierId({
        productSupplierId: "supplier-product",
        color: "Красный",
        colorGroups: [{ color: "Белый", supplierId: "supplier-white" }],
      }),
    ).toBe("supplier-product");
  });

  it("renders supplier draft placeholders", () => {
    const text = renderSupplierMessage("Заказ {orderId}: {itemTitle}, {color}, {size}, {quantity} шт, {price} ₽", {
      orderId: "A-42",
      itemTitle: "Футболка Nike",
      color: "Белый",
      size: "M",
      quantity: 2,
      price: 2199,
    });

    expect(text).toContain("A-42");
    expect(text).toContain("Футболка Nike");
    expect(text).toContain("Белый");
    expect(text).toContain("M");
    expect(text).toContain("2");
    expect(text.replace(/\s/g, "")).toContain("2199");
  });
});
