/* =========================================================================
 * 大展红途 v2 · 视图 · 检索验收自测台
 *
 * 计划书 2.8：「共 34 项，每次改动后一键重跑」。
 * v1 的这套用例只能跑命令行（node _probe.js），评委在手机上根本看不到。
 * 这一页把它搬进前端：点一下，全部用例当场跑完，逐条给结果。
 *
 * 关键：跑的是**生产代码里的同一份检索实现**（js/domain/retrieval.js），
 * 不是另写一份模拟。所以这里的通过率就是线上真实行为。
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

  var C = { data: null, results: null };

  /* 用例集来自共享领域层（js/domain/cases.js），
     与后端 /api/selftest 跑的是同一份，不会出现两处数字不一致 */
  function cases() {
    if (DZHT.domain.cases) return DZHT.domain.cases;
    return { ANSWER: [], REFUSE: [] };
  }

  function init(data) {
    C.data = data;
    C.el = {
      summary: $("test-summary"),
      bar: $("test-bar"),
      answerN: $("test-answer-n"),
      refuseN: $("test-refuse-n"),
      failN: $("test-fail-n"),
      list: $("test-list"),
      threshold: $("test-threshold"),
      run: $("btn-run-test")
    };
  }

  /* 跑一遍全部用例 —— 用的是生产检索实现 */
  function runAll() {
    var R = DZHT.domain.retrieval;
    var corpus = C.data.corpus;
    var CS = cases();
    var results = [];

    CS.ANSWER.forEach(function (q) {
      // 应答类：不限点位（问题里自带点位信息），看是否命中
      var t = R.retrieveWithTrace(q, { corpus: corpus });
      results.push({
        q: q, kind: "answer", expect: "命中", pass: t.hit,
        detail: t.hit ? (t.docs[0].id + " " + t.docs[0].title + " · " + t.reason) : t.reason
      });
    });

    CS.REFUSE.forEach(function (q) {
      var t = R.retrieveWithTrace(q, { corpus: corpus });
      results.push({
        q: q, kind: "refuse", expect: "拒答", pass: !t.hit,
        detail: t.hit ? ("误命中 " + t.docs[0].id + " " + t.docs[0].title) : t.reason
      });
    });

    C.results = results;
    render();
    return results;
  }

  function render() {
    var res = C.results || [];
    var pass = res.filter(function (r) { return r.pass; }).length;
    var fail = res.length - pass;
    var ansPass = res.filter(function (r) { return r.kind === "answer" && r.pass; }).length;
    var refPass = res.filter(function (r) { return r.kind === "refuse" && r.pass; }).length;
    var pct = res.length ? Math.round(pass / res.length * 100) : 0;

    C.el.summary.innerHTML =
      '<div class="ts-big' + (fail ? " fail" : "") + '">' + pass + " / " + res.length + '</div>' +
      '<div class="ts-label">' + (fail ? "有 " + fail + " 项未通过" : "全部通过") + '</div>' +
      '<div class="ts-desc">共 34 项验收用例：20 项应答类（语料覆盖范围内的问题必须命中正确条目）＋ 14 项拒答类（超纲、涉评价、景区服务类必须拒答）。' +
      '这里跑的是生产代码里的同一份检索实现，与线上行为一致。</div>';

    C.el.bar.style.width = pct + "%";
    C.el.bar.style.background = fail
      ? "linear-gradient(90deg,#C0473F,#E07A62)"
      : "linear-gradient(90deg,#1F7A44,#4FB377)";
    C.el.answerN.textContent = ansPass + " / 20";
    C.el.refuseN.textContent = refPass + " / 14";
    C.el.failN.textContent = fail;
    C.el.threshold.textContent = "命中阈值 " + DZHT.domain.retrieval.THRESHOLD;

    C.el.list.innerHTML = res.map(function (r) {
      return '<div class="test-item ' + (r.pass ? "pass-ok" : "pass-no") + '">' +
        '<span class="ti-mark">' + (r.pass ? "✓" : "✕") + '</span>' +
        '<div class="grow">' +
          '<div class="ti-q">' + esc(r.q) + '</div>' +
          '<div class="ti-r">' + esc(r.detail) + '</div>' +
        '</div>' +
        '<span class="ti-tag ' + r.kind + '">' + (r.kind === "answer" ? "应答" : "拒答") + '</span>' +
      '</div>';
    }).join("");
  }

  function bind() {
    C.el.run.addEventListener("click", function () {
      runAll();
      DZHT.core.motion.haptic(14);
      DZHT.core.toast("已重跑 " + (C.results ? C.results.length : 34) + " 项验收用例");
    });
  }

  DZHT.views.selftest = {
    init: init,
    bind: bind,
    onEnter: function () {
      if (!C.results) runAll();
      else render();
    }
  };
})(typeof self !== "undefined" ? self : this);
