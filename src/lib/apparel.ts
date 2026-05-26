export type ApparelPresetId = "TSHIRT" | "POLO" | "HOODIE" | "SWEATSHIRT" | "SWEATER" | "TRACK_JACKET" | "LONGSLEEVE" | "PANTS";
export type ColorMode = "MULTI" | "SINGLE" | "NONE";

export type ApparelPreset = {
  id: ApparelPresetId;
  label: string;
  avitoProductType: string;
  avitoSubtype: string;
  titleWord: string;
  hint?: string;
};

export type ColorModeOption = {
  id: ColorMode;
  label: string;
  hint: string;
};

export const DEFAULT_APPAREL_PRESET: ApparelPresetId = "TSHIRT";
export const DEFAULT_COLOR_MODE: ColorMode = "MULTI";
export const NO_COLOR_LABEL = "Без цвета";

export const APPAREL_PRESETS: ApparelPreset[] = [
  {
    id: "TSHIRT",
    label: "Футболка",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Футболка",
    titleWord: "футболка",
  },
  {
    id: "POLO",
    label: "Поло",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Поло",
    titleWord: "поло",
  },
  {
    id: "HOODIE",
    label: "Худи",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Худи",
    titleWord: "худи",
  },
  {
    id: "SWEATSHIRT",
    label: "Свитшот",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Свитшот",
    titleWord: "свитшот",
  },
  {
    id: "SWEATER",
    label: "Свитер",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Свитер",
    titleWord: "свитер",
  },
  {
    id: "TRACK_JACKET",
    label: "Олимпийка",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Толстовка",
    titleWord: "олимпийка",
    hint: "Олимпийка будет выгружена как Толстовка — это ближайшее значение Avito.",
  },
  {
    id: "LONGSLEEVE",
    label: "Лонгслив",
    avitoProductType: "Кофты и футболки",
    avitoSubtype: "Футболка",
    titleWord: "лонгслив",
    hint: "Лонгслив будет выгружен как Футболка — реальное слово останется в названии и описании.",
  },
  {
    id: "PANTS",
    label: "Штаны",
    avitoProductType: "Брюки",
    avitoSubtype: "",
    titleWord: "штаны",
  },
];

export const COLOR_MODES: ColorModeOption[] = [
  {
    id: "MULTI",
    label: "Несколько цветов",
    hint: "Цветовые группы, свои фото и матрица цвет × размер.",
  },
  {
    id: "SINGLE",
    label: "Один цвет",
    hint: "Одна цветовая группа без лишнего добавления цветов.",
  },
  {
    id: "NONE",
    label: "Без цвета",
    hint: "Avito не получит поле Цвет, фото будут общими для всех размеров.",
  },
];

export function getApparelPreset(value?: string | null): ApparelPreset {
  return APPAREL_PRESETS.find((preset) => preset.id === value) ?? APPAREL_PRESETS.find((preset) => preset.id === DEFAULT_APPAREL_PRESET)!;
}

export function getColorMode(value?: string | null): ColorMode {
  return COLOR_MODES.some((mode) => mode.id === value) ? (value as ColorMode) : DEFAULT_COLOR_MODE;
}

export function apparelPresetLabels() {
  return APPAREL_PRESETS.map((preset) => preset.label);
}

export function colorModeLabels() {
  return COLOR_MODES.map((mode) => mode.label);
}

export function apparelPresetByLabel(label: string): ApparelPreset {
  return APPAREL_PRESETS.find((preset) => preset.label === label) ?? getApparelPreset(DEFAULT_APPAREL_PRESET);
}

export function colorModeByLabel(label: string): ColorMode {
  return COLOR_MODES.find((mode) => mode.label === label)?.id ?? DEFAULT_COLOR_MODE;
}

export function apparelPresetLabel(value?: string | null): string {
  return getApparelPreset(value).label;
}

export function colorModeLabel(value?: string | null): string {
  return COLOR_MODES.find((mode) => mode.id === getColorMode(value))?.label ?? COLOR_MODES[0].label;
}

export function colorModeHint(value?: string | null): string {
  return COLOR_MODES.find((mode) => mode.id === getColorMode(value))?.hint ?? COLOR_MODES[0].hint;
}
