import { describe, expect, it } from "vitest";
import { calculatePrice } from "@/lib/bulk-price";

describe("bulk price", () => {
  it("calculates set, delta and percent modes", () => {
    expect(calculatePrice(2199, "SET", 2500)).toBe(2500);
    expect(calculatePrice(2199, "ADD", 300)).toBe(2499);
    expect(calculatePrice(2000, "PERCENT", 10)).toBe(2200);
    expect(calculatePrice(2000, "PERCENT", -15)).toBe(1700);
  });

  it("rounds prices to Avito-friendly endings", () => {
    expect(calculatePrice(2101, "SET", 2101, "TO_9")).toBe(2109);
    expect(calculatePrice(2101, "SET", 2101, "TO_99")).toBe(2199);
    expect(calculatePrice(30, "ADD", -100, "TO_99")).toBe(99);
  });
});
