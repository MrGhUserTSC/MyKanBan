import { expect, test, type Page } from "@playwright/test";

const defaultBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

const login = async (page: Page) => {
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

const resetBoard = async (page: Page) => {
  await page.evaluate(async (board) => {
    await fetch("/api/board", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(board),
    });
  }, defaultBoard);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
};

const reloadAfterSave = async (page: Page) => {
  await page.waitForTimeout(300);
  await page.reload();
};

test("shows the login screen by default", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /log in to open your kanban board/i })
  ).toBeVisible();
});

test("rejects invalid credentials", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(
    page.getByText(/use username "user" and password "password"/i)
  ).toBeVisible();
});

test("logs in and loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("renames a column and persists after reload", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByLabel("Column title").fill("Planning");
  await reloadAfterSave(page);
  await expect(
    page.locator('[data-testid^="column-"]').first().getByLabel("Column title")
  ).toHaveValue("Planning");
});

test("reorders columns and persists after reload", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  const handle = page.getByRole("button", { name: /reorder backlog/i });
  const targetColumn = page.getByTestId("column-col-done");
  const handleBox = await handle.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!handleBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 100,
    { steps: 14 }
  );
  await page.mouse.up();
  await reloadAfterSave(page);
  await expect(
    page.locator('[data-testid^="column-"]').nth(4).getByLabel("Column title")
  ).toHaveValue("Backlog");
});

test("adds a card and persists after reload", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await reloadAfterSave(page);
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Playwright card")
  ).toBeVisible();
});

test("edits a card and persists after reload", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: /edit align roadmap themes/i }).click({
    force: true,
  });
  await card.getByLabel(/edit title for align roadmap themes/i).fill("Edited roadmap");
  await card.getByLabel(/edit details for align roadmap themes/i).fill("Updated through e2e.");
  await card.getByRole("button", { name: /^save$/i }).click();
  await reloadAfterSave(page);
  await expect(page.getByText("Edited roadmap")).toBeVisible();
});

test("moves a card between columns and persists after reload", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  const card = page.getByTestId("card-drag-handle-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await reloadAfterSave(page);
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("logs out back to the sign-in screen", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await page.getByRole("button", { name: /log out/i }).click();
  await expect(
    page.getByRole("heading", { name: /log in to open your kanban board/i })
  ).toBeVisible();
});

test("shows AI chat replies in the sidebar", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  await page
    .getByPlaceholder(/ask the assistant/i)
    .fill("Briefly summarize what is currently on my board without making any changes.");
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(page.getByTestId("chat-message-user")).toHaveCount(1);
  await expect(page.getByTestId("chat-message-assistant")).toHaveCount(1, {
    timeout: 60000,
  });
  await expect(page.getByTestId("chat-message-assistant")).not.toHaveText(/^$/);
});

test("applies AI-created board updates automatically", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await login(page);
  await resetBoard(page);
  await page
    .getByPlaceholder(/ask the assistant/i)
    .fill("Create a new card titled AI follow-up in Backlog with details Review the latest board changes.");
  await page.getByRole("button", { name: /send message/i }).click();
  const backlogColumn = page.getByTestId("column-col-backlog");
  await expect(backlogColumn.getByText("AI follow-up")).toBeVisible({
    timeout: 60000,
  });
  await reloadAfterSave(page);
  await expect(
    page.getByTestId("column-col-backlog").getByText("AI follow-up")
  ).toBeVisible();
});
