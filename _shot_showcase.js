/* 截 showcase 展示图（深色版 + 浅色版） */
const puppeteer = require("puppeteer-core");
const path = require("path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = "D:/大展红途";
const OUT = path.join(ROOT, "_shots");

const SHOTS = [
  { theme: "", name: "PPT-产品界面-深色版" },
  { theme: "?theme=light", name: "PPT-产品界面-浅色版" }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--allow-file-access-from-files", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2400, height: 1350, deviceScaleFactor: 2 });

  for (const s of SHOTS) {
    await page.goto("file:///D:/大展红途/showcase.html" + s.theme, { waitUntil: "networkidle0", timeout: 40000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await wait(3200);
    for (const f of page.frames()) {
      try { await f.evaluate(() => document.fonts && document.fonts.ready); } catch (e) {}
    }
    await wait(700);
    const file = path.join(OUT, s.name + ".png");
    await page.screenshot({ path: file });
    console.log("✓", s.name, "→", file);
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
