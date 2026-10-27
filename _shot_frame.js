/* 生成「带手机外框 + 透明背景」的单屏图，方便直接贴进 PPT 自由摆放 */
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = "D:/大展红途/PPT素材/手机框";

const SHOTS = [
  { view: "home",    name: "入口页" },
  { view: "point",   name: "点位详情" },
  { view: "chat",    name: "AI对话" },
  { view: "task",    name: "现场任务" },
  { view: "report",  name: "研学报告" },
  { view: "teacher", name: "教师端" }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--allow-file-access-from-files", "--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 466, height: 968, deviceScaleFactor: 3 });

  for (const s of SHOTS) {
    await page.goto("file:///D:/大展红途/frame.html?view=" + s.view, { waitUntil: "load", timeout: 30000 });
    await wait(2400);
    for (const f of page.frames()) {
      try { await f.evaluate(() => document.fonts && document.fonts.ready); } catch (e) {}
    }
    await wait(500);
    const file = path.join(OUT, s.name + "-手机框.png");
    await page.screenshot({ path: file, omitBackground: true });
    console.log("✓", s.name);
  }

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
