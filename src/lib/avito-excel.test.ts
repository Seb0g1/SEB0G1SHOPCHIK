import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildAvitoExcelRows, generateAvitoExcel, normalizeSize, sanitizeAvitoHtml, validateAvitoExcelExport, type AvitoExcelProduct } from "@/lib/avito-excel";

const product: AvitoExcelProduct = {
  id: "product-1",
  title: "Футболка Nike Forza Nocta",
  brand: "Nike",
  condition: "Новое",
  description: "<p><strong>Premium качество</strong></p><script>alert(1)</script>",
  generatedDescription: null,
  avitoFieldsJson: JSON.stringify({ Material: "Хлопок" }),
  colorGroups: [
    { color: "Белый", avitoColorValue: "Белый", description: "", avitoFieldsJson: "{}", sortOrder: 0 },
    { color: "Черный", avitoColorValue: "Чёрный", description: "", avitoFieldsJson: "{}", sortOrder: 1 },
  ],
  variants: [
    {
      id: "variant-white-m",
      color: "Белый",
      size: "M",
      sku: "AV-NOCTA-WHITE-M",
      price: 2199,
      stockQty: 3,
      avitoExternalId: null,
      publicationStatus: "READY",
      avitoFieldsJson: "{}",
      sortOrder: 0,
    },
    {
      id: "variant-white-l",
      color: "Белый",
      size: "L",
      sku: "AV-NOCTA-WHITE-L",
      price: 2199,
      stockQty: 0,
      avitoExternalId: null,
      publicationStatus: "READY",
      avitoFieldsJson: "{}",
      sortOrder: 1,
    },
    {
      id: "variant-black-s",
      color: "Черный",
      size: "S",
      sku: "AV-NOCTA-BLACK-S",
      price: 2299,
      stockQty: 2,
      avitoExternalId: "8193053827",
      publicationStatus: "READY",
      avitoFieldsJson: "{}",
      sortOrder: 0,
    },
    {
      id: "variant-black-m",
      color: "Черный",
      size: "M",
      sku: "AV-NOCTA-BLACK-M",
      price: 2299,
      stockQty: 2,
      avitoExternalId: null,
      publicationStatus: "SUSPENDED",
      avitoFieldsJson: "{}",
      sortOrder: 1,
    },
  ],
  photos: [
    { color: "Белый", publicUrl: "/api/uploads/product-1/white.jpg", sortOrder: 0 },
    { color: "Черный", publicUrl: "/api/uploads/product-1/black.jpg", sortOrder: 0 },
    { color: null, publicUrl: "/api/uploads/product-1/common.jpg", sortOrder: 0 },
  ],
};

const settings = {
  phone: "+7 (977) 827-45-40",
  address: "Москва",
  email: "shop@example.com",
  contactName: "Точка Стиля",
  publicFeedUrl: "https://amsterdam2.sebog1.ru/api/avito/feed.xml",
};

describe("avito excel export", () => {
  it("creates one row per active variant and keeps color photos separated", () => {
    const rows = buildAvitoExcelRows([product], settings);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(["AV-NOCTA-WHITE-M", "AV-NOCTA-BLACK-S"]);
    expect(rows[0].imageUrls).toContain("https://amsterdam2.sebog1.ru/api/uploads/product-1/white.jpg");
    expect(rows[0].imageUrls).not.toContain("black.jpg");
    expect(rows[0].imageUrls).not.toContain("common.jpg");
    expect(rows[1].imageUrls).toContain("black.jpg");
    expect(rows[1].avitoId).toBe("8193053827");
  });

  it("maps short sizes to Avito values", () => {
    expect(normalizeSize("S")).toBe("46 (S)");
    expect(normalizeSize("M")).toBe("48 (M)");
    expect(normalizeSize("2XL")).toBe("56 (XXL)");
    expect(normalizeSize("3XL")).toBe("60 (3XL)");
    expect(normalizeSize("ONE_SIZE")).toBe("Без размера");
    expect(normalizeSize("48 (M)")).toBe("48 (M)");
  });

  it("sanitizes description html but preserves basic formatting", () => {
    const html = sanitizeAvitoHtml('<p onclick="bad()"><strong>Ок</strong></p><script>x</script><iframe></iframe>');

    expect(html).toContain("<strong>Ок</strong>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("iframe");
  });

  it("validates missing public domain and empty settings as warnings", () => {
    const result = validateAvitoExcelExport([product], {
      publicFeedUrl: "http://localhost:4317/api/avito/feed.xml",
    });

    expect(result.errors).toEqual([]);
    expect(result.warnings.join(" ")).toContain("localhost");
    expect(result.warnings.join(" ")).toContain("телефон");
  });

  it("writes rows into the official Avito workbook template", async () => {
    const buffer = await generateAvitoExcel([product], settings);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("xl/worksheets/sheet2.xml")?.async("string");

    expect(xml).toBeTruthy();
    expect(cellValue(xml ?? "", "A5")).toBe("AV-NOCTA-WHITE-M");
    expect(cellValue(xml ?? "", "F5")).toBe("https://amsterdam2.sebog1.ru/api/uploads/product-1/white.jpg");
    expect(cellValue(xml ?? "", "H5")).toBe("Футболка Nike Forza Nocta (Белый)");
    expect(cellValue(xml ?? "", "V5")).toBe("48 (M)");
    expect(cellValue(xml ?? "", "A6")).toBe("AV-NOCTA-BLACK-S");
    expect(cellValue(xml ?? "", "V6")).toBe("46 (S)");
    expect(xml).toContain("<dataValidations");
  });
});

function cellValue(xml: string, ref: string) {
  const match = xml.match(new RegExp(`<c r="${ref}"[^>]*>([\\s\\S]*?)<\\/c>`));
  if (!match) return "";
  const inline = match[1].match(/<t>([\s\S]*?)<\/t>/);
  if (inline) return unescapeXml(inline[1]);
  const value = match[1].match(/<v>([\s\S]*?)<\/v>/);
  return value ? unescapeXml(value[1]) : "";
}

function unescapeXml(value: string) {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}
