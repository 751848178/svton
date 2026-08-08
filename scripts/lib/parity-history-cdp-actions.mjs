import { writeFileSync } from "node:fs";
import path from "node:path";
import { artifactMetadata } from "./parity-history-browser-artifacts.mjs";

const ACTION_TYPES = new Set([
  "wait",
  "navigate",
  "setValue",
  "click",
  "waitText",
  "shot",
  "text",
  "dom",
]);

export async function runCdpActions(cdp, actions, options, runtime = {}) {
  const pause = runtime.sleep || sleep;
  await setViewport(cdp, options);
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const [kind, ...rest] = action.split(":");
    const value = rest.join(":");
    try {
      await executeAction(cdp, options.out, kind, value, pause);
    } catch {
      const safeType = ACTION_TYPES.has(kind) ? kind : "unknown";
      throw new Error(`E2E_CDP_ACTION_FAILED:${index}:${safeType}`);
    }
  }
}

async function executeAction(cdp, outDir, kind, value, pause) {
  if (kind === "wait") await pause(Number(value));
  else if (kind === "navigate") await navigate(cdp, value, pause);
  else if (kind === "setValue") await setValue(cdp, value, pause);
  else if (kind === "click") await click(cdp, value, pause);
  else if (kind === "waitText") await waitText(cdp, value, pause);
  else if (kind === "shot") await screenshot(cdp, outDir, value, pause);
  else if (kind === "text") await textDump(cdp, outDir, value);
  else if (kind === "dom") await domDump(cdp, outDir, value);
  else throw new Error("unsupported CDP action");
}

async function navigate(cdp, url, pause) {
  await cdp.call("Page.navigate", { url });
  await pause(1200);
}

async function setValue(cdp, value, pause) {
  const [selector, ...parts] = value.split("@@@");
  const input = parts.join("@@@");
  const result = await cdp.call("Runtime.evaluate", {
    expression: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(element, ${JSON.stringify(input)});
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
    returnByValue: true,
  });
  if (!result.result.value) throw new Error("selector not found");
  await pause(400);
}

async function click(cdp, selector, pause) {
  const result = await cdp.call("Runtime.evaluate", {
    expression: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!result.result.value) throw new Error("selector not found");
  await pause(700);
}

async function waitText(cdp, text, pause) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await cdp.call("Runtime.evaluate", {
      expression: `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
      returnByValue: true,
    });
    if (result.result.value) return;
    await pause(250);
  }
  throw new Error("text not found");
}

async function screenshot(cdp, outDir, name, pause) {
  await pause(400);
  const shot = await cdp.call("Page.captureScreenshot", { format: "png" });
  const buffer = Buffer.from(shot.data, "base64");
  writeArtifact("screenshot", outDir, name, buffer);
}

async function textDump(cdp, outDir, name) {
  const result = await cdp.call("Runtime.evaluate", {
    expression: 'document.body ? document.body.innerText : ""',
    returnByValue: true,
  });
  writeArtifact("text", outDir, name, Buffer.from(result.result.value || ""));
}

async function domDump(cdp, outDir, name) {
  const result = await cdp.call("Runtime.evaluate", {
    expression: "document.documentElement.outerHTML",
    returnByValue: true,
  });
  writeArtifact("dom", outDir, name, Buffer.from(result.result.value || ""));
}

function writeArtifact(kind, outDir, name, buffer) {
  const file = path.join(outDir, name);
  const metadata = artifactMetadata(kind, buffer);
  writeFileSync(file, buffer);
  process.stdout.write(`${JSON.stringify({ [kind]: file, ...metadata })}\n`);
}

function setViewport(cdp, options) {
  return cdp.call("Emulation.setDeviceMetricsOverride", {
    width: options.width,
    height: options.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
