import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0lS5wAAAABJRU5ErkJggg==",
  "base64",
);

test("creates product through the Avito matrix wizard", async ({ page }) => {
  await page.goto("/products");
  await expect(page.getByRole("heading", { name: "SEB0G1SHOPCHIK" })).toBeVisible();
  await expect(page.getByText("XML feed")).toHaveCount(0);
  await expect(page.getByText("dropshipping", { exact: false })).toHaveCount(0);

  await page.getByRole("navigation").getByRole("link", { name: "Новый товар" }).click();
  await expect(page.getByRole("heading", { name: "Массовая загрузка товара в Avito" })).toBeVisible();
  await page.getByLabel("Название").fill(`Футболка Nike Forza Nocta ${Date.now()}`);
  await page.getByLabel("Бренд").fill("Nike");
  await page.getByLabel("Базовая цена").fill("2199");

  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Футболки и топы" }).click();
  await page.getByLabel("Состояние *").selectOption("Новое");
  await page.getByLabel("Пол *").selectOption("Мужская");

  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("Размеры из Avito").nth(0).fill("S, M");
  await page.getByLabel("Размеры из Avito").nth(1).fill("S, M");
  await page.locator('input[type="file"]').nth(0).setInputFiles({ name: "white.png", mimeType: "image/png", buffer: png });
  await page.locator('input[type="file"]').nth(1).setInputFiles({ name: "black.png", mimeType: "image/png", buffer: png });

  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByLabel("Общее описание").fill("Новая футболка, аккуратная упаковка, отправка после подтверждения.");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("button", { name: "Проверить и отправить" })).toBeVisible();
});

test("manages reviews, templates and automation pages", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "Шаблоны ответов" })).toBeVisible();
  const templateName = `5 star keyword ${Date.now()}`;
  await page.getByLabel("Название").first().fill(templateName);
  await page.getByLabel("Ключевые слова").first().fill("качество");
  await page.getByLabel("Текст ответа").first().fill("Спасибо, {name}! {itemTitle} - супер.");
  await page.getByLabel("Автоотправка для отзывов").first().check();
  await page.getByRole("button", { name: "Добавить" }).click();
  await expect(page.getByText(templateName)).toBeVisible();

  await page.goto("/reviews");
  await expect(page.getByRole("heading", { name: "Очередь ответов" })).toBeVisible();
  await expect(page.getByText("XML feed")).toHaveCount(0);
  await expect(page.getByText("dropshipping", { exact: false })).toHaveCount(0);

  await page.goto("/automation");
  await expect(page.getByRole("heading", { name: "Автоматизация" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить доступы" })).toBeVisible();
  await expect(page.getByText("Поддерживать онлайн")).toBeVisible();
  await expect(page.getByText("Автоответы в чатах")).toBeVisible();
});

test("creates message keyword rules", async ({ page }) => {
  await page.goto("/message-rules");
  await expect(page.getByRole("heading", { name: "Правила автоответов" })).toBeVisible();
  const ruleName = `Размеры ${Date.now()}`;
  await page.getByLabel("Название").first().fill(ruleName);
  await page.getByLabel("Ключевые слова").first().fill("размер, наличие");
  await page.getByLabel("Ответ").first().fill("Здравствуйте! Подскажите нужный размер, проверим наличие.");
  await page.getByRole("button", { name: "Добавить" }).click();
  await expect(page.getByText("Правило добавлено.")).toBeVisible();

  await page.goto("/messages");
  await expect(page.getByRole("heading", { name: "Сообщения" })).toBeVisible();
});

test("shows Avito settings persistence status", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Настройки Avito API" })).toBeVisible();
  await expect(page.getByText("Состояние сохранения")).toBeVisible();
  await expect(page.getByText("Поле Client secret очищается после сохранения специально")).toBeVisible();
});

test("manages suppliers and opens orders queue", async ({ page }) => {
  await page.goto("/suppliers");
  await expect(page.getByRole("heading", { name: "Поставщики" })).toBeVisible();
  const supplierName = `Поставщик ${Date.now()}`;
  await page.getByLabel("Название поставщика").fill(supplierName);
  await page.getByLabel("Telegram").fill("@supplier");
  await page.getByRole("button", { name: "Сохранить" }).click();
  await expect(page.getByText("Поставщик сохранен.")).toBeVisible();
  await expect(page.getByRole("heading", { name: supplierName })).toBeVisible();

  await page.goto("/orders");
  await expect(page.getByRole("heading", { name: "Заказы" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Синхронизировать заказы" })).toBeVisible();
  await expect(page.getByText("XML feed")).toHaveCount(0);
  await expect(page.getByText("dropshipping", { exact: false })).toHaveCount(0);
});
