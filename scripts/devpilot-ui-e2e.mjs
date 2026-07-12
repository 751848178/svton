#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import {
  createFixtureHandler,
  team,
  user,
} from "./devpilot-ui-e2e-fixtures.mjs";

const webUrl =
  process.env.DEVPILOT_WEB_URL ||
  process.env.DEVPIOT_WEB_URL ||
  "http://localhost:3100";
const outDir =
  process.env.DEVPILOT_E2E_OUTPUT_DIR ||
  process.env.DEVPIOT_E2E_OUTPUT_DIR ||
  `/tmp/codex-tool-runs/svton/devpilot-ui-e2e-${Date.now()}`;
const calls = [];
const consoleErrors = [];
const pageErrors = [];

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const moduleName = process.env.PLAYWRIGHT_MODULE_PATH || "playwright";
  try {
    return require(moduleName);
  } catch {
    throw new Error(
      "Missing Playwright. Install it outside the repo and set PLAYWRIGHT_MODULE_PATH=/tmp/.../node_modules/playwright.",
    );
  }
}

async function assertVisible(page, text) {
  await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ timeout: 10000 });
}

async function assertText(page, pattern) {
  try {
    await page.getByText(pattern).first().waitFor({ timeout: 10000 });
  } catch (error) {
    const text = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    await fs.writeFile(
      path.join(outDir, "last-page-text.txt"),
      `${text.slice(0, 4000)}\n`,
    );
    throw error;
  }
}

async function setupPage(context) {
  await context.addCookies([
    { name: "token", value: "ui-e2e-token", url: webUrl },
    { name: "teamId", value: team.id, url: webUrl },
  ]);
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) =>
    pageErrors.push(error.stack || error.message),
  );
  await page.route("**/api/**", (route) =>
    route.fulfill(createFixtureHandler(calls)(route.request())),
  );
  await page.addInitScript(
    ({ user, team }) => {
      localStorage.setItem(
        "auth-storage",
        JSON.stringify({ state: { token: "ui-e2e-token", user }, version: 0 }),
      );
      document.cookie = `teamId=${team.id}; path=/`;
      document.cookie = "token=ui-e2e-token; path=/";
    },
    { user, team },
  );
  return page;
}

async function runFlow(page) {
  await page.goto("/resource-control");
  await assertVisible(page, "资源管控");
  await page.getByRole("button", { name: "同步" }).first().click();
  await assertVisible(page, "completed");
  await page.screenshot({
    path: path.join(outDir, "resource-control.png"),
    fullPage: true,
  });

  await page.goto("/execution-governance");
  await assertVisible(page, "执行治理");
  await assertText(page, /Task pull readiness/i);
  await page.getByRole("button", { name: "处理队列" }).click();
  await page.screenshot({
    path: path.join(outDir, "execution-governance.png"),
    fullPage: true,
  });

  await page.goto("/logs");
  await assertVisible(page, "日志中心");
  await page.screenshot({
    path: path.join(outDir, "logs.png"),
    fullPage: true,
  });

  await page.goto("/monitoring");
  await assertVisible(page, "监控告警");
  await page.screenshot({
    path: path.join(outDir, "monitoring.png"),
    fullPage: true,
  });
}

async function writeSummary(status, extra = {}) {
  const summary = {
    status,
    outDir,
    calls,
    consoleErrors,
    pageErrors,
    ...extra,
  };
  await fs.writeFile(
    path.join(outDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  return summary;
}

async function run() {
  await fs.mkdir(outDir, { recursive: true });
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: webUrl,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await setupPage(context);
  await runFlow(page);
  await browser.close();
  const status =
    consoleErrors.length || pageErrors.length ? "failed" : "passed";
  const summary = await writeSummary(status);
  if (status !== "passed")
    throw new Error(
      `Browser errors: ${[...consoleErrors, ...pageErrors].join(" | ")}`,
    );
  console.log(JSON.stringify(summary, null, 2));
}

run().catch(async (error) => {
  await fs.mkdir(outDir, { recursive: true });
  await writeSummary("failed", { error: error.message });
  console.error(error.message);
  process.exit(1);
});
