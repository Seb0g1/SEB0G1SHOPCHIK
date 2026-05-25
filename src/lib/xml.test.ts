import { describe, expect, it } from "vitest";
import { buildAvitoFeed, cdata, escapeXml } from "@/lib/xml";

const product = {
  id: "product-1",
  title: "Футболка Nike Forza Nocta",
  brand: "Nike",
  category: "Личные вещи",
  goodsType: "Одежда, обувь, аксессуары",
  productType: "Футболки и топы",
  adType: "Товар приобретен на продажу",
  gender: "Мужская",
  condition: "Новое",
  generatedDescription: "Описание\n- пункт",
  description: "",
  variants: [
    {
      id: "variant-1",
      color: "Белый",
      size: "M",
      sku: "AV-1-M",
      price: 4990,
      stockQty: 2,
      publicationStatus: "DRAFT",
    },
    {
      id: "variant-2",
      color: "Белый",
      size: "L",
      sku: "AV-1-L",
      price: 4990,
      stockQty: 0,
      publicationStatus: "DRAFT",
    },
  ],
  photos: [{ color: "Белый", publicUrl: "/api/uploads/product-1/a.jpg", sortOrder: 0 }],
};

describe("xml", () => {
  it("escapes XML text and protects CDATA terminators", () => {
    expect(escapeXml(`A&B<"'>`)).toBe("A&amp;B&lt;&quot;&apos;&gt;");
    expect(cdata("a]]>b")).toBe("<![CDATA[a]]]]><![CDATA[>b]]>");
  });

  it("builds feed with active variants and public image urls", () => {
    const xml = buildAvitoFeed([product], {
      address: "Москва",
      publicFeedUrl: "http://localhost:4317/api/avito/feed.xml",
    });

    expect(xml).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(xml).toContain("<Id>AV-1-M</Id>");
    expect(xml).not.toContain("<Id>AV-1-L</Id>");
    expect(xml).toContain('url="http://localhost:4317/api/uploads/product-1/a.jpg"');
  });
});
