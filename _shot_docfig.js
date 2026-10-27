const puppeteer = require("puppeteer-core");
const path = require("path");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "D:/WorkBuddy/2026-10-24-19-43-02/output/rt20261024a/assets";
const SRC = "file:///D:/大展红途/_docfig.html";

const jobs = [
  { id: "fig-rag", name: "fig-5-1.png" },
  { id: "fig-money", name: "fig-8-1.png" },
  { id: "fig-funnel", name: "fig-4-1.png" },
];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 900, deviceScaleFactor: 3.4 });
  await page.goto(SRC, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 600));

  for (const j of jobs) {
    const el = await page.$("#" + j.id);
    const box = await el.boundingBox();
    const file = path.join(OUT, j.name);
    await el.screenshot({ path: file });
    console.log(`✓ ${j.name}  ${Math.round(box.width)}x${Math.round(box.height)}  → ${(box.width / 37.795).toFixed(2)}cm`);
  }
  await browser.close();
})();
