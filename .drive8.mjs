import { chromium } from "playwright";

const OUT = "/private/tmp/claude-501/-Users-sneha-Projects-operation-manager/4e8b00df-e05e-4818-92f1-688ad9974772/scratchpad";
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

async function shot(name, fullPage = false) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log("saved", name);
}

console.log("== admin dashboard: initial load, no manual scroll ==");
await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
// wait for any auto-cascade to settle
await page.waitForTimeout(4000);
const cardCount1 = await page.locator('[class*="WidgetShell-module"][class*="__card"]').count();
console.log("widget cards visible after initial load (no scroll):", cardCount1);
const scrollY = await page.evaluate(() => window.scrollY);
console.log("window.scrollY (should be 0, no auto-scroll):", scrollY);
const bottomText = await page.locator("text=All modules loaded.").count();
console.log("'All modules loaded' visible without scrolling (admin has 18, page size 9, expect NOT all loaded yet):", bottomText);
await shot("D-initial-load-admin", true);

console.log("== now scroll to bottom, confirm more loads ==");
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(2000);
const cardCount2 = await page.locator('[class*="WidgetShell-module"][class*="__card"]').count();
console.log("widget cards after scrolling to bottom:", cardCount2);
await shot("E-after-scroll-admin", true);

console.log("== support agent (small role, should show everything with 0 extra loads) ==");
await page.goto("http://localhost:3000/dashboard", { waitUntil: "networkidle" });
await page.selectOption("header select", { label: "Support Agent" });
await page.waitForTimeout(2000);
const doneLabel = await page.locator("text=All modules loaded.").count();
console.log("Support Agent: 'All modules loaded' visible immediately (expect true, small role):", doneLabel > 0);
await shot("F-support-agent-full", true);

console.log("errors:", errors);
await browser.close();
