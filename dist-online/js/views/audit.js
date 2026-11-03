/* =========================================================================
 * 大展红途 v2 · 视图 · 内容审核管线
 *
 * 计划书第五章是全篇最大的创新点：「把 AI 不许乱说做成架构约束，
 * 而不是事后检查」。但 v1 的 Demo 里完全看不见这一章 —— 看不见 = 不存在。
 *
 * 这一页把两件事摊开给评委看：
 *   1. 四环节管线是怎么设计的
 *   2. 每一条语料的来源可点开核查（这是「逐点位权威语料库形成积累型壁垒」
 *      唯一的证明方式）
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

  var C = { data: null, filter: "all" };

  function init(data) {
    C.data = data;
    C.el = {
      pipeline: $("audit-pipeline"),
      filters: $("audit-filters"),
      list: $("audit-list"),
      count: $("audit-count")
    };
  }

  function render() {
    // 管线四环节
    C.el.pipeline.innerHTML = C.data.auditPipeline.map(function (s, i) {
      return '<div class="ap-step" data-n="' + s.step + '" style="animation-delay:' + (i * 80) + 'ms">' +
        '<div class="ap-status">' + esc(s.status) + '</div>' +
        '<div class="ap-name">' + esc(s.name) + '</div>' +
        '<div class="ap-detail">' + esc(s.detail) + '</div>' +
      '</div>';
    }).join("");

    // 过滤
    var approved = C.data.corpus.filter(function (c) { return c.audit === "approved"; });
    C.el.count.textContent = approved.length + " 条已审核";

    var filters = [{ id: "all", name: "全部" }];
    C.data.points.forEach(function (p) { filters.push({ id: p.id, name: p.name }); });
    C.el.filters.innerHTML = filters.map(function (f) {
      var n = f.id === "all" ? approved.length
        : approved.filter(function (c) { return c.point === f.id; }).length;
      return '<button class="af-chip' + (f.id === C.filter ? " on" : "") + '" data-f="' + f.id + '">' +
        esc(f.name) + " " + n + '</button>';
    }).join("");

    // 语料列表
    var list = approved.filter(function (c) {
      return C.filter === "all" || c.point === C.filter;
    });
    C.el.list.innerHTML = list.map(function (c) {
      var p = null;
      for (var i = 0; i < C.data.points.length; i++) if (C.data.points[i].id === c.point) p = C.data.points[i];
      return '<div class="audit-item" data-id="' + c.id + '">' +
        '<div class="ai-head">' +
          '<span class="ai-id">' + esc(c.id) + '</span>' +
          '<span class="ai-title">' + esc(c.title) + '</span>' +
        '</div>' +
        '<div class="ai-source">出处：' + esc(c.source) +
          (c.sourceUrl ? ' · <a href="' + esc(c.sourceUrl) + '" target="_blank" rel="noopener">查看原页</a>' : '') +
        '</div>' +
        '<div class="ai-meta">' +
          '<span class="badge badge-gold">' + esc(c.year) + ' 年</span>' +
          '<span class="badge badge-green">' + esc(c.audit === "approved" ? "已审核" : c.audit) + '</span>' +
          (p ? '<span class="badge badge-ink">' + esc(p.name) + '</span>' : '') +
        '</div>' +
        '<div class="ai-kw">' + (c.keywords || []).map(function (k) {
          return '<span>' + esc(k) + '</span>';
        }).join("") + '</div>' +
        '<div class="ai-text">' + esc(c.text) + '</div>' +
      '</div>';
    }).join("");
  }

  function bind() {
    C.el.filters.addEventListener("click", function (e) {
      var c = e.target.closest("[data-f]");
      if (!c) return;
      C.filter = c.getAttribute("data-f");
      render();
      DZHT.core.motion.haptic(8);
    });

    C.el.list.addEventListener("click", function (e) {
      if (e.target.closest("a")) return;
      var item = e.target.closest(".audit-item");
      if (!item) return;
      item.classList.toggle("open");
    });
  }

  DZHT.views.audit = {
    init: init,
    bind: bind,
    onEnter: render
  };
})(typeof self !== "undefined" ? self : this);
