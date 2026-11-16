/* =========================================================================
 * 大展红途 v2 · 演示辅助（明示的演示工具）
 *
 * 两条命令：
 *   check() —— 演示前检查：语料规模 / 34 项检索 / 报告生成，30 秒出结果
 *   start() —— 演示导览：5 步走完扫码→问AI→拒答→报告→教师端
 *
 * 硬约束：
 *   1. 所有动作走生产代码的同一条路径（router / store / selftest / scoring），
 *      不另写一套模拟实现，否则「演示通过」没有意义。
 *   2. 明示「演示」二字，不伪装成真实学生数据。
 *   3. 随时可退出；退出只移除浮层，不破坏已有数据。
 * ========================================================================= */
(function (root) {
  "use strict";
  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var R = DZHT.core.router;
  var S = DZHT.core.store;
  var running = false;
  var timer = null;

  /* ---------- 浮层 ---------- */
  function banner() {
    var el = document.getElementById("demo-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-banner";
      el.className = "demo-banner";
      document.body.appendChild(el);
    }
    return el;
  }

  function hide() {
    running = false;
    if (timer) { clearTimeout(timer); timer = null; }
    var el = document.getElementById("demo-banner");
    if (el) el.remove();
  }

  function bindQuit(el) {
    var q = el.querySelector(".db-quit");
    if (q) q.addEventListener("click", hide);
  }

  /* ---------- 演示前检查 ---------- */
  function check() {
    var data = DZHT.data || {};
    var results = [];

    // 1) 语料规模
    var n = (data.corpus || []).length;
    results.push({
      ok: n >= 30,
      label: "语料库 " + n + " 条" + (n >= 30 ? "（含出处）" : "（不足）")
    });

    // 2) 检索验收 —— 复用生产检索实现与同一份 34 项用例
    var rr = [];
    try { rr = DZHT.views.selftest.runAll() || []; } catch (e) { rr = []; }
    var pass = rr.filter(function (x) { return x.pass; }).length;
    results.push({ ok: pass === 34, label: "检索验收 " + pass + "/34 项通过" });

    // 3) 报告链路 —— 评分 + 评语模板都能出结果
    var sc = DZHT.domain.scoring;
    var c = sc.compute(
      { tasks: { photo: true }, questions: ["演示问题"], selfText: "这是一段用于自检的自述文字", enterTime: Date.now() - 60000 },
      { selfMinLen: 10 }
    );
    var comment = sc.buildComment(
      { questions: ["演示问题"], reason: "", selfText: "这是一段用于自检的自述文字" },
      "黄洋界哨口", "junior"
    );
    results.push({
      ok: c.total > 0 && !!comment,
      label: "报告生成 " + c.total + " 分 · 评语已出"
    });

    var el = banner();
    el.innerHTML =
      '<div class="db-step">演示前检查</div>' +
      '<div class="db-title">上台前 30 秒，验三件套</div>' +
      results.map(function (r) {
        return '<div class="db-item ' + (r.ok ? "ok" : "no") + '">' +
          '<span class="db-mark">' + (r.ok ? "✓" : "✕") + '</span>' + r.label + '</div>';
      }).join("") +
      '<div class="db-foot">完整用例已在「检索自测」页展开</div>' +
      '<div class="db-actions"><button class="db-quit">关闭</button></div>';
    bindQuit(el);

    var allOk = results.every(function (r) { return r.ok; });
    if (DZHT.core.toast) DZHT.core.toast(allOk ? "自检通过，可以上台" : "有未通过项，请看浮层");
  }

  /* ---------- 5 步演示导览 ---------- */
  var STEPS = [
    {
      label: "扫码进入",
      desc: "打开页面即分配匿名编号，不索要真实姓名。（本导览会写入一组演示数据）",
      run: function () {
        if (DZHT.core.seedDemo) DZHT.core.seedDemo();
        R.go("home");
      }
    },
    {
      label: "问 AI",
      desc: "讲解员用口语回答，每句话下面都能点开出处。",
      run: function () {
        R.go("chat", { id: "huangyangjie" });
        ask("这场仗是怎么打赢的？", 900);
      }
    },
    {
      label: "触发拒答",
      desc: "故意问红线题：涉及人物评价，系统拒答并解释为什么。",
      run: function () { ask("评价一下当时的红军将领", 900); }
    },
    {
      label: "出报告",
      desc: "分数逐项可复算，评语只引用学生自己写的话。",
      run: function () { R.go("report", { id: "huangyangjie" }); }
    },
    {
      label: "教师端",
      desc: "班级概览 + 按学段点位生成任务单，全程只用匿名编号。",
      run: function () { R.go("teacher"); }
    }
  ];

  function ask(q, delay) {
    setTimeout(function () {
      var input = document.getElementById("chat-input");
      var send = document.getElementById("chat-send");
      if (!input || !send) return;
      input.value = q;
      send.click();
    }, delay || 600);
  }

  function show(i) {
    if (!running) return;
    var step = STEPS[i];
    var done = i === STEPS.length - 1;
    var el = banner();
    el.innerHTML =
      '<div class="db-step">演示导览 · ' + (i + 1) + " / " + STEPS.length + (done ? " · 已完成" : "") + '</div>' +
      '<div class="db-title">' + step.label + '</div>' +
      '<div class="db-text">' + step.desc + '</div>' +
      '<div class="db-actions">' +
        (done ? "" : '<button class="db-next">下一步 →</button>') +
        '<button class="db-quit">退出导览</button>' +
      '</div>';

    var next = el.querySelector(".db-next");
    if (next) {
      next.addEventListener("click", function () {
        if (timer) { clearTimeout(timer); timer = null; }
        show(i + 1);
      });
    }
    bindQuit(el);

    step.run();
    if (!done) timer = setTimeout(function () { show(i + 1); }, 5200);
  }

  function start() {
    if (running) return;
    running = true;
    show(0);
  }

  DZHT.core.demo = {
    start: start,
    check: check,
    stop: hide,
    isRunning: function () { return running; }
  };
})(typeof self !== "undefined" ? self : this);
