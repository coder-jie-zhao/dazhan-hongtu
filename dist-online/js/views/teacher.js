/* =========================================================================
 * 大展红途 v2 · 视图 · 教师端
 *
 * 三处关键修正：
 *   1. 人名换成**匿名编号**（计划书 6.3：系统不采集真实姓名；
 *      编号由前端随机生成并本地留存，与学生自拟代号之间无可逆关系）
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
  var DRAFT_KEY = "dzht_v2_teacher_drafts";

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
      '<button class="tool-card card-tap" data-tool="check">' +
        '<span class="tc-icon">◉</span><div class="tc-title">演示前检查</div>' +
        '<div class="tc-desc">30 秒验三件套</div></button>' +
      '<button class="tool-card card-tap" data-tool="tour">' +
        '<span class="tc-icon">▶</span><div class="tc-title">演示导览</div>' +
        '<div class="tc-desc">走一遍 90 秒闭环</div></button>' +
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

  function draftId() { return (C.point || "huangyangjie") + "|" + C.grade; }

  function loadDraft() {
    try {
      var all = JSON.parse(root.localStorage.getItem(DRAFT_KEY) || "{}");
      return all[draftId()] || { edits: {}, removed: [], added: [] };
    } catch (e) { return { edits: {}, removed: [], added: [] }; }
  }

  function saveDraft(d) {
    try {
      var all = JSON.parse(root.localStorage.getItem(DRAFT_KEY) || "{}");
      all[draftId()] = d;
      root.localStorage.setItem(DRAFT_KEY, JSON.stringify(all));
    } catch (e) { /* file:// 忽略 */ }
  }

  function renderPlan() {
    var pointId = C.point || (DZHT.views.point.point() || {}).id || C.data.points[0].id;
    var plan = DZHT.domain.tasks.generate(C.data, pointId, C.grade);
    var draft = loadDraft();

    // 应用草稿：改题干、删题、加自定义题
    var items = [];
    plan.items.forEach(function (it, i) {
      if (draft.removed.indexOf(String(i)) >= 0) return;
      items.push(Object.assign({}, it, {
        _i: i,
        q: draft.edits[i] != null ? draft.edits[i] : (it.question || it.desc || "")
      }));
    });
    (draft.added || []).forEach(function (t) {
      items.push({ verb: "问", title: t.title || "自定义任务", category: "拓展", q: t.q, rationale: "教师补充" });
    });

    C.el.tgOut.innerHTML =
      '<div class="row-between mb-3">' +
        '<span class="badge badge-gold">' + esc(plan.point.name) + ' · ' + esc(plan.grade.full) + '</span>' +
        '<span class="micro dimmer">' + items.length + ' 题 · 可改</span>' +
      '</div>' +
      items.map(function (it) {
        var i = it._i;
        return '<div class="tg-item" data-idx="' + i + '">' +
          '<div class="tg-item-head">' +
            '<span class="badge">' + esc(it.verb) + '</span>' +
            '<span class="tg-item-title">' + esc(it.title) + '</span>' +
            '<span class="tg-item-edit">' +
              (i != null ? '<button data-edit="' + i + '" title="改题干">改</button>' +
                '<button data-del="' + i + '" title="删除">删</button>' : '<button data-deladd="' + esc(it.title) + '" title="删除">删</button>') +
            '</span>' +
          '</div>' +
          (it.q ? '<div class="tg-item-q">' + esc(it.q) + '</div>' : "") +
          '<div class="tg-item-why">' + esc(it.rationale) + '</div>' +
        '</div>';
      }).join("") +
      '<div class="tg-actions">' +
        '<button class="btn btn-secondary btn-sm" id="tg-add">＋ 加一题</button>' +
        '<button class="btn btn-ghost btn-sm" id="tg-reset">恢复默认</button>' +
        '<button class="btn btn-primary btn-sm" id="tg-export">导出任务单</button>' +
      '</div>' +
      '<div class="privacy-note"><span>✓</span><span>任务单按课标「观察—思考—实践」三类组织；改动只存在本机浏览器，不上传。</span></div>';
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

    // 任务单编辑：改题干 / 删题 / 加题 / 复位 / 导出
    C.el.tgOut.addEventListener("click", function (e) {
      var d = loadDraft();
      var edit = e.target.closest("[data-edit]");
      if (edit) {
        var idx = edit.getAttribute("data-edit");
        var cur = d.edits[idx];
        var val = root.prompt("修改这道题的题干：", cur == null ? (C.el.tgOut.querySelector('[data-idx="' + idx + '"] .tg-item-q') || {}).textContent || "" : cur);
        if (val != null) { d.edits[idx] = val.trim(); saveDraft(d); renderPlan(); }
        return;
      }
      var del = e.target.closest("[data-del]");
      if (del) {
        var di = del.getAttribute("data-del");
        if (d.removed.indexOf(di) < 0) d.removed.push(di);
        saveDraft(d); renderPlan();
        return;
      }
      var delAdd = e.target.closest("[data-deladd]");
      if (delAdd) {
        var title = delAdd.getAttribute("data-deladd");
        d.added = (d.added || []).filter(function (t) { return t.title !== title; });
        saveDraft(d); renderPlan();
        return;
      }
      if (e.target.closest("#tg-add")) {
        var q = root.prompt("输入自定义任务（学生要做什么）：", "");
        if (q && q.trim()) {
          d.added = d.added || [];
          d.added.push({ title: "自定义题" + (d.added.length + 1), q: q.trim() });
          saveDraft(d); renderPlan();
        }
        return;
      }
      if (e.target.closest("#tg-reset")) {
        if (root.confirm("恢复为系统默认任务单？你做的改动会清除。")) {
          saveDraft({ edits: {}, removed: [], added: [] }); renderPlan();
        }
        return;
      }
      if (e.target.closest("#tg-export")) exportPlan();
    });

    C.el.tools.addEventListener("click", function (e) {
      var tool = e.target.closest("[data-tool]");
      if (tool) {
        var kind = tool.getAttribute("data-tool");
        if (kind === "check" && DZHT.core.demo) DZHT.core.demo.check();
        if (kind === "tour" && DZHT.core.demo) DZHT.core.demo.start();
        return;
      }
      var t = e.target.closest("[data-nav]");
      if (!t) return;
      DZHT.core.router.go(t.getAttribute("data-nav"));
    });
  }

  function exportPlan() {
    var pointId = C.point || C.data.points[0].id;
    var plan = DZHT.domain.tasks.generate(C.data, pointId, C.grade);
    var draft = loadDraft();
    var lines = ["大展红途 · 研学任务单", plan.point.name + " · " + plan.grade.full, ""];
    var n = 0;
    plan.items.forEach(function (it, i) {
      if (draft.removed.indexOf(String(i)) >= 0) return;
      n++;
      var q = draft.edits[i] != null ? draft.edits[i] : (it.question || it.desc || "");
      lines.push(n + ". [" + it.verb + "] " + it.title);
      if (q) lines.push("   " + q);
      lines.push("");
    });
    (draft.added || []).forEach(function (t) {
      n++;
      lines.push(n + ". [问] " + t.title);
      lines.push("   " + t.q);
      lines.push("");
    });
    lines.push("—— 教师可打印或复制到班级群 ——");

    var blob = new root.Blob(["\ufeff" + lines.join("\n")], { type: "text/plain;charset=utf-8" });
    var url = root.URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "任务单_" + plan.point.name + "_" + plan.grade.name + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    root.URL.revokeObjectURL(url);
    DZHT.core.toast("任务单已导出");
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
