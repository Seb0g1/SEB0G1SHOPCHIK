import { describe, expect, it } from "vitest";
import { normalizeFields, normalizeTree, normalizeValues } from "@/lib/avito/catalog";

describe("avito catalog normalization", () => {
  it("normalizes category tree shapes", () => {
    const tree = normalizeTree({
      nodes: [
        {
          title: "Личные вещи",
          node_slug: "lichnye",
          children: [{ name: "Футболки", slug: "shirts" }],
        },
      ],
    });

    expect(tree[0].name).toBe("Личные вещи");
    expect(tree[0].children[0].path).toBe("Личные вещи / Футболки");
  });

  it("normalizes required fields and values", () => {
    const fields = normalizeFields({
      fields: [
        {
          name: "Condition",
          title: "Состояние",
          required: true,
          values: [{ title: "Новое" }, { name: "Б/у" }],
        },
      ],
    });

    expect(fields[0]).toMatchObject({
      key: "Condition",
      label: "Состояние",
      type: "select",
      required: true,
      values: ["Новое", "Б/у"],
    });
    expect(normalizeValues({ a: "S", b: "M" })).toEqual(["S", "M"]);
  });
});
