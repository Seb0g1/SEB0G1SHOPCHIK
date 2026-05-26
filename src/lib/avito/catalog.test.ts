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

  it("normalizes Avito content blocks, children and value links", () => {
    const fields = normalizeFields({
      fields: [
        {
          tag: "GoodsType",
          label: "Тип товара",
          content: [
            {
              field_type: "select",
              data_type: "string",
              required: true,
              values: [{ value: "Одежда" }],
              values_link_json: "https://api.avito.ru/values",
              dependencies_text: ["depends on Category"],
            },
          ],
          children: [
            {
              tag: "Size",
              label: "Размер",
              content: [{ field_type: "checkbox", data_type: "string", required: false, values: [{ value: "M" }] }],
            },
          ],
        },
      ],
    });

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "GoodsType",
          label: "Тип товара",
          type: "select",
          required: true,
          values: ["Одежда"],
          valuesLinkJson: "https://api.avito.ru/values",
          help: "depends on Category",
        }),
        expect.objectContaining({
          key: "Size",
          label: "Размер",
          type: "select",
          values: ["M"],
        }),
      ]),
    );
  });
});
