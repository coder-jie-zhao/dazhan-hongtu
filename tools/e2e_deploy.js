/**
 * 验证部署包在「纯静态托管」环境下能否完整工作。
 *
 * 纯静态 = 没有 /api/chat（托管平台只发文件，不跑 Node）。
 * 这时前端必须靠 js/core/net.js 的 localAnswer 走离线兜底：
 *   fetch /api/chat 失败 → 本地检索（同一份 retrieval.js）→ 离线 QA 库 → 拒答
 *
 * 这个测试是上线前必须过的关：如果离线兜底不工作，
 * 别人打开网址点「问 AI」会一直卡在「正在查阅史料…」。
 */
const puppeteer = require("puppeteer-core");

const BASE = process.env.DEPLOY_BASE || "http://127.0.0.1:8140";
const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const findings = [];
const ok = (n, d) => console.log("  [OK]   " + n + (d ? " — " + d : ""));
const bad = (n, d) => { console.log("  [BAD]  " + n + (d ? " — " + d : "")); findings.push(n + " " + (d || "")); };

(async () => {
  const b = await puppeteer.launch({ executablePath: EXE, headless: "new", args: ["--no-sandbox"] });
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

  const errs = [];
  p.on("pageerror", (e) => errs.push("[pageerror] " + e.message));
  p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errs.push("[console] " + m.text()); });

  console.log("=== 1. 首屏加载（纯静态）===");
  await p.goto(BASE + "/index.html", { waitUntil: "networkidle2", timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1800));

  const boot = await p.evaluate(() => ({
    routes: document.querySelectorAll("#route-list .route-card").length,
    stats: Array.from(document.querySelectorAll("#home-stats .stat b")).map((n) => n.textContent),
    heroOk: (function () { const i = document.getElementById("home-hero-img"); return i.complete && i.naturalWidth > 0; })(),
    errorShown: document.body.textContent.includes("语料库加载失败")
  }));
  boot.routes === 3 && boot.heroOk && !boot.errorShown
    ? ok("首屏正常", boot.stats.join("/") + " 点位" + boot.routes)
    : bad("首屏异常", JSON.stringify(boot));

  // 填写身份
  await p.evaluate(() => {
    document.getElementById("inp-name").value = "访客";
    document.getElementById("inp-school").value = "测试";
    document.getElementById("btn-onboard").click();
  });
  await new Promise((r) => setTimeout(r, 600));

  console.log("\n=== 2. AI 问答（无后端，走离线兜底）===");
  await p.evaluate(() => { window.location.hash = "#/chat?id=huangyangjie"; });
  await new Promise((r) => setTimeout(r, 1200));
  await p.evaluate(() => {
    document.getElementById("chat-input").value = "这场仗是怎么打赢的？";
    document.getElementById("chat-send").click();
  });
  await new Promise((r) => setTimeout(r, 6000));

  const ask = await p.evaluate(() => {
    const ai = document.querySelectorAll("#chat-body .msg.ai");
    const last = ai[ai.length - 1];
    return {
      aiCount: ai.length,
      answer: last ? last.querySelector(".bubble").textContent : "",
      srcCount: document.querySelectorAll("#chat-body .msg-source").length,
      stuck: !!document.getElementById("chat-retrieving")
    };
  });
  if (ask.aiCount > 0 && ask.answer.length > 10 && !ask.stuck) {
    ok("离线兜底能答", ask.answer.slice(0, 40) + "…");
  } else {
    bad("离线兜底失效", JSON.stringify(ask).slice(0, 160));
  }
  ask.srcCount > 0 ? ok("离线回答带出处") : bad("离线回答缺出处");

  console.log("\n=== 3. 超纲拒答（无后端）===");
  await p.evaluate(() => {
    document.getElementById("chat-input").value = "黄洋界的门票多少钱？";
    document.getElementById("chat-send").click();
  });
  await new Promise((r) => setTimeout(r, 6000));
  const ref = await p.evaluate(() => {
    const nodes = document.querySelectorAll("#chat-body .msg.ai.msg-refusal");
    return { n: nodes.length, text: nodes.length ? nodes[nodes.length - 1].textContent : "" };
  });
  ref.n > 0 && ref.text.includes("超出") ? ok("超纲问题离线也拒答") : bad("拒答失效", JSON.stringify(ref).slice(0, 120));

  console.log("\n=== 4. 任务与报告 ===");
  await p.evaluate(() => { window.location.hash = "#/task?id=bajiaolou"; });
  await new Promise((r) => setTimeout(r, 1200));
  const task = await p.evaluate(() => ({
    cards: document.querySelectorAll("#task-body .task-card").length,
    photos: document.querySelectorAll("#point-photos img").length
  }));
  task.cards === 4 ? ok("任务单 4 题", "") : bad("任务数异常", String(task.cards));

  await p.evaluate(() => { window.location.hash = "#/report?id=bajiaolou"; });
  await new Promise((r) => setTimeout(r, 1200));
  const rpt = await p.evaluate(() => ({
    bars: document.querySelectorAll("#rpt-bars .rpt-bar-row").length,
    comment: (document.getElementById("rpt-comment") || {}).textContent || ""
  }));
  rpt.bars === 4 && rpt.comment.length > 10 ? ok("报告可生成") : bad("报告异常", JSON.stringify(rpt).slice(0, 100));

  console.log("\n=== 5. 全部图片可加载 ===");
  await p.evaluate(() => { window.location.hash = "#/point?id=longjiangshuyuan"; });
  await new Promise((r) => setTimeout(r, 1500));
  const imgs = await p.evaluate(() =>
    Array.from(document.querySelectorAll("#view-point img")).map((i) => ({ src: i.getAttribute("src"), ok: i.complete && i.naturalWidth > 0 }))
  );
  const broken = imgs.filter((i) => !i.ok);
  broken.length === 0 ? ok("图片全部加载", imgs.length + " 张") : bad("有图片加载失败", broken.map((x) => x.src).join(", "));

  console.log("\n=== 6. 运行时错误 ===");
  // 纯静态托管没有 /api/*，浏览器必然对 /api/chat、/api/health 报
  // 「Failed to load resource: 404/501」。这是预期内的降级路径，不是代码缺陷。
  // 真正要盯的是 JS 异常（pageerror）和非网络类的 console.error。
  const real = errs.filter((e) => {
    if (e.startsWith("[pageerror]")) return true;
    if (e.includes("Failed to load resource")) return false;
    if (/status of \d{3}/.test(e)) return false;
    return true;
  });
  real.length === 0
    ? ok("无 JS 异常（/api 的 404 属预期降级）", errs.length ? errs.length + " 条网络降级已忽略" : "")
    : bad("JS 错误", real.slice(0, 3).join(" | "));

  await b.close();

  console.log("\n" + "=".repeat(52));
  console.log(findings.length === 0 ? "结论：部署包在纯静态环境下可完整运行" : "问题 " + findings.length + " 处：\n" + findings.join("\n"));
  process.exitCode = findings.length ? 1 : 0;
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
