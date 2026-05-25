export type ReviewForTemplate = {
  rating: number;
  text: string;
  authorName?: string | null;
  itemTitle?: string | null;
  brand?: string | null;
};

export type ReplyTemplateRule = {
  id?: string;
  name: string;
  ratingMin: number;
  ratingMax: number;
  keywords: string;
  text: string;
  priority: number;
  active: boolean;
};

export const DEFAULT_REPLY_TEMPLATES: ReplyTemplateRule[] = [
  {
    id: "default_5_star",
    name: "5★ благодарность",
    ratingMin: 5,
    ratingMax: 5,
    keywords: "",
    text: "Спасибо, {name}! Очень рады, что вам понравился товар {itemTitle}. Будем ждать вас снова в {shopName}.",
    priority: 50,
    active: true,
  },
  {
    id: "default_4_star",
    name: "4★ благодарность",
    ratingMin: 4,
    ratingMax: 4,
    keywords: "",
    text: "Спасибо за отзыв, {name}! Если по товару {itemTitle} появятся вопросы, напишите нам в чат - быстро поможем.",
    priority: 40,
    active: true,
  },
  {
    id: "default_3_star",
    name: "3★ нейтральный ответ",
    ratingMin: 3,
    ratingMax: 3,
    keywords: "",
    text: "Спасибо за обратную связь, {name}. Мы внимательно посмотрим, что можно улучшить по товару {itemTitle}.",
    priority: 30,
    active: true,
  },
  {
    id: "default_1_2_star",
    name: "1-2★ решение проблемы",
    ratingMin: 1,
    ratingMax: 2,
    keywords: "",
    text: "{name}, спасибо, что написали. Нам жаль, что товар {itemTitle} не оправдал ожиданий. Пожалуйста, напишите нам в чат - разберемся и предложим решение.",
    priority: 20,
    active: true,
  },
];

export function parseKeywords(value: string): string[] {
  return value
    .split(/[\n,;]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function selectReplyTemplate(
  review: ReviewForTemplate,
  templates: ReplyTemplateRule[],
): ReplyTemplateRule | null {
  const normalizedText = `${review.text} ${review.itemTitle ?? ""}`.toLowerCase();

  const candidates = templates
    .filter((template) => template.active)
    .filter((template) => review.rating >= template.ratingMin && review.rating <= template.ratingMax)
    .map((template) => {
      const keywords = parseKeywords(template.keywords);
      const matchedKeywords = keywords.filter((keyword) => normalizedText.includes(keyword));
      return { template, keywords, matchedKeywords };
    })
    .filter((item) => item.keywords.length === 0 || item.matchedKeywords.length > 0)
    .sort((a, b) => {
      const keywordDelta = b.matchedKeywords.length - a.matchedKeywords.length;
      if (keywordDelta !== 0) return keywordDelta;
      return b.template.priority - a.template.priority;
    });

  return candidates[0]?.template ?? null;
}

export function renderReplyTemplate(
  templateText: string,
  review: ReviewForTemplate,
  context: { shopName?: string | null } = {},
): string {
  const variables: Record<string, string> = {
    name: review.authorName?.trim() || "покупатель",
    rating: String(review.rating),
    itemTitle: review.itemTitle?.trim() || "товар",
    brand: review.brand?.trim() || "",
    shopName: context.shopName?.trim() || "SEB0G1SHOPCHIK",
  };

  return normalizeAvitoReplyText(
    templateText.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => variables[key] ?? ""),
  );
}

export function normalizeAvitoReplyText(value: string): string {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 3000);
}
