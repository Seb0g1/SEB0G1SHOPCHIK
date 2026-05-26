import { describe, expect, it } from "vitest";
import { selectMessageRule } from "@/lib/messages";

describe("message rules", () => {
  it("matches enabled keyword rules by priority", () => {
    const rule = selectMessageRule("Есть ли скидка на черную футболку?", [
      { id: "disabled", keywords: "скидка", priority: 100, active: false },
      { id: "generic", keywords: "футболка", priority: 10, active: true },
      { id: "discount", keywords: "скидка, дешевле", priority: 50, active: true },
    ]);

    expect(rule?.id).toBe("discount");
  });

  it("ignores rules without matched keywords", () => {
    const rule = selectMessageRule("Когда сможете отправить?", [
      { id: "size", keywords: "размер, xl", priority: 10, active: true },
    ]);

    expect(rule).toBeUndefined();
  });
});
