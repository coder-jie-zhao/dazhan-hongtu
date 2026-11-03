/* =========================================================================
 * 大展红途 v2 · 视图 · 首页与路线
 *
 * 三个点位全部可进入。首页不再是「黄洋界 + 三个灰字」，
 * 而是一张真实的路线卡：缩略图 + 主题 + 完成进度。
 * ========================================================================= */
(function (root) {
  "use strict";
  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.views = DZHT.views || {};

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var C = {
    el: {},
    data: null,
    carousel: null,
    photoIndex: 0
  };

  function init(data) {
    C.data = data;
    C.el = {
      heroImg: $("home-hero-img"),
      navTag: $("home-nav-tag"),
      title: $("home-title"),
      sub: $("home-sub"),
      stats: $("home-stats"),
      routes: $("route-list"),
      cta: $("home-cta"),
      tools: $("home-tools")
    };

    renderHero();
    renderStats();
    renderRoutes();
    renderCTA();
    renderTools();
  }

  /* ---------- Hero：随点位轮换 ---------- */
  var heroIdx = 0;
  var HERO_ORDER = ["huangyangjie", "bajiaolou", "longjiangshuyuan"];

  function renderHero() {
    var pts = C.data.points;
    var p = pts[heroIdx % pts.length];
    // 首页 hero 用云海/建筑全景，点位页用该点位的主体实景
    var heroMap = {
      huangyangjie: "assets/img/hyj-04.jpg",
      bajiaolou: "assets/img/bjl-01.jpg",
      longjiangshuyuan: "assets/img/ljsy-01.jpg"
    };
    C.el.heroImg.src = heroMap[p.id] || p.hero;
    C.el.heroImg.alt = p.heroAlt;
    C.el.navTag.textContent = "井冈山 · " + pts.length + " 个点位";
    C.el.title.innerHTML = "三处旧址<br />一堂行走的课";
    C.el.sub.textContent = "AI 讲解员 · 现场任务 · 可解释的研学报告";
  }

  /* 背景图轮播，每 6 秒换一张（三个点位轮流） */
  function startHeroCycle() {
    if (root.DZHT.core.motion.reduceMotion) return;
    setInterval(function () {
      if (!document.body.contains(C.el.heroImg)) return;
      heroIdx++;
      C.el.heroImg.style.opacity = "0";
      setTimeout(function () {
        renderHero();
        C.el.heroImg.style.opacity = "1";
      }, 420);
    }, 6000);
  }

  /* ---------- 三个数字 ---------- */
  function renderStats() {
    var approved = C.data.corpus.filter(function (c) { return c.audit === "approved"; });
    var pointCount = C.data.points.length;
    var roleCount = C.data.roles.length;
    C.el.stats.innerHTML =
      '<div class="stat"><b data-count="' + approved.length + '">0</b><span>条已审核史料</span></div>' +
      '<div class="stat"><b data-count="' + roleCount + '">0</b><span>种对话身份</span></div>' +
      '<div class="stat"><b data-count="' + pointCount + '">0</b><span>个研学点位</span></div>';
    animateStats();
  }

  function animateStats() {
    var nodes = C.el.stats.querySelectorAll("[data-count]");
    nodes.forEach(function (n) {
      root.DZHT.core.motion.countTo(n, parseInt(n.getAttribute("data-count"), 10), { duration: 900 });
    });
  }

  /* ---------- 路线卡 ---------- */
  function renderRoutes() {
    var store = DZHT.core.store;
    var html = C.data.points.map(function (p) {
      var prog = store.allProgress()[p.id];
      var doneCount = 0, total = 0;
      if (prog) {
        total = Object.keys(prog.tasks || {}).length;
        doneCount = Object.keys(prog.tasks || {}).filter(function (k) { return prog.tasks[k]; }).length;
      }
      var pct = total ? Math.round(doneCount / total * 100) : 0;
      var done = prog && prog.done;
      return (
        '<button class="route-card card-tap' + (done ? ' done' : '') + '" data-point="' + p.id + '">' +
          '<div class="route-thumb"><img src="' + p.hero + '" alt="' + esc(p.heroAlt) + '" /></div>' +
          '<div class="route-body">' +
            '<div class="route-idx">POINT ' + String(p.order).padStart(2, "0") + '</div>' +
            '<div class="route-name">' + esc(p.name) + '</div>' +
            '<span class="route-theme">' + esc(p.theme) + '</span>' +
            (total
              ? '<div class="route-progress"><span class="bar-track"><span class="bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#A62B2E,#D8B681)"></span></span><span class="rp-label">' + doneCount + '/' + total + ' 任务</span></div>'
              : '<div class="route-progress"><span class="rp-label">尚未开始</span></div>') +
          '</div>' +
        '</button>'
      );
    }).join("");
    C.el.routes.innerHTML = html;
  }

  /* ---------- 主 CTA ---------- */
  function renderCTA() {
    var store = DZHT.core.store;
    var prog = store.allProgress();
    var started = C.data.points.filter(function (p) { return prog[p.id]; }).length;
    var user = store.getUser();

    if (!user) {
      C.el.cta.innerHTML = '<button class="btn btn-primary btn-lg" data-act="onboard">开始研学</button>';
      return;
    }
    if (started === 0) {
      C.el.cta.innerHTML =
        '<button class="btn btn-primary btn-lg" data-act="go-first">开始研学</button>' +
        '<p class="tiny dimmer center mt-2">你好，' + esc(user.name) + '。选一个点位开始。</p>';
      return;
    }
    C.el.cta.innerHTML =
      '<button class="btn btn-primary btn-lg" data-act="go-next">继续研学</button>' +
      '<p class="tiny dimmer center mt-2">已完成 ' + started + ' 个点位，点击上方按钮继续。</p>';
  }

  /* ---------- 工具入口 ---------- */
  function renderTools() {
    C.el.tools.innerHTML =
      '<button class="tool-card card-tap" data-nav="teacher">' +
        '<span class="tc-icon">◎</span>' +
        '<div class="tc-title">教师端</div>' +
        '<div class="tc-desc">班级数据 · 任务单生成</div>' +
      '</button>' +
      '<button class="tool-card card-tap" data-nav="audit">' +
        '<span class="tc-icon">⌘</span>' +
        '<div class="tc-title">审核管线</div>' +
        '<div class="tc-desc">四环节 · 语料溯源</div>' +
      '</button>' +
      '<button class="tool-card card-tap" data-nav="selftest">' +
        '<span class="tc-icon">✓</span>' +
        '<div class="tc-title">检索自测</div>' +
        '<div class="tc-desc">34 项验收用例</div>' +
      '</button>' +
      '<button class="tool-card card-tap" data-nav="ar">' +
        '<span class="tc-icon">◈</span>' +
        '<div class="tc-title">AR 导览</div>' +
        '<div class="tc-desc">方案设计阶段</div>' +
      '</button>';
  }

  /* ---------- 交互 ---------- */
  function bind() {
    // 路线卡 → 点位页
    C.el.routes.addEventListener("click", function (e) {
      var card = e.target.closest("[data-point]");
      if (!card) return;
      root.DZHT.core.motion.haptic(10);
      DZHT.core.router.go("point", { id: card.getAttribute("data-point") });
    });

    C.el.cta.addEventListener("click", function (e) {
      var act = e.target.closest("[data-act]");
      if (!act) return;
      var a = act.getAttribute("data-act");
      if (a === "onboard") { openOnboard(); return; }
      if (a === "go-first" || a === "go-next") {
        var store = DZHT.core.store;
        var prog = store.allProgress();
        // 优先去没做过的第一个；都做过了就去第一个
        var target = null;
        for (var i = 0; i < C.data.points.length; i++) {
          if (!prog[C.data.points[i].id]) { target = C.data.points[i]; break; }
        }
        if (!target) target = C.data.points[0];
        DZHT.core.router.go("point", { id: target.id });
      }
    });

    C.el.tools.addEventListener("click", function (e) {
      var t = e.target.closest("[data-nav]");
      if (!t) return;
      DZHT.core.router.go(t.getAttribute("data-nav"));
    });
  }

  function openOnboard() {
    DZHT.core.router.go("home");
    setTimeout(function () { $("onboard").classList.add("show"); }, 60);
  }

  DZHT.views.home = {
    init: init,
    bind: bind,
    onEnter: function () {
      renderStats();
      renderRoutes();
      renderCTA();
      startHeroCycle();
    }
  };
})(typeof self !== "undefined" ? self : this);
