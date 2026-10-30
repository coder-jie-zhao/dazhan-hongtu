/**
 * 大展红途 v2 · PPT 素材出图
 * 产出：
 *   v2/PPT素材/01-产品界面总览-浅色.png   （2400×1350，三手机并排）
 *   v2/PPT素材/02-产品界面总览-深色.png
 *   v2/PPT素材/03-手机框-*.png            （单屏透明底手机框）
 * 用法：NODE_PATH=... node tools/shoot_ppt_v2.js
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8130";
const OUT = path.resolve(__dirname, "..", "v2", "PPT素材");
const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const FRAME = path.resolve(__dirname, "..", "v2", "frame-v2.html");

async function shotShowcase(theme, file) {
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 2400, height: 1350, deviceScaleFactor: 1 });
  await page.goto("file:///" + path.resolve(__dirname, "..", "showcase-v2.html") + (theme === "light" ? "?theme=light" : ""), {
    waitUntil: "networkidle2",
    timeout: 45000
  });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(OUT, file) });
  await browser.close();
  console.log("shot: " + file);
}

async function shotFrames() {
  // 三张用于 showcase 手机框的整屏图（透明底，含手机外壳）
  const showcaseShots = [
    ["home", "huangyangjie", "02-手机框-首页.png"],
    ["chat", "huangyangjie", "02-手机框-对话.png"],
    ["report", "huangyangjie", "02-手机框-报告.png"]
  ];

  const targets = [
    ["home", "huangyangjie", "01-首页.png"],
    ["point", "huangyangjie", "03-点位页-黄洋界.png"],
    ["point", "bajiaolou", "04-点位页-八角楼.png"],
    ["point", "longjiangshuyuan", "05-点位页-龙江书院.png"],
    ["chat", "huangyangjie", "06-AI对话.png"],
    ["task", "huangyangjie", "07-现场任务.png"],
    ["report", "huangyangjie", "08-研学报告.png"],
    ["teacher", "", "09-教师端.png"],
    ["audit", "", "10-审核管线.png"],
    ["selftest", "", "11-检索自测.png"],
    ["ar", "", "12-AR规划.png"]
  ];

  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });

  // ---- 1) 手机框整屏图（透明底）----
  const framePage = await browser.newPage();
  await framePage.setViewport({ width: 466, height: 968, deviceScaleFactor: 2 });
  for (const [view, pid, file] of showcaseShots) {
    await framePage.goto("file:///" + FRAME + "?view=" + view + "&id=" + pid, { waitUntil: "networkidle2", timeout: 40000 });
    await new Promise((r) => setTimeout(r, 3000));

    // 对话页要有一段真实问答才有展示价值：空白的欢迎语看不出「史料锚定」
    if (view === "chat") {
      const inner = framePage.frames().find((f) => f.url().includes("index.html"));
      if (inner) {
        await inner.evaluate(() => {
          const inp = document.getElementById("chat-input");
          const btn = document.getElementById("chat-send");
          if (inp && btn) { inp.value = "这场仗是怎么打赢的？"; btn.click(); }
        });
        await new Promise((r) => setTimeout(r, 5500));
      }
    }

    await framePage.screenshot({ path: path.join(OUT, file), omitBackground: true });
    console.log("frame: " + file);
  }
  await framePage.close();

  // ---- 2) 单屏界面图（纯净，无手机框）----
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  for (const [view, pid, file] of targets) {
    await page.goto(BASE + "/index.html?demo=1&embed=1#/" + view + (pid ? "?id=" + pid : ""), {
      waitUntil: "networkidle2",
      timeout: 40000
    });
    await new Promise((r) => setTimeout(r, 2400));
    await page.evaluate(() => {
      document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show"));
      document.body.classList.add("shot");
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.screenshot({ path: path.join(OUT, file) });
    console.log("shot: " + file);
  }
  await browser.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // 顺序很重要：先出手机框截图（showcase 引用它们），再出总览图
  await shotFrames();
  await shotShowcase("dark", "01-产品界面总览-深色.png");
  await shotShowcase("light", "01-产品界面总览-浅色.png");
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
