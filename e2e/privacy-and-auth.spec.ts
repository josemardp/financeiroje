import { test, expect } from "@playwright/test";

test("redireciona usuário não autenticado para auth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "FinanceAI" })).toBeVisible();
});

test("página de autenticação expõe link de privacidade", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("link", { name: /privacidade/i }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(page.getByRole("heading", { name: /política de privacidade/i })).toBeVisible();
});

test("fluxo de esqueci minha senha abre formulário", async ({ page }) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: /esqueci minha senha/i }).click();
  await expect(page.getByLabel(/email da conta/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /enviar link de recuperação/i })).toBeVisible();
});
