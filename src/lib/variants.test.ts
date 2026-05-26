import { describe, expect, it } from "vitest";
import { activeForFeed, expandVariants, makeSku } from "@/lib/variants";

describe("variants", () => {
  it("expands selected sizes into concrete variants", () => {
    const variants = expandVariants({
      productId: "product-1",
      title: "Футболка Nike Forza Nocta",
      color: "Белый",
      sizes: ["S", "M", "L"],
      price: 4990,
      stockQty: 2,
    });

    expect(variants).toHaveLength(3);
    expect(variants.map((variant) => variant.size)).toEqual(["S", "M", "L"]);
    expect(variants.every((variant) => variant.color === "Белый")).toBe(true);
  });

  it("keeps SKU deterministic for same title/color/size", () => {
    expect(makeSku("A", "Black", "M")).toBe(makeSku("A", "Black", "M"));
    expect(makeSku("A", "Black", "M")).not.toBe(makeSku("A", "Black", "L"));
  });

  it("builds readable Avito SKU from product, color and size", () => {
    expect(makeSku("Nike Forza Nocta", "Black", "M")).toBe("AV-NIKEFORZANOCTA-BLACK-M");
    expect(makeSku("Футболка Nike Forza Nocta", "Белый", "XL")).toContain("BELYY-XL");
  });

  it("excludes zero-stock or suspended variants from feed", () => {
    expect(activeForFeed({ stockQty: 1, publicationStatus: "DRAFT" })).toBe(true);
    expect(activeForFeed({ stockQty: 0, publicationStatus: "DRAFT" })).toBe(false);
    expect(activeForFeed({ stockQty: 3, publicationStatus: "SUSPENDED" })).toBe(false);
  });
});
