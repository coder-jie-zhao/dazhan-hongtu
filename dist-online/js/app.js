/* =========================================================================
 * 大展红途 v2 · 应用入口
 *
 * 装配顺序：数据 → 视图注册 → 事件绑定 → 路由启动
 * 所有视图只管自己的渲染与交互，跨视图的状态一律走 core.store。
 * ========================================================================= */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  function $(id) { return document.getElementById(id); }

  var DATA = null;
  var booted = false;

  /* ---------- URL 参数 ----------
     ?demo=1    灌入演示数据（截图 / PPT / 路演用）
     ?embed=1   去掉桌面阴影与暗场（供 showcase 内嵌） */
  var PARAMS = new URLSearchParams(location.search);
  var DEMO = PARAMS.get("demo") === "1";
  var EMBED = PARAMS.get("embed") === "1";

  /* ---------- 演示数据种子 ----------
     让报告页 / 任务页 / 教师端在截图时不出空状态。
     每个点位的任务 id 与该点位的任务单一致（t1 / t1b / t1c）。 */
  function seedDemo() {
    var S = DZHT.core.store;
    S.saveUser("赵杰", "东华理工大学", "junior");
    var photoTask = { huangyangjie: "t1", bajiaolou: "t1b", longjiangshuyuan: "t1c" };
    DATA.points.forEach(function (p) {
      var tasks = {};
      tasks[photoTask[p.id] || "t1"] = true;
      S.setProgress(p.id, {
        tasks: tasks,
        choiceCorrect: true,
        orderCorrect: true,
        reason: "山高路陡，敌人兵再多也展不开；红军又连夜布了竹钉阵，老乡还帮着送粮、抬担架。装备差得远，是地形和人心补上了。",
        selfText: "以前我以为守住一个山口靠的是人多，今天才知道地形和人心一样重要。红军能赢，不是因为他们更强，是因为他们和老百姓是一伙的。",
        questions: ["这场仗是怎么打赢的？", "为什么叫「黄洋界上炮声隆」？", "红军当时吃什么？"],
        enterTime: Date.now() - 32 * 60 * 1000,
        done: true
      });
    });
  }

  /* ---------- 加载语料库 ----------
     file:// 打开时 fetch 会被 CORS 拦，所以先试 fetch，失败则回落到内联数据。
     内联数据由 data/corpus.js 提供（V2 附带的 fallback 版本）。 */
  function loadData() {
    return fetch("data/corpus.json", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function () {
        if (root.DZHT_DATA) return root.DZHT_DATA;
        throw new Error("无法加载语料库：既读不到 data/corpus.json，也没有内联兜底");
      });
  }

  /* ---------- 全局动作表 ----------
     所有视图共用一套 data-act，视图自己处理具体行为。 */
  function bindGlobalActions() {
    document.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (act) {
        handleAction(act.getAttribute("data-act"));
        return;
      }
      var nav = e.target.closest("[data-nav]");
      if (nav) {
        DZHT.core.router.go(nav.getAttribute("data-nav"));
        return;
      }
      var close = e.target.closest("[data-close]");
      if (close) {
        var m = document.getElementById(close.getAttribute("data-close"));
        if (m) m.classList.remove("show");
      }
    });
  }

  function handleAction(act) {
    switch (act) {
      case "home": DZHT.core.router.go("home"); break;
      case "point": DZHT.core.router.go("point", { id: currentPointId() }); break;
      case "chat": DZHT.core.router.go("chat"); break;
      case "task": DZHT.core.router.go("task"); break;
      case "guide": openGuide(); break;
      case "report": DZHT.core.router.go("report"); break;
      case "onboard": $("onboard").classList.add("show"); break;
    }
  }

  function currentPointId() {
    var p = DZHT.views.point.point();
    return p ? p.id : "huangyangjie";
  }

  function openGuide() {
    var p = DZHT.views.point.point();
    if (!p) return;
    $("guide-title").textContent = p.name + " · 讲解词";
    $("guide-text").textContent = p.guide;
    $("guide-modal").classList.add("show");
  }

  /* ---------- 首次进入：姓名 / 学校 / 学段 ---------- */
  function setupOnboard() {
    var grades = DZHT.domain.tasks.GRADES;
    var box = $("onboard-grade");
    var selected = "junior";
    box.innerHTML = grades.map(function (g, i) {
      return '<button class="chip' + (i === 0 ? " active" : "") + '" data-g="' + g.id + '">' + g.name + '</button>';
    }).join("");

    box.addEventListener("click", function (e) {
      var c = e.target.closest("[data-g]");
      if (!c) return;
      selected = c.getAttribute("data-g");
      box.querySelectorAll(".chip").forEach(function (x) {
        x.classList.toggle("active", x.getAttribute("data-g") === selected);
      });
    });

    $("btn-onboard").addEventListener("click", function () {
      var name = $("inp-name").value.trim();
      var school = $("inp-school").value.trim() || "—";
      if (!name) { DZHT.core.toast("请先填写姓名"); return; }
      DZHT.core.store.saveUser(name, school, selected);
      $("onboard").classList.remove("show");
      DZHT.core.toast("你好，" + name + "同学");
      DZHT.core.motion.haptic(14);
    });
  }

  /* ---------- 路由注册 ---------- */
  function registerViews() {
    var router = DZHT.core.router;
    var views = ["home", "point", "chat", "task", "report", "teacher", "audit", "selftest", "ar"];
    views.forEach(function (name) {
      var mod = DZHT.views[name];
      if (!mod) return;
      router.register(name, {
        el: $("view-" + name),
        onEnter: mod.onEnter,
        onLeave: mod.onLeave,
        onUpdate: mod.onUpdate
      });
    });
  }

  /* ---------- 启动 ---------- */
  function boot() {
    if (booted) return;
    booted = true;

    loadData().then(function (data) {
      DATA = data;
      DZHT.data = data;

      // 初始化核心
      DZHT.core.store.load();
      DZHT.core.toast = toast;
      if (EMBED) document.body.classList.add("embed");
      if (DEMO) seedDemo();

      // 初始化视图
      Object.keys(DZHT.views).forEach(function (k) {
        if (DZHT.views[k].init) DZHT.views[k].init(data);
      });
      Object.keys(DZHT.views).forEach(function (k) {
        if (DZHT.views[k].bind) DZHT.views[k].bind();
      });

      registerViews();
      bindGlobalActions();
      setupOnboard();
      DZHT.core.motion.attachRipple(document.body);

      // 首次进入显示欢迎
      if (!DZHT.core.store.getUser()) $("onboard").classList.add("show");

      // 预探测网络状态
      DZHT.core.net.health();

      DZHT.core.router.start();

      document.body.classList.add("ready");
    }).catch(function (err) {
      console.error("[boot] 启动失败", err);
      var app = document.getElementById("app");
      app.innerHTML =
        '<div style="padding:60px 24px;text-align:center;color:#8a8078;font-family:system-ui">' +
        '<div style="font-size:34px;margin-bottom:12px">⚠</div>' +
        '<div style="font-size:15px;margin-bottom:8px">语料库加载失败</div>' +
        '<div style="font-size:12px;line-height:1.7;opacity:.8">' + String(err.message || err) + '</div>' +
        '<div style="font-size:11px;margin-top:16px;opacity:.6">请确认 data/corpus.json 存在，或通过 node server.js 启动</div>' +
        '</div>';
    });
  }

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  /* ---------- 全局错误兜底 ---------- */
  root.addEventListener("error", function (e) {
    console.error("[global error]", e.error || e.message);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof self !== "undefined" ? self : this);
