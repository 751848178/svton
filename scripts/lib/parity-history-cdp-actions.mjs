import { writeFileSync } from "node:fs";
import path from "node:path";
import { artifactMetadata } from "./parity-history-browser-artifacts.mjs";

export async function runCdpActions(cdp, actions, options) {
  await setViewport(cdp, options);
  for (const action of actions) {
    const [kind, ...rest] = action.split(":");
    const value = rest.join(":");
    if (kind === "wait") await sleep(Number(value));
    else if (kind === "navigate") await navigate(cdp, value);
    else if (kind === "setValue") await setValue(cdp, value);
    else if (kind === "click") await click(cdp, value);
    else if (kind === "waitText") await waitText(cdp, value);
    else if (kind === "shot") await screenshot(cdp, options.out, value);
    else if (kind === "text") await textDump(cdp, options.out, value);
    else if (kind === "dom") await domDump(cdp, options.out, value);
    else throw new Error(`unsupported CDP action: ${kind}`);
  }
}

async function navigate(cdp, url) {
  await cdp.call("Page.navigate", { url });
  await sleep(1200);
}

async function setValue(cdp, value) {
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
  if (!result.result.value) throw new Error(`selector not found: ${selector}`);
  await sleep(400);
}

async function click(cdp, selector) {
  const result = await cdp.call("Runtime.evaluate", {
    expression: `(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) return false;
      element.click();
      return true;
    })()`,
    returnByValue: true,
  });
  if (!result.result.value) throw new Error(`selector not found: ${selector}`);
  await sleep(700);
}

async function waitText(cdp, text) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const result = await cdp.call("Runtime.evaluate", {
      expression: `document.body && document.body.innerText.includes(${JSON.stringify(text)})`,
      returnByValue: true,
    });
    if (result.result.value) return;
    await sleep(250);
  }
  throw new Error(`text not found: ${text}`);
}

async function screenshot(cdp, outDir, name) {
  await sleep(400);
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
