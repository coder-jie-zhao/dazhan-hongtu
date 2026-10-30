/**
 * 大展红途 v2 · E2E 走查
 * 模拟真实学生从首次进入到拿到报告的完整路径，逐步骤断言。
 * 目的：找出「代码看着对、用起来不对」的问题。
 *
 * 用法：NODE_PATH=... node tools/e2e_v2.js
 */
const path = require("path");
const fs = require("fs");
const puppeteer = require("puppeteer-core");

const BASE = process.env.BASE_URL || "http://127.0.0.1:8130";
const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const findings = [];
function ok(name, detail) { console.log("  [OK]   " + name + (detail ? " — " + detail : "")); }
function bad(name, detail) {
  console.log("  [BAD]  " + name + (detail ? " — " + detail : ""));
  findings.push({ name, detail });
}
function warn(name, detail) { console.log("  [WARN] " + name + (detail ? " — " + detail : "")); }

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EXE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("favicon")) errors.push("console: " + m.text());
  });

  // 全新会话：清空 localStorage
  await page.goto(BASE + "/index.html", { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("\n=== 1. 首次进入 / 欢迎弹窗 ===");
  const onboardShown = await page.evaluate(() => document.getElementById("onboard").classList.contains("show"));
  onboardShown ? ok("首次进入弹出欢迎窗") : bad("首次进入未弹欢迎窗", "新用户不知道怎么开始");

  // 空姓名直接点开始
  await page.click("#btn-onboard");
  await new Promise((r) => setTimeout(r, 400));
  const stillOpen = await page.evaluate(() => document.getElementById("onboard").classList.contains("show"));
  const toastText = await page.evaluate(() => document.getElementById("toast").textContent);
  stillOpen && toastText.includes("姓名") ? ok("空姓名有拦截提示", toastText) : bad("空姓名可跳过", "toast=" + toastText);

  // 正常填写
  await page.type("#inp-name", "赵杰");
  await page.type("#inp-school", "东华理工大学");
  await page.click("#btn-onboard");
  await new Promise((r) => setTimeout(r, 700));
  const closed = await page.evaluate(() => !document.getElementById("onboard").classList.contains("show"));
  closed ? ok("填写后正常关闭") : bad("填写后未关闭");

  console.log("\n=== 2. 首页 ===");
  const stats = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("#home-stats .stat b")).map((n) => n.textContent);
  });
  stats.every((v) => Number(v) > 0) ? ok("统计数字已渲染", stats.join(" / ")) : bad("统计数字异常", stats.join(","));

  const routeCount = await page.evaluate(() => document.querySelectorAll("#route-list .route-card").length);
  routeCount === 3 ? ok("三个点位路线卡") : bad("路线卡数量异常", String(routeCount));

  console.log("\n=== 3. 点位页（三个点位都进去看） ===");
  for (const pid of ["huangyangjie", "bajiaolou", "longjiangshuyuan"]) {
    await page.evaluate((id) => { window.location.hash = "#/point?id=" + id; }, pid);
    await new Promise((r) => setTimeout(r, 900));
    const info = await page.evaluate(() => ({
      title: document.getElementById("point-title").textContent,
      hero: document.getElementById("point-hero-img").getAttribute("src"),
      cards: document.querySelectorAll("#point-cards .info-card").length,
      photos: document.querySelectorAll("#point-photos .pp-item").length,
      heroLoaded: (function () {
        const img = document.getElementById("point-hero-img");
        return img.complete && img.naturalWidth > 0;
      })()
    }));
    if (info.heroLoaded && info.cards > 0 && info.photos > 0) {
      ok(pid + " 渲染完整", info.title + " hero=" + info.hero.split("/").pop() + " 卡" + info.cards + " 图" + info.photos);
    } else {
      bad(pid + " 渲染不完整", JSON.stringify(info));
    }
  }

  console.log("\n=== 4. AI 对话 ===");
  await page.evaluate(() => { window.location.hash = "#/chat?id=huangyangjie"; });
  await new Promise((r) => setTimeout(r, 900));

  // 4a 空输入
  await page.click("#chat-send");
  await new Promise((r) => setTimeout(r, 500));
  const emptyMsgCount = await page.evaluate(() => document.querySelectorAll("#chat-body .msg").length);
  emptyMsgCount === 0 ? ok("空输入不发送") : bad("空输入产生了消息", String(emptyMsgCount));

  // 4b 正常提问
  await page.type("#chat-input", "这场仗是怎么打赢的？");
  await page.click("#chat-send");
  await new Promise((r) => setTimeout(r, 4000));
  const chatState = await page.evaluate(() => ({
    msgs: document.querySelectorAll("#chat-body .msg").length,
    aiCount: document.querySelectorAll("#chat-body .msg.ai").length,
    aiText: (document.querySelector("#chat-body .msg.ai .bubble") || {}).textContent || "",
    srcCount: document.querySelectorAll("#chat-body .msg-source").length,
    inputCleared: document.getElementById("chat-input").value === "",
    // 调试用：把最后一条 AI 消息的 HTML 结构带出来
    lastAiHtml: (function () {
      const list = document.querySelectorAll("#chat-body .msg.ai");
      return list.length ? list[list.length - 1].innerHTML.slice(0, 200) : "";
    })()
  }));
  chatState.msgs >= 2 && chatState.aiText.length > 10 ? ok("AI 正常回答") : bad("AI 未回答", JSON.stringify(chatState).slice(0, 150));
  chatState.srcCount > 0
    ? ok("回答带史料出处", chatState.srcCount + " 条")
    : bad("回答缺出处", "srcCount=0；AI 消息结构=" + chatState.lastAiHtml);
  chatState.inputCleared ? ok("发送后清空输入框") : warn("发送后未清空输入框");

  // 4c 拒答
  await page.type("#chat-input", "黄洋界的门票多少钱？");
  await page.click("#chat-send");
  await new Promise((r) => setTimeout(r, 3200));
  const refusal = await page.evaluate(() => {
    const nodes = document.querySelectorAll("#chat-body .msg.ai.msg-refusal");
    return { count: nodes.length, text: nodes.length ? nodes[0].textContent : "" };
  });
  refusal.count > 0 && refusal.text.includes("超出") ? ok("超纲问题正确拒答") : bad("拒答失效", JSON.stringify(refusal).slice(0, 100));

  // 4d 连续快速点击（防重复提交）
  await page.evaluate(() => {
    const inp = document.getElementById("chat-input");
    inp.value = "红军当时吃什么？";
    const btn = document.getElementById("chat-send");
    btn.click(); btn.click(); btn.click();
  });
  await new Promise((r) => setTimeout(r, 3000));
  const afterSpam = await page.evaluate(() => {
    const qs = document.querySelectorAll("#chat-body .msg.user");
    return qs.length;
  });
  afterSpam <= 4 ? ok("连点防重复提交生效", "用户消息数=" + afterSpam) : warn("连点可能重复提交", "用户消息数=" + afterSpam);

  console.log("\n=== 5. 任务页 ===");
  await page.evaluate(() => { window.location.hash = "#/task?id=huangyangjie"; });
  await new Promise((r) => setTimeout(r, 1000));
  const taskInfo = await page.evaluate(() => ({
    cards: document.querySelectorAll("#task-body .task-card").length,
    progress: document.querySelectorAll("#task-progress .tprog-item").length,
    reportDisabled: document.getElementById("btn-report").disabled,
    submitBtns: document.querySelectorAll("#task-body [data-submit]").length
  }));
  taskInfo.cards === taskInfo.progress ? ok("任务数与进度条一致", taskInfo.cards + " 题") : bad("任务数与进度条不一致", JSON.stringify(taskInfo));
  taskInfo.reportDisabled ? ok("未完成任务时报告锁定") : bad("未完成任务即可出报告");

  // 5a 单选题：选错
  const choiceInfo = await page.evaluate(() => {
    const opts = document.querySelectorAll('.task-option[data-task]');
    if (!opts.length) return null;
    const tid = opts[0].getAttribute("data-task");
    return { tid, count: opts.length };
  });
  if (choiceInfo) {
    // 点第一个选项（通常是错的）
    await page.evaluate(() => {
      const opt = document.querySelector('.task-option[data-task]');
      opt.click();
    });
    await new Promise((r) => setTimeout(r, 300));
    await page.evaluate((tid) => {
      const btn = document.querySelector('[data-submit="' + tid + '"]');
      if (btn) btn.click();
    }, choiceInfo.tid);
    await new Promise((r) => setTimeout(r, 500));
    const statusText = await page.evaluate((tid) => {
      const el = document.getElementById("status-" + tid);
      return el ? el.textContent : "";
    }, choiceInfo.tid);
    statusText.length > 0 ? ok("单选题有校验反馈", statusText.slice(0, 40)) : bad("单选题提交无任何反馈");
  }

  console.log("\n=== 6. 报告页（未完成任务） ===");
  await page.evaluate(() => { window.location.hash = "#/report?id=huangyangjie"; });
  await new Promise((r) => setTimeout(r, 900));
  const reportBefore = await page.evaluate(() => ({
    name: document.getElementById("rpt-name").textContent,
    comment: document.getElementById("rpt-comment").textContent,
    bars: document.querySelectorAll("#rpt-bars .rpt-bar-row").length,
    questions: document.querySelectorAll("#rpt-questions li:not(.rpt-empty)").length
  }));
  reportBefore.name === "赵杰" ? ok("报告带学生姓名") : bad("报告姓名错误", reportBefore.name);
  reportBefore.bars === 4 ? ok("四项能力评估齐全") : bad("能力项数量异常", String(reportBefore.bars));
  reportBefore.comment.length > 10 ? ok("评语已生成") : bad("评语为空");

  console.log("\n=== 7. 教师端 ===");
  await page.evaluate(() => { window.location.hash = "#/teacher"; });
  await new Promise((r) => setTimeout(r, 900));
  const tch = await page.evaluate(() => ({
    rows: document.querySelectorAll("#teacher-tbody tr").length,
    hasRealName: document.body.textContent.includes("李雯") || document.body.textContent.includes("王浩"),
    tgItems: document.querySelectorAll("#tg-out .tg-item").length
  }));
  tch.rows > 0 ? ok("班级明细有数据", tch.rows + " 行") : bad("班级明细为空");
  !tch.hasRealName ? ok("无真实姓名（匿名编号）") : bad("出现真实姓名", "违反计划书 6.3");
  tch.tgItems > 0 ? ok("任务单生成器有输出", tch.tgItems + " 题") : bad("任务单生成器为空");

  // 7a 切换学段
  await page.evaluate(() => {
    const chips = document.querySelectorAll("#tg-grade .tg-chip");
    if (chips[1]) chips[1].click();
  });
  await new Promise((r) => setTimeout(r, 600));
  const gradeSwitched = await page.evaluate(() => document.querySelectorAll("#tg-out .tg-item").length);
  gradeSwitched > 0 ? ok("切换学段后任务单更新", gradeSwitched + " 题") : bad("切换学段后任务单为空");

  console.log("\n=== 8. 检索自测台 ===");
  await page.evaluate(() => { window.location.hash = "#/selftest"; });
  await new Promise((r) => setTimeout(r, 1500));
  const st = await page.evaluate(() => ({
    big: (document.querySelector(".ts-big") || {}).textContent || "",
    items: document.querySelectorAll("#test-list .test-item").length,
    failed: document.querySelectorAll("#test-list .pass-no").length
  }));
  st.items === 34 && st.failed === 0 ? ok("34 项全部通过", st.big) : bad("自测未全通过", st.big + " 项数=" + st.items + " 失败=" + st.failed);

  console.log("\n=== 9. 浏览器返回键 ===");
  await page.evaluate(() => { window.location.hash = "#/point?id=huangyangjie"; });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => history.back());
  await new Promise((r) => setTimeout(r, 900));
  const backOk = await page.evaluate(() => {
    const active = document.querySelector(".view.active");
    return active ? active.id : "none";
  });
  backOk !== "view-point" ? ok("浏览器返回键有效", "回到 " + backOk) : bad("返回键无效", "仍停留在 " + backOk);

  console.log("\n=== 10. 运行时错误 ===");
  if (errors.length === 0) ok("全程无 JS 错误");
  else [...new Set(errors)].forEach((e) => bad("JS 错误", e.slice(0, 160)));

  await browser.close();

  console.log("\n" + "=".repeat(56));
  if (findings.length === 0) {
    console.log("结论：未发现阻断性问题");
  } else {
    console.log("发现问题 " + findings.length + " 处：");
    findings.forEach((f, i) => console.log("  " + (i + 1) + ". [" + f.name + "] " + (f.detail || "")));
  }
  process.exitCode = findings.length ? 1 : 0;
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
