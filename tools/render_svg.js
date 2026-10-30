/* 把 docs/*.svg 渲染成 PNG（答辩 PPT 可直接用）。用法：node tools/render_svg.js */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ROOT = path.resolve(__dirname, "..");
const DOCS = path.join(ROOT, "docs");

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: "new",
    args: ["--no-sandbox", "--font-render-hinting=none"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 740, deviceScaleFactor: 2 });

  const svg = path.join(DOCS, "architecture.svg");
  const html = "<html><body style='margin:0;padding:0'>" +
    fs.readFileSync(svg, "utf8").replace(/width="1200" height="740"/, 'width="1200" height="740"') +
    "</body></html>";
  await page.setContent(html, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 400));

  const out = path.join(DOCS, "architecture.png");
  await page.screenshot({ path: out, omitBackground: true });
  console.log("rendered: docs/architecture.png  " + Math.round(fs.statSync(out).size / 1024) + " KB");

  await browser.close();
})().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
