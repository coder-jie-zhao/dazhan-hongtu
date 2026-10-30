/* 大展红途 · 界面截图脚本
 * node _shot.js            截全部
 * node _shot.js home chat  只截指定视图（按 key）
 */
const puppeteer = require("puppeteer-core");
const path = require("path");
const fs = require("fs");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = "D:/大展红途";
const OUT = path.join(ROOT, "_shots");
const BASE = "file:///" + ROOT.replace(/\\/g, "/") + "/index.html";

/* mode: viewport = 固定手机视口；compact = 按内容真实高度整页截 */
const VIEWS = [
  { key: "home",    name: "01-首页",            mode: "viewport", h: 932 },
  { key: "point",   name: "02-点位详情",        mode: "viewport", h: 932 },
  { key: "chat",    name: "03-AI对话",          mode: "viewport", h: 932 },
  { key: "task",    name: "04-现场任务-首屏",    mode: "viewport", h: 932 },
  { key: "task",    name: "04b-现场任务-全程",   mode: "compact" },
  { key: "report",  name: "05-研学报告",        mode: "compact" },
  { key: "teacher", name: "06-教师端",          mode: "viewport", h: 932 }
];

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const list = only.length ? VIEWS.filter((v) => only.includes(v.key)) : VIEWS;

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--font-render-hinting=none", "--disable-lcd-text", "--force-color-profile=srgb"]
  });
  const page = await browser.newPage();

  for (const v of list) {
    await page.setViewport({ width: 430, height: v.h || 932, deviceScaleFactor: 3 });
    await page.goto(`${BASE}?view=${v.key}&demo=1&embed=1`, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await wait(1600);

    let full = false;
    if (v.mode === "compact") {
      await page.evaluate(() => {
        document.documentElement.style.height = "auto";
        document.body.style.height = "auto";
        const app = document.querySelector(".app");
        if (app) app.style.minHeight = "auto";
        document.querySelectorAll(".view").forEach((el) => { el.style.minHeight = "auto"; });
        const hdr = document.querySelector(".view.active .sub-header");
        if (hdr) hdr.style.position = "static";
        const cb = document.getElementById("chat-body");
        if (cb) { cb.style.maxHeight = "none"; cb.style.flex = "0 0 auto"; }
      });
      await wait(500);
      // 视口收到内容真实高度，避免底部留一大片空白
      const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
      await page.setViewport({ width: 430, height: Math.max(h, 400), deviceScaleFactor: 3 });
      await wait(400);
    }

    const file = path.join(OUT, v.name + ".png");
    await page.screenshot({ path: file, fullPage: full });
    console.log("✓", v.name, "→", file);
  }

  await browser.close();
  console.log("\n完成，输出目录：", OUT);
})().catch((e) => { console.error("截图失败：", e); process.exit(1); });
