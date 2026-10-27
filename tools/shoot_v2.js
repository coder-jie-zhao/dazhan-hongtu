/**
 * 大展红途 v2 · 逐屏截图
 * 用 puppeteer-core 精确控制 390×844 视口，抓 pageerror。
 * 用法：NODE_PATH=... node tools/shoot_v2.js
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8130";
const OUT = path.resolve(__dirname, "..", "v2", "_shots");
const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SHOTS = [
  { name: "01-首页", hash: "#/home" },
  { name: "02-点位-黄洋界", hash: "#/point?id=huangyangjie" },
  { name: "03-点位-八角楼", hash: "#/point?id=bajiaolou" },
  { name: "04-点位-龙江书院", hash: "#/point?id=longjiangshuyuan" },
  { name: "05-AI对话", hash: "#/chat?id=huangyangjie" },
  { name: "06-现场任务", hash: "#/task?id=huangyangjie" },
  { name: "07-研学报告", hash: "#/report?id=huangyangjie" },
  { name: "08-教师端", hash: "#/teacher" },
  { name: "09-审核管线", hash: "#/audit" },
  { name: "10-检索自测", hash: "#/selftest" },
  { name: "11-AR规划", hash: "#/ar" }
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });

  const errors = [];
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  page.on("pageerror", (e) => errors.push("[pageerror] " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("[console.error] " + m.text());
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (!u.startsWith("data:")) errors.push("[reqfail] " + u + " :: " + (r.failure() && r.failure().errorText));
  });

  // 首次进入：填 onboarding
  await page.goto(BASE + "/index.html?demo=1", { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector("#onboard", { timeout: 8000 });

  const hasOnboard = await page.evaluate(() => document.getElementById("onboard").classList.contains("show"));
  if (hasOnboard) {
    await page.type("#inp-name", "赵杰");
    await page.type("#inp-school", "东华理工大学");
    await page.click("#btn-onboard");
    await new Promise((r) => setTimeout(r, 500));
  }

  // 灌入演示数据：让报告页有内容
  await page.evaluate(() => {
    const S = window.DZHT.core.store;
    S.saveUser("赵杰", "东华理工大学", "junior");
    ["huangyangjie", "bajiaolou", "longjiangshuyuan"].forEach((pid) => {
      S.setProgress(pid, {
        tasks: { t1: true, t1b: true, t1c: true },
        choiceCorrect: true,
        orderCorrect: true,
        reason: "山高路陡，敌人兵再多也展不开；红军又连夜布了竹钉阵，老乡还帮着送粮、抬担架。装备差得远，是地形和人心补上了。",
        selfText: "以前我以为守住一个山口靠的是人多，今天才知道地形和人心一样重要。红军能赢，不是因为他们更强，是因为他们和老百姓是一伙的。",
        questions: ["这场仗是怎么打赢的？", "为什么叫「黄洋界上炮声隆」？", "红军当时吃什么？"],
        enterTime: Date.now() - 32 * 60 * 1000,
        done: true
      });
    });
  });

  // 演示数据的任务 id 要与当前点位的任务单一致，否则拍照分算不出来
  await page.evaluate(() => {
    const S = window.DZHT.core.store;
    S.setProgress("huangyangjie", { tasks: { t1: true } });
    S.setProgress("bajiaolou", { tasks: { t1b: true } });
    S.setProgress("longjiangshuyuan", { tasks: { t1c: true } });
  });

  for (const s of SHOTS) {
    await page.evaluate((h) => { window.location.hash = h; }, s.hash);
    await new Promise((r) => setTimeout(r, 900));
    // 关闭可能的遮罩
    await page.evaluate(() => {
      document.querySelectorAll(".modal.show").forEach((m) => m.classList.remove("show"));
      document.body.classList.add("shot");
    });
    await new Promise((r) => setTimeout(r, 350));
    const file = path.join(OUT, s.name + ".png");
    await page.screenshot({ path: file });
    console.log("shot: " + s.name);
  }

  // 额外：对话页真实提问
  await page.evaluate(() => { window.location.hash = "#/chat"; });
  await new Promise((r) => setTimeout(r, 700));
  await page.type("#chat-input", "这场仗是怎么打赢的？");
  await page.click("#chat-send");
  await new Promise((r) => setTimeout(r, 2600));
  await page.evaluate(() => document.body.classList.add("shot"));
  await page.screenshot({ path: path.join(OUT, "12-AI对话-真实提问.png") });
  console.log("shot: 12-AI对话-真实提问");

  await browser.close();

  console.log("\n=== 错误 ===");
  if (errors.length === 0) console.log("无");
  else [...new Set(errors)].forEach((e) => console.log(e));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
