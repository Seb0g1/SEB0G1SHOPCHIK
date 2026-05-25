import { expect, test } from "@playwright/test";

test("creates product and opens publication workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Avito dropshipping manager")).toBeVisible();

  await page.getByRole("button", { name: "Создать" }).click();
  await expect(page.getByText("Редактор карточки")).toBeVisible();

  await page.getByRole("button", { name: "Генерировать", exact: true }).click();
  await expect(page.getByText("Превью")).toBeVisible();

  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Журнал")).toBeVisible();
});
