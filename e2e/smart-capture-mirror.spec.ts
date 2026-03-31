import { expect, test, type Page, type Request } from "@playwright/test";

const TEST_USER = {
  id: "11111111-1111-1111-1111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "smartcapture-e2e@financeai.test",
  email_confirmed_at: "2026-03-30T00:00:00.000Z",
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { nome: "SmartCapture E2E" },
  identities: [],
  created_at: "2026-03-30T00:00:00.000Z",
  updated_at: "2026-03-30T00:00:00.000Z",
};

const TEST_PROFILE = {
  id: "profile-smartcapture-e2e",
  user_id: TEST_USER.id,
  nome: "SmartCapture E2E",
  email: TEST_USER.email,
  perfil: "admin",
  familia_id: null,
  avatar_url: null,
  preferences: {},
};

const TEST_CATEGORY = {
  id: "category-alimentacao",
  nome: "Alimentação",
  icone: "🍕",
};

type RouteState = {
  transactionInsertCount: number;
  transactionPatchCount: number;
  learningInsertCount: number;
  transactionInsertPayload: Record<string, unknown> | null;
  transactionPatchPayload: Record<string, unknown> | null;
  learningInsertPayload: Record<string, unknown> | null;
};

function buildMockSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;

  return {
    access_token: "header.payload.signature",
    refresh_token: "refresh-token-smartcapture-e2e",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: TEST_USER,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function unwrapPayload(payload: unknown) {
  if (Array.isArray(payload)) return payload[0] ?? null;
  return payload;
}

function parseRequestBody(request: Request) {
  try {
    return unwrapPayload(request.postDataJSON());
  } catch {
    const raw = request.postData();

    if (!raw) return null;

    try {
      return unwrapPayload(JSON.parse(raw));
    } catch {
      return null;
    }
  }
}

async function installSmartCaptureRoutes(page: Page) {
  const state: RouteState = {
    transactionInsertCount: 0,
    transactionPatchCount: 0,
    learningInsertCount: 0,
    transactionInsertPayload: null,
    transactionPatchPayload: null,
    learningInsertPayload: null,
  };

  const session = buildMockSession();

  await page.addInitScript(({ mockedSession }) => {
    const authTokenValue = JSON.stringify(mockedSession);
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.getItem = function (key: string) {
      if (typeof key === "string" && key.includes("-auth-token")) {
        return authTokenValue;
      }

      return originalGetItem.call(this, key);
    };

    Storage.prototype.setItem = function (key: string, value: string) {
      if (typeof key === "string" && key.includes("-auth-token")) {
        return;
      }

      return originalSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function (key: string) {
      if (typeof key === "string" && key.includes("-auth-token")) {
        return;
      }

      return originalRemoveItem.call(this, key);
    };

    originalSetItem.call(window.localStorage, "financeai_scope", "private");
    originalSetItem.call(window.localStorage, "financeai_scope_initialized", "true");
  }, { mockedSession: session });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    const method = request.method();

    if (method === "OPTIONS" && (url.includes("/rest/v1/") || url.includes("/auth/v1/"))) {
      await route.fulfill(jsonResponse({}));
      return;
    }

    if (url.includes("/auth/v1/user")) {
      await route.fulfill(jsonResponse(TEST_USER));
      return;
    }

    if (url.includes("/auth/v1/token")) {
      await route.fulfill(jsonResponse(session));
      return;
    }

    if (url.includes("/rest/v1/profiles")) {
      await route.fulfill(jsonResponse(TEST_PROFILE));
      return;
    }

    if (url.includes("/rest/v1/categories")) {
      await route.fulfill(jsonResponse([TEST_CATEGORY]));
      return;
    }

    if (url.includes("/rest/v1/transactions")) {
      if (method === "POST") {
        state.transactionInsertCount += 1;
        state.transactionInsertPayload = parseRequestBody(request);
        await route.fulfill(jsonResponse({ id: "tx-smartcapture-e2e" }, 201));
        return;
      }

      if (method === "PATCH") {
        state.transactionPatchCount += 1;
        state.transactionPatchPayload = parseRequestBody(request);
        await route.fulfill(jsonResponse({}, 200));
        return;
      }
    }

    if (url.includes("/rest/v1/smart_capture_learning") && method === "POST") {
      state.learningInsertCount += 1;
      state.learningInsertPayload = parseRequestBody(request);
      await route.fulfill(jsonResponse({}, 201));
      return;
    }

    await route.continue();
  });

  return state;
}

async function openMirrorMode(page: Page) {
  await page.goto("/captura");
  await expect(page.getByRole("heading", { name: /captura inteligente premium/i })).toBeVisible();

  await page.getByRole("textbox").fill("gastei 52,00 com pizza hoje");
  await page.getByRole("button", { name: /interpretar com ia/i }).click();

  await expect(page.getByRole("heading", { name: /modo espelho/i })).toBeVisible();
}

test("bloqueia persistência sem confirmação explícita no Modo Espelho", async ({ page }) => {
  const state = await installSmartCaptureRoutes(page);

  await openMirrorMode(page);

  const saveButton = page.getByRole("button", { name: /confirmar e salvar/i });

  await expect(saveButton).toBeDisabled();

  await saveButton.evaluate((element) => {
    const button = element as HTMLButtonElement;
    button.disabled = false;
    button.removeAttribute("disabled");
  });

  await saveButton.click();

  await expect(page.getByText(/confirme explicitamente a revisão antes de salvar/i)).toBeVisible();

  expect(state.transactionInsertCount).toBe(0);
  expect(state.learningInsertCount).toBe(0);
  expect(state.transactionPatchCount).toBe(0);
});

test("permite persistência somente após confirmação explícita no Modo Espelho", async ({ page }) => {
  const state = await installSmartCaptureRoutes(page);

  await openMirrorMode(page);

  const saveButton = page.getByRole("button", { name: /confirmar e salvar/i });

  await expect(saveButton).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(saveButton).toBeEnabled();

  await saveButton.click();

  await expect(page.getByText(/transação confirmada e registrada/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /modo espelho/i })).toHaveCount(0);

  expect(state.transactionInsertCount).toBe(1);
  expect(state.learningInsertCount).toBe(1);
  expect(state.transactionPatchCount).toBe(1);

  expect(state.transactionInsertPayload).toMatchObject({
    user_id: TEST_USER.id,
    valor: 52,
    tipo: "expense",
    scope: "private",
    source_type: "free_text",
    data_status: "confirmed",
  });

  expect(state.learningInsertPayload).toMatchObject({
    user_id: TEST_USER.id,
    transaction_id: "tx-smartcapture-e2e",
    source_type: "free_text",
    transaction_type: "expense",
    scope: "private",
    confirmation_method: "mirror_confirmed",
  });

  expect(state.transactionPatchPayload).toMatchObject({
    updated_by: TEST_USER.id,
  });

  expect(String(state.transactionPatchPayload?.validation_notes ?? "")).toContain('"learning_status":"saved"');
});
