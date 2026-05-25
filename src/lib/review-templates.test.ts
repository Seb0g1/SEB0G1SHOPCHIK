import { describe, expect, it } from "vitest";
import { normalizeAvitoReplyText, renderReplyTemplate, selectReplyTemplate } from "@/lib/review-templates";

describe("review reply templates", () => {
  it("matches by rating, keyword count and priority", () => {
    const template = selectReplyTemplate(
      { rating: 5, text: "Отличное качество и быстрая доставка", itemTitle: "Футболка" },
      [
        {
          id: "generic",
          name: "generic",
          ratingMin: 5,
          ratingMax: 5,
          keywords: "",
          text: "generic",
          priority: 100,
          active: true,
        },
        {
          id: "keyword",
          name: "keyword",
          ratingMin: 5,
          ratingMax: 5,
          keywords: "качество, доставка",
          text: "keyword",
          priority: 10,
          active: true,
        },
      ],
    );

    expect(template?.id).toBe("keyword");
  });

  it("renders placeholders for Avito-safe draft text", () => {
    const text = renderReplyTemplate("Спасибо, {name}! {itemTitle} - {rating}★. <b>{shopName}</b>", {
      rating: 5,
      text: "ok",
      authorName: "Иван",
      itemTitle: "Футболка Nike",
    });

    expect(text).toBe("Спасибо, Иван! Футболка Nike - 5★. SEB0G1SHOPCHIK");
  });

  it("sanitizes html and extra whitespace", () => {
    expect(normalizeAvitoReplyText("  <div>Привет</div>\n\n\n  мир  ")).toBe("Привет\n\n мир");
  });
});
