import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");
const outputDir = path.join(projectRoot, "docs", "linkedin-images");
const baseUrl = "http://127.0.0.1:3000";

const defaultBoard = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
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

const login = async (page) => {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
};

const resetBoard = async (page) => {
  await page.evaluate(async (board) => {
    await fetch("/api/board", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(board),
    });
  }, defaultBoard);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Kanban Studio" }).waitFor();
};

const pauseForUi = async (page, ms = 600) => {
  await page.waitForTimeout(ms);
};

const main = async () => {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1600, height: 1180 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await pauseForUi(page);
  await page.screenshot({
    path: path.join(outputDir, "01-login-screen.png"),
  });

  await login(page);
  await resetBoard(page);
  await pauseForUi(page);
  await page.screenshot({
    path: path.join(outputDir, "02-board-overview.png"),
  });

  await page
    .getByPlaceholder(/ask the assistant/i)
    .fill("Briefly summarize what is currently on my board without making any changes.");
  await page.getByRole("button", { name: /send message/i }).click();
  await page.getByTestId("chat-message-assistant").waitFor({ timeout: 30000 });
  await pauseForUi(page);
  await page.screenshot({
    path: path.join(outputDir, "03-ai-summary.png"),
  });

  await page
    .getByPlaceholder(/ask the assistant/i)
    .fill("Create a new card titled AI follow-up in Backlog with details Review the latest board changes.");
  await page.getByRole("button", { name: /send message/i }).click();
  await page
    .getByTestId("column-col-backlog")
    .getByText("AI follow-up")
    .waitFor({ timeout: 30000 });
  await pauseForUi(page);
  await page.screenshot({
    path: path.join(outputDir, "04-ai-card-created.png"),
  });

  await browser.close();
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
