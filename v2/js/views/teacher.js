/* =========================================================================
 * 大展红途 v2 · 视图 · 教师端
 *
 * 三处关键修正：
 *   1. 人名换成**学校生成的匿名编号**（计划书 6.3 明确要求：系统不采集姓名）
 *   2. 高频疑问列表里也去掉真实姓名相关表述
 *   3. 新增「任务单生成器」—— 计划书 1.4 模块二说的
 *      「教师出行前通过教师端选择点位与学段，系统按课标要求生成任务单」
 *      v1 的教师端是纯展示，v2 变成可操作工具。
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

  var C = { data: null, grade: "junior", point: null, inited: false };

  /* 演示数据：全部使用匿名编号，无真实姓名
     —— 与计划书 6.3「系统不采集学生姓名」一致 */
  var STUDENTS = [
    { id: "JX-2401", school: "东华理工大学", points: "黄洋界哨口", tasks: 4, questions: 5, minutes: 18 },
    { id: "JX-2402", school: "东华理工大学", points: "黄洋界哨口", tasks: 4, questions: 4, minutes: 16 },
    { id: "JX-2403", school: "井冈山中学", points: "八角楼旧居", tasks: 4, questions: 6, minutes: 21 },
    { id: "JX-2404", school: "井冈山中学", points: "八角楼旧居", tasks: 3, questions: 3, minutes: 12 },
    { id: "JX-2405", school: "东华理工大学", points: "龙江书院", tasks: 4, questions: 5, minutes: 15 },
    { id: "JX-2406", school: "赣南师大附中", points: "龙江书院", tasks: 2, questions: 2, minutes: 9 }
  ];

  var HOT = [
    { q: "为什么是黄洋界？", n: 9 },
    { q: "红军当时吃什么？", n: 6 },
    { q: "这场仗怎么打赢的？", n: 5 },
    { q: "朱德为什么挑粮？", n: 3 },
    { q: "为什么只点一根灯芯？", n: 4 }
  ];

  function init(data) {
    C.data = data;
    C.el = {
      stats: $("tch-stats"),
      summary: $("teacher-summary"),
      hot: $("tch-hot"),
      tbody: $("teacher-tbody"),
      export: $("teacher-export"),
      tgGrade: $("tg-grade"),
      tgPoint: $("tg-point"),
      tgOut: $("tg-out"),
      tools: $("teacher-tools")
    };
  }

  function render() {
    var totalQ = STUDENTS.reduce(function (a, s) { return a + s.questions; }, 0);
    var avgMin = (STUDENTS.reduce(function (a, s) { return a + s.minutes; }, 0) / STUDENTS.length).toFixed(1);
    var doneRate = Math.round(STUDENTS.filter(function (s) { return s.tasks >= 3; }).length / STUDENTS.length * 100);
    var pointCount = new Set(STUDENTS.map(function (s) { return s.points; })).size;

    C.el.stats.innerHTML =
      '<div class="tch-stat"><b>' + STUDENTS.length + '</b><span>在册学生</span></div>' +
      '<div class="tch-stat"><b>' + doneRate + '%</b><span>任务完成率</span></div>' +
      '<div class="tch-stat"><b>' + avgMin + '</b><span>平均停留 分</span></div>' +
      '<div class="tch-stat"><b>' + pointCount + '</b><span>覆盖点位</span></div>';

    C.el.summary.innerHTML =
      '<span class="ts-item">完成率 <b>' + doneRate + '%</b></span>' +
      '<span class="ts-item">平均停留 <b>' + avgMin + ' 分钟</b></span>' +
      '<span class="ts-item">共提出 <b>' + totalQ + ' 个问题</b></span>' +
      '<span class="ts-item">高频疑问 <b>为什么是黄洋界</b></span>';

    // 高频疑问
    var max = HOT[0].n;
    C.el.hot.innerHTML = HOT.map(function (h, i) {
      return '<div class="tch-hot-row">' +
        '<span class="tch-hot-q">' + esc(h.q) + '</span>' +
        '<span class="tch-hot-bar"><i data-w="' + Math.round(h.n / max * 100) + '" style="width:0;background:' +
          (i === 0 ? "linear-gradient(90deg,#A62B2E,#D8B681)" : "linear-gradient(90deg,#1B3049,#7C97B4)") +
        '"></i></span>' +
        '<span class="tch-hot-n">' + h.n + '</span>' +
      '</div>';
    }).join("");

    requestAnimationFrame(function () {
      C.el.hot.querySelectorAll("[data-w]").forEach(function (i) {
        i.style.width = i.getAttribute("data-w") + "%";
      });
    });

    // 逐人明细
    C.el.tbody.innerHTML = STUDENTS.map(function (s) {
      return '<tr>' +
        '<td><span class="stu-id">' + esc(s.id) + '</span><span class="stu-sub">' + esc(s.school) + '</span></td>' +
        '<td>' + esc(s.points) + '</td>' +
        '<td>' + s.tasks + '/4</td>' +
        '<td>' + s.questions + '</td>' +
        '<td>' + s.minutes + '分</td>' +
      '</tr>';
    }).join("");

    renderTools();
    renderTaskGen();
  }

  function renderTools() {
    C.el.tools.innerHTML =
      '<button class="tool-card card-tap" data-nav="audit">' +
        '<span class="tc-icon">⌘</span><div class="tc-title">审核管线</div>' +
        '<div class="tc-desc">内容安全架构</div></button>' +
      '<button class="tool-card card-tap" data-nav="selftest">' +
        '<span class="tc-icon">✓</span><div class="tc-title">检索自测</div>' +
        '<div class="tc-desc">34 项验收</div></button>';
  }

  /* ---------- 任务单生成器 ---------- */
  function renderTaskGen() {
    var grades = DZHT.domain.tasks.GRADES;
    C.el.tgGrade.innerHTML = grades.map(function (g) {
      return '<button class="tg-chip' + (g.id === C.grade ? " on" : "") + '" data-grade="' + g.id + '">' + g.name + '</button>';
    }).join("");

    var pts = DZHT.domain.tasks.availablePoints(C.data);
    C.el.tgPoint.innerHTML = pts.map(function (p) {
      return '<button class="tg-chip' + (p.id === C.point ? " on" : "") + '" data-point="' + p.id + '">' + esc(p.name) + '</button>';
    }).join("");

    renderPlan();
  }

  function renderPlan() {
    var pointId = C.point || (DZHT.views.point.point() || {}).id || C.data.points[0].id;
    var plan = DZHT.domain.tasks.generate(C.data, pointId, C.grade);

    C.el.tgOut.innerHTML =
      '<div class="row-between mb-3">' +
        '<span class="badge badge-gold">' + esc(plan.point.name) + ' · ' + esc(plan.grade.full) + '</span>' +
        '<span class="micro dimmer">' + plan.items.length + ' 题 · ' + esc(plan.grade.desc) + '</span>' +
      '</div>' +
      plan.items.map(function (it, i) {
        var q = it.question || it.desc || "";
        return '<div class="tg-item">' +
          '<div class="tg-item-head">' +
            '<span class="badge">' + (i + 1) + ' · ' + esc(it.verb) + '</span>' +
            '<span class="tg-item-title">' + esc(it.title) + '</span>' +
            '<span class="badge badge-ink">' + esc(it.category) + '</span>' +
          '</div>' +
          (q ? '<div class="tg-item-q">' + esc(q) + '</div>' : "") +
          '<div class="tg-item-why">' + esc(it.rationale) + '</div>' +
        '</div>';
      }).join("") +
      '<div class="privacy-note"><span>✓</span><span>任务单按课标「观察—思考—实践」三类组织，生成逻辑对教师完全透明，可按需调整。</span></div>';
  }

  function bind() {
    C.el.tgGrade.addEventListener("click", function (e) {
      var c = e.target.closest("[data-grade]");
      if (!c) return;
      C.grade = c.getAttribute("data-grade");
      C.el.tgGrade.querySelectorAll(".tg-chip").forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-grade") === C.grade);
      });
      renderPlan();
      DZHT.core.motion.haptic(8);
    });

    C.el.tgPoint.addEventListener("click", function (e) {
      var c = e.target.closest("[data-point]");
      if (!c) return;
      C.point = c.getAttribute("data-point");
      C.el.tgPoint.querySelectorAll(".tg-chip").forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-point") === C.point);
      });
      renderPlan();
      DZHT.core.motion.haptic(8);
    });

    C.el.tools.addEventListener("click", function (e) {
      var t = e.target.closest("[data-nav]");
      if (!t) return;
      DZHT.core.router.go(t.getAttribute("data-nav"));
    });
  }

  function exportReport() {
    if (typeof root.html2canvas === "undefined") {
      DZHT.core.toast("当前离线，请用系统截图保存");
      return;
    }
    root.html2canvas(C.el.export, { scale: 2, backgroundColor: "#ffffff", useCORS: true })
      .then(function (canvas) {
        $("save-img").src = canvas.toDataURL("image/png");
        $("save-modal").classList.add("show");
      })
      .catch(function () { DZHT.core.toast("生成图片失败，请用系统截图保存"); });
  }

  DZHT.views.teacher = {
    init: init,
    bind: bind,
    onEnter: function () {
      render();
      $("btn-export").onclick = exportReport;
    }
  };
})(typeof self !== "undefined" ? self : this);
