type ProductLike = {
  title: string;
  brand: string | null;
  condition: string;
  basePrice: number;
  description: string;
  generatedDescription: string | null;
  variants: Array<{ color: string; size: string; stockQty: number; price: number }>;
};

export function sanitizeAvitoText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function buildTemplateDescription(product: ProductLike): string {
  const activeVariants = product.variants.filter((variant) => variant.stockQty > 0);
  const colors = [...new Set(activeVariants.map((variant) => variant.color))].join(", ") || "уточняйте";
  const sizes = [...new Set(activeVariants.map((variant) => variant.size))].join(", ") || "уточняйте";
  const brandLine = product.brand ? `Бренд: ${product.brand}` : "Бренд: уточняется";

  return sanitizeAvitoText(`
${product.title}

${brandLine}
Состояние: ${product.condition}
Цвета в наличии: ${colors}
Размеры в наличии: ${sizes}

Что важно:
- новые позиции для продажи;
- можно выбрать нужный размер в карточке;
- фото закрепляются за конкретным цветом;
- остатки обновляются по размерам.

Комплектация и посадка:
- модель подходит для повседневной носки;
- перед заказом можно уточнить замеры;
- если нужного размера нет в списке, напишите - проверю наличие.

${product.description || "Описание можно дополнить деталями поставщика, материалом, мерками и условиями доставки."}
`);
}

export async function generateDescription(product: ProductLike): Promise<{
  source: "template" | "ai";
  description: string;
}> {
  const fallback = buildTemplateDescription(product);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { source: "template", description: fallback };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content:
              "You write concise Russian Avito listing descriptions. Do not use HTML, emoji, promises of authenticity, or unsupported claims. Return plain text only.",
          },
          {
            role: "user",
            content: `Improve this Avito-safe template while preserving facts only:\n\n${fallback}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      return { source: "template", description: fallback };
    }

    const payload = (await response.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    const text =
      payload.output_text ||
      payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text).join("\n") ||
      "";

    const sanitized = sanitizeAvitoText(text);
    return sanitized ? { source: "ai", description: sanitized } : { source: "template", description: fallback };
  } catch {
    return { source: "template", description: fallback };
  }
}
