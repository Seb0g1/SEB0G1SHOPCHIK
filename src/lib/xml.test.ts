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
      sku: "AV-1-WHITE-M",
      price: 4990,
      stockQty: 2,
      publicationStatus: "DRAFT",
    },
    {
      id: "variant-2",
      color: "Белый",
      size: "L",
      sku: "AV-1-WHITE-L",
      price: 4990,
      stockQty: 0,
      publicationStatus: "DRAFT",
    },
    {
      id: "variant-3",
      color: "Черный",
      size: "M",
      sku: "AV-1-BLACK-M",
      price: 5490,
      stockQty: 1,
      publicationStatus: "DRAFT",
    },
  ],
  photos: [
    { color: "Белый", publicUrl: "/api/uploads/product-1/white.jpg", sortOrder: 0 },
    { color: "Черный", publicUrl: "/api/uploads/product-1/black.jpg", sortOrder: 0 },
    { color: null, publicUrl: "/api/uploads/product-1/common.jpg", sortOrder: 0 },
  ],
};

describe("xml", () => {
  it("escapes XML text and protects CDATA terminators", () => {
    expect(escapeXml(`A&B<"'>`)).toBe("A&amp;B&lt;&quot;&apos;&gt;");
    expect(cdata("a]]>b")).toBe("<![CDATA[a]]]]><![CDATA[>b]]>");
  });

  it("builds one Avito ad per active variant with color photos", () => {
    const xml = buildAvitoFeed([product], {
      address: "Москва",
      publicFeedUrl: "http://localhost:4317/api/avito/feed.xml",
    });

    expect(xml).toContain('<Ads formatVersion="3" target="Avito.ru">');
    expect(xml).toContain("<Id>AV-1-WHITE-M</Id>");
    expect(xml).toContain("<Id>AV-1-BLACK-M</Id>");
    expect(xml).not.toContain("<Id>AV-1-WHITE-L</Id>");
    expect(xml).toContain("<Title>Футболка Nike Forza Nocta, Белый, M</Title>");
    expect(xml).toContain("<Title>Футболка Nike Forza Nocta, Черный, M</Title>");
    expect(xml).toContain('url="http://localhost:4317/api/uploads/product-1/white.jpg"');
    expect(xml).toContain('url="http://localhost:4317/api/uploads/product-1/black.jpg"');
    expect(xml).not.toContain('url="http://localhost:4317/api/uploads/product-1/common.jpg"');
  });

  it("puts the lowest sortOrder photo first for each color", () => {
    const xml = buildAvitoFeed(
      [
        {
          ...product,
          photos: [
            { color: product.variants[0].color, publicUrl: "/api/uploads/product-1/white-secondary.jpg", sortOrder: 1 },
            { color: product.variants[0].color, publicUrl: "/api/uploads/product-1/white-primary.jpg", sortOrder: 0 },
          ],
        },
      ],
      {
        address: "Москва",
        publicFeedUrl: "http://localhost:4317/api/avito/feed.xml",
      },
    );

    expect(xml.indexOf("white-primary.jpg")).toBeLessThan(xml.indexOf("white-secondary.jpg"));
  });
});
