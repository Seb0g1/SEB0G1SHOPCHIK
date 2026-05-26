import { expect, test } from "@playwright/test";

test("creates product through the new CRM flow", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "SEB0G1SHOPCHIK" })).toBeVisible();
  await expect(page.getByText("XML feed")).toHaveCount(0);
  await expect(page.getByText("dropshipping", { exact: false })).toHaveCount(0);

  await page.getByRole("navigation").getByRole("link", { name: "Новый товар" }).click();
  await expect(page.getByText("Загрузка товара по полям Avito")).toBeVisible();
  await page.getByLabel("Название").fill("Футболка Nike Forza Nocta");
  await page.getByLabel("Бренд").fill("Nike");
  await page.getByLabel("Цена").fill("2199");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Футболки и топы" }).click();
  await page.getByLabel("Состояние *").selectOption("Новое");
  await page.getByLabel("Пол *").selectOption("Мужская");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("Цвет *").fill("Белый");
  await page.getByLabel("Размеры из Avito").fill("S, M");
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("button", { name: "Проверить и отправить" })).toBeVisible();
});

test("manages review automation pages", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "Шаблоны ответов" })).toBeVisible();
  const templateName = `5 star keyword ${Date.now()}`;
  await page.getByLabel("Название").first().fill(templateName);
  await page.getByLabel("Ключевые слова").first().fill("качество");
  await page.getByLabel("Текст ответа").first().fill("Спасибо, {name}! {itemTitle} - супер.");
  await page.getByRole("button", { name: "Добавить" }).click();
  await expect(page.getByText(templateName)).toBeVisible();

  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "Отзывы Avito" })).toBeVisible();
  await expect(page.getByText("XML feed")).toHaveCount(0);
  await expect(page.getByText("dropshipping", { exact: false })).toHaveCount(0);

  await page.goto("/automation");
  await expect(page.getByRole("heading", { name: "Автоматизация" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить доступы" })).toBeVisible();
  await expect(page.getByText("Поддерживать онлайн")).toBeVisible();
});
