/* =========================================================================
 * 大展红途 v2 · 视图 · 研学报告
 *
 * 关键修正（对齐计划书 2.6）：
 *   评语由**模板拼接**，槽位引用学生自己写的理由与自述，不调模型。
 *   v1 的 api/comment.js 真的调了 LLM，与计划书自相矛盾，这版删除该行为。
 *
 * 另外：分数旁边写清每项的得分明细，任何人重算都得到同一份结果。
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

  var C = { data: null, point: null };

  function init(data) {
    C.data = data;
    C.el = {
      point: $("rpt-point"),
      date: $("rpt-date"),
      name: $("rpt-name"),
      school: $("rpt-school"),
      meta: $("rpt-meta"),
      bars: $("rpt-bars"),
      questions: $("rpt-questions"),
      thought: $("rpt-thought"),
      comment: $("rpt-comment"),
      no: $("rpt-no"),
      formula: $("rpt-formula"),
      card: $("report-card")
    };
  }

  function currentPoint() {
    var p = DZHT.views.point.point();
    return p || C.data.points[0];
  }

  function reportNo(user) {
    // 报告编号：由姓名与点位派生，同一个人同一个点位编号稳定
    var s = (user && user.name ? user.name : "同学") + "|" + currentPoint().id;
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return "DZHT-2026-" + String(h % 10000).padStart(4, "0");
  }

  function render() {
    var store = DZHT.core.store;
    var user = store.getUser() || { name: "同学", school: "—" };
    var p = currentPoint();
    C.point = p;
    var prog = store.getProgress(p.id);

    var sc = DZHT.domain.scoring.compute({
      tasks: prog.tasks || {},
      choiceCorrect: prog.choiceCorrect,
      orderCorrect: prog.orderCorrect,
      questions: prog.questions || [],
      enterTime: prog.enterTime,
      selfText: prog.selfText || ""
    });

    var now = new Date();
    var dateStr = now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0");

    C.el.point.textContent = p.name;
    C.el.date.textContent = dateStr;
    C.el.name.textContent = user.name || "同学";
    C.el.school.textContent = user.school || "—";
    C.el.no.textContent = "编号 " + reportNo(user);

    // 学习轨迹
    var taskDone = Object.keys(prog.tasks || {}).filter(function (k) { return prog.tasks[k]; }).length;
    var plan = DZHT.views.task.plan();
    var totalTasks = plan ? plan.items.length : 3;
    C.el.meta.innerHTML =
      '<span class="rpt-meta-item">停留 <b>' + sc.stayMin + ' 分钟</b></span>' +
      '<span class="rpt-meta-item">提问 <b>' + sc.askCount + ' 次</b></span>' +
      '<span class="rpt-meta-item">完成 <b>' + taskDone + '/' + totalTasks + ' 项任务</b></span>' +
      '<span class="rpt-meta-item">点位 <b>' + esc(p.name) + '</b></span>';

    // 能力评估（带明细）
    C.el.bars.innerHTML = sc.items.map(function (it) {
      return '<div class="rpt-bar-row">' +
        '<div class="rpt-bar-top"><span class="rpt-bar-label">' + esc(it.label) + '</span>' +
        '<span class="rpt-bar-num" data-num="' + it.key + '">0</span></div>' +
        '<span class="rpt-bar-track"><span class="rpt-bar-fill" id="bar-' + it.key + '"></span></span>' +
        '<div class="rpt-bar-detail">' + esc(it.detail) + '</div>' +
      '</div>';
    }).join("");

    // 提问记录（原样照录，不筛选）
    var qs = (prog.questions || []).slice(-4);
    C.el.questions.innerHTML = qs.length
      ? qs.map(function (q) { return "<li>" + esc(q) + "</li>"; }).join("")
      : '<li class="rpt-empty">本次没有提问</li>';

    // 我的思考：优先用自述，没有则用理由
    var thought = (prog.selfText || "").trim() || (prog.reason || "").trim();
    C.el.thought.textContent = thought ? "「" + thought + "」" : "（未填写）";

    // 评语：模板拼接，不调模型
    C.el.comment.textContent = DZHT.domain.scoring.buildComment({
      questions: prog.questions || [],
      reason: prog.reason || "",
      selfText: prog.selfText || ""
    }, p.name);

    // 评分规则说明
    C.el.formula.innerHTML =
      DZHT.domain.scoring.FORMULAS.map(function (f) {
        return "<b>" + esc(f.label) + "</b> = " + esc(f.rule);
      }).join("<br />") +
      "<br /><br />" + esc(C.data.scoring.note);

    // 动画：条形 + 数字
    requestAnimationFrame(function () {
      sc.items.forEach(function (it) {
        var bar = $("bar-" + it.key);
        if (bar) bar.style.width = it.value + "%";
        DZHT.core.motion.countTo(C.el.bars.querySelector('[data-num="' + it.key + '"]'), it.value, { duration: 850 });
      });
    });
  }

  function bind() {
    $("btn-save").addEventListener("click", function () { saveImage(); });
    $("btn-to-teacher").addEventListener("click", function () { DZHT.core.router.go("teacher"); });
    $("btn-share-report").addEventListener("click", function () {
      DZHT.core.toast ? DZHT.core.toast("长按下方图片即可保存并分享") : alert("长按下方图片即可保存并分享");
    });
  }

  function saveImage() {
    if (typeof root.html2canvas === "undefined") {
      DZHT.core.toast("当前离线，请用系统截图保存报告");
      return;
    }
    root.html2canvas(C.el.card, { scale: 2, backgroundColor: "#FFFEFB", useCORS: true })
      .then(function (canvas) {
        $("save-img").src = canvas.toDataURL("image/png");
        $("save-modal").classList.add("show");
      })
      .catch(function () { DZHT.core.toast("生成图片失败，请用系统截图保存"); });
  }

  DZHT.views.report = {
    init: init,
    bind: bind,
    onEnter: function () { render(); }
  };
})(typeof self !== "undefined" ? self : this);
