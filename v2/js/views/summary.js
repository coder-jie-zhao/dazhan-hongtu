/* 线路总报告：把三个点位合起来看，回答「这次研学到底收获了什么」。
   单点位报告交给 report.js，这里只做聚合，分数仍走 scoring 纯函数，评语仍是模板。 */
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

  var C = { data: null };

  function init(data) {
    C.data = data;
    C.el = {
      route: $("sum-route"),
      scores: $("sum-scores"),
      questions: $("sum-questions"),
      comments: $("sum-comments"),
      meta: $("sum-meta"),
      no: $("sum-no")
    };
  }

  function collect() {
    var store = DZHT.core.store;
    var user = store.getUser() || {};
    var gradeCfg = DZHT.domain.tasks.gradeById(user.grade || "junior");
    var all = store.allProgress() || {};
    var points = C.data.points;
    var rows = [];

    points.forEach(function (p) {
      var prog = all[p.id] || {};
      var tasks = prog.tasks || {};
      var done = Object.keys(tasks).filter(function (k) { return tasks[k]; }).length;
      var sc = DZHT.domain.scoring.compute({
        tasks: tasks,
        choiceCorrect: prog.choiceCorrect,
        orderCorrect: prog.orderCorrect,
        questions: prog.questions || [],
        enterTime: prog.enterTime,
        selfText: prog.selfText || ""
      }, { selfMinLen: gradeCfg.textMinLen || 20 });
      rows.push({ point: p, prog: prog, done: done, sc: sc });
    });
    return { rows: rows, user: user, gradeCfg: gradeCfg };
  }

  function render() {
    if (!C.el.route) return;
    var got = collect();
    var rows = got.rows;
    var finished = rows.filter(function (r) { return r.done > 0; }).length;

    // 汇总编号：由匿名编号派生，与单点位报告无关
    var code = got.user.code || (DZHT.core.store.ensureCode && DZHT.core.store.ensureCode()) || "JX-0000";
    var h = 0;
    var seed = code + "|summary";
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    if (C.el.no) C.el.no.textContent = "DZHT-2026-" + String(h % 10000).padStart(4, "0");
    if (C.el.meta) {
      C.el.meta.innerHTML =
        '<span>完成 <b>' + finished + '/' + rows.length + '</b> 个点位</span>' +
        '<span>学段 <b>' + esc(got.gradeCfg.name) + '</b></span>' +
        '<span>匿名编号 <b>' + esc(code) + '</b></span>';
    }

    // 线路图：三张点位卡，显示完成状态与得分
    C.el.route.innerHTML = rows.map(function (r, idx) {
      var state = r.done > 0 ? "done" : "todo";
      var pct = Math.round(r.sc.total / 4);
      return '<div class="sum-stop ' + state + '">' +
        '<div class="sum-stop-dot">' + (idx + 1) + '</div>' +
        '<div class="sum-stop-body">' +
          '<div class="sum-stop-name">' + esc(r.point.name) + '</div>' +
          '<div class="sum-stop-sub">' + (r.done > 0
            ? (r.done + ' 项任务 · 均分 ' + pct)
            : '尚未开始') + '</div>' +
        '</div>' +
        '<div class="sum-stop-mark">' + (r.done > 0 ? '✓' : '○') + '</div>' +
      '</div>' +
      (idx < rows.length - 1 ? '<div class="sum-stop-line"></div>' : '');
    }).join("");

    // 四维合计：对三个点位的同维度取平均，保留可复算的明细
    var keys = DZHT.domain.scoring.FORMULAS;
    var totals = { shi: 0, probe: 0, observe: 0, express: 0 };
    rows.forEach(function (r) {
      r.sc.items.forEach(function (it) { totals[it.key] += it.value; });
    });
    C.el.scores.innerHTML = keys.map(function (f) {
      var avg = Math.round(totals[f.key] / rows.length);
      return '<div class="sum-score-row">' +
        '<span class="sum-score-label">' + esc(f.label) + '</span>' +
        '<span class="sum-score-track"><span class="sum-score-fill" style="width:' + avg + '%"></span></span>' +
        '<b class="sum-score-num">' + avg + '</b>' +
      '</div>';
    }).join("") +
    '<div class="sum-score-note">各维度为三处点位的平均分，按评分规则直接算出，不经过模型。</div>';

    // 合并提问时间线：带点位标签，按发生顺序
    var qs = [];
    rows.forEach(function (r) {
      (r.prog.questions || []).forEach(function (q) {
        qs.push({ q: q, point: r.point.name });
      });
    });
    C.el.questions.innerHTML = qs.length
      ? qs.map(function (it) {
          return '<div class="sum-q"><span class="sum-q-point">' + esc(it.point) + '</span>' +
            '<span class="sum-q-text">' + esc(it.q) + '</span></div>';
        }).join("")
      : '<div class="sum-empty">三处点位都没有提问</div>';

    // 总评语：每处点位各出一句，仍由模板拼接、引用学生原话
    C.el.comments.innerHTML = rows.map(function (r) {
      var txt = DZHT.domain.scoring.buildComment({
        questions: r.prog.questions || [],
        reason: r.prog.reason || "",
        selfText: r.prog.selfText || ""
      }, r.point.name, got.gradeCfg.id);
      return '<div class="sum-comment">' +
        '<div class="sum-comment-at">' + esc(r.point.name) + '</div>' +
        '<div class="sum-comment-text">' + esc(txt) + '</div>' +
      '</div>';
    }).join("");
  }

  DZHT.views.summary = {
    init: init,
    onEnter: render
  };
})(typeof self !== "undefined" ? self : this);
