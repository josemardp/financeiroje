import { test, expect } from "@playwright/test";

test("tela /auth renderiza título e abas de login", async ({ page }) => {
  await page.goto("/auth");
  await expect(page).toHaveURL(/\/auth/);
  await expect(page.getByRole("heading", { name: "FinanceAI" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Entrar" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Criar conta" })).toBeVisible();
});

test("acesso não-autenticado à raiz redireciona para /auth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
});

test("rotas protegidas principais redirecionam para /auth", async ({ page }) => {
  const protectedRoutes = ["/transacoes", "/orcamento", "/ia", "/captura", "/score"];
  for (const route of protectedRoutes) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth/, { timeout: 10_000 });
  }
});

test("tela /reset-password carrega sem redirecionar", async ({ page }) => {
  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/reset-password/);
});
