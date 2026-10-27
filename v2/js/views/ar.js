/* =========================================================================
 * 大展红途 v2 · 视图 · AR 实景导览（方案设计阶段）
 *
 * 计划书 1.4 明确写：「本模块当前处于方案设计阶段，尚未进入原型」。
 * 所以这里做的是**诚实的占位**：说清楚规划什么、当前进度、为什么这样排期。
 *
 * 为什么不做一个假的 AR 演示？
 * 因为这个项目的核心卖点是「内容准确、可核查」。做一个假的 AR 场景复原，
 * 恰恰是在自己最强调的地方造假。评委问一句「这个场景复原的史料依据是什么」，
 * 就全塌了。留白比造假强。
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

  var SCENES = [
    {
      point: "黄洋界哨口",
      title: "1928 年哨口阵地布置",
      detail: "三个工事互为犄角，前沿五道防线逐层展开。复原场景以史料记载的工事结构与地形为依据，不做全场景三维重建。",
      status: "内容配置待启动",
      progress: 15
    },
    {
      point: "八角楼毛泽东同志旧居",
      title: "油灯下写作的场景",
      detail: "二楼卧室、八角形天窗、一盏只点一根灯芯的油灯与桌面文稿。复原的是空间与陈设，史料依据为旧址原物与官方展陈说明。",
      status: "内容配置待启动",
      progress: 10
    },
    {
      point: "龙江书院",
      title: "明道堂军官教导队场景",
      detail: "中厅明道堂、讲台与学员席位，呈现 1927 年冬第一期工农革命军军官教导队的上课场景。",
      status: "内容配置待启动",
      progress: 5
    }
  ];

  var C = { data: null };

  function init(data) {
    C.data = data;
    C.el = {
      hero: $("ar-hero"),
      list: $("ar-list")
    };
  }

  function render() {
    var p = DZHT.views.point.point() || C.data.points[0];

    C.el.hero.innerHTML =
      '<img src="' + esc(p.hero) + '" alt="" />' +
      '<div class="ar-hero-scan"></div>' +
      '<div class="ar-hero-text">' +
        '<div class="at-title">' + esc(p.name) + '</div>' +
        '<div class="at-sub">AR 场景复原 · 方案设计阶段</div>' +
      '</div>';

    C.el.list.innerHTML = SCENES.map(function (s) {
      return '<div class="ar-item">' +
        '<div class="ar-item-head">' +
          '<span class="ar-item-name">' + esc(s.title) + '</span>' +
          '<span class="badge badge-amber">' + esc(s.status) + '</span>' +
        '</div>' +
        '<div class="ar-item-desc">' + esc(s.detail) + '</div>' +
        '<div class="route-progress mt-2">' +
          '<span class="bar-track"><span class="bar-fill" style="width:' + s.progress + '%;background:linear-gradient(90deg,#A98144,#D8B681)"></span></span>' +
          '<span class="rp-label">内容准备度 ' + s.progress + '%</span>' +
        '</div>' +
      '</div>';
    }).join("");
  }

  DZHT.views.ar = {
    init: init,
    onEnter: render
  };
})(typeof self !== "undefined" ? self : this);
