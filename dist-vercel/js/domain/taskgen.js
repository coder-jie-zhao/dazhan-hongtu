/* =========================================================================
 * 大展红途 v2 · 领域层 · 任务单生成
 *
 * 计划书 1.4 模块二：
 *   「教师出行前通过教师端选择点位与学段，系统按课标要求生成任务单
 *     （观察题、思考题、实践题三类）」
 *
 * v1 只有一份写死的 tasks.json，没有「生成」这回事 —— 教师端是死的。
 * v2 让任务单变成**按点位 + 学段动态产出的东西**，教师端才有产品价值。
 *
 * 生成规则是可解释的：每道题都标注它来自哪一类能力、对应哪个学段要求。
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DZHT = root.DZHT || {}, root.DZHT.domain = root.DZHT.domain || {}, root.DZHT.domain.tasks = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* 学段配置：难度递进 + 任务类型偏好 */
  var GRADES = [
    {
      id: "junior",
      name: "初中",
      full: "初中（7–9 年级）",
      desc: "看得见、说得出的基础观察与因果",
      // 四题全做：「说」（写下自述）是计划书 2.1 动线里的固定环节，
      // 也是评分引擎「自我表达」项唯一的数据来源，不能因为学段低就省掉。
      // 学段差异体现在自述字数与题目深度上，不体现在"有没有这道题"。
      taskCount: 4,
      preferTypes: ["photo", "choice", "order", "text"],
      cognitive: ["观察", "理解", "因果"],
      tone: "以现场可见的事实为主，问题短、指令明确",
      // 初中的自述只要求 15 字，高中要求 20 字
      textMinLen: 15
    },
    {
      id: "senior",
      name: "高中",
      full: "高中（10–12 年级）",
      desc: "要求史料互证与观点表达",
      taskCount: 4,
      preferTypes: ["photo", "choice", "order", "text"],
      cognitive: ["史料", "互证", "论证", "评价"],
      tone: "强调史料出处与历史解释，允许并鼓励提出自己的判断",
      textMinLen: 20
    }
  ];

  /* 任务类型 → 三类教学分类（计划书原文：观察题、思考题、实践题） */
  var TYPE_CATEGORY = {
    photo: { category: "观察题", verb: "看" },
    choice: { category: "思考题", verb: "想" },
    order: { category: "实践题", verb: "理" },
    text: { category: "表达题", verb: "说" }
  };

  function gradeById(id) {
    for (var i = 0; i < GRADES.length; i++) if (GRADES[i].id === id) return GRADES[i];
    return GRADES[0];
  }

  /**
   * 为指定点位 + 学段生成一份任务单。
   * @param {object} data      完整语料库 JSON
   * @param {string} pointId   点位 id
   * @param {string} gradeId   学段 id（junior / senior）
   * @returns {{point, grade, items:Array, generatedAt:string}}
   */
  function generate(data, pointId, gradeId) {
    var grade = gradeById(gradeId);
    var point = null;
    var points = data.points || [];
    for (var i = 0; i < points.length; i++) if (points[i].id === pointId) point = points[i];
    if (!point) point = points[0];

    var pool = (data.tasks || []).filter(function (t) {
      return (t.points || []).indexOf(point.id) >= 0;
    });

    var TYPE_ORDER = ["photo", "choice", "order", "text"];

    // 必做题：photo（现场观察）与 text（写下自述）。
    // 这两题分别对应评分引擎的「现场观察」与「自我表达」，
    // 少了任何一项，报告里就会有一格永远拿 0 分，学生看到会困惑。
    // 所以不依赖切片顺序，先固定锁住这两题，再按学段偏好填空。
    var REQUIRED = ["photo", "text"];

    function pickOne(type, from) {
      for (var i = 0; i < from.length; i++) if (from[i].type === type) return from[i];
      return null;
    }

    var chosen = [];
    var rest = pool.slice();

    REQUIRED.forEach(function (type) {
      var t = pickOne(type, rest);
      if (t) {
        chosen.push(t);
        rest = rest.filter(function (x) { return x !== t; });
      }
    });

    // 剩余名额按学段偏好补齐（先看类型偏好，再看看→想→理→说的顺序）
    var remain = Math.max(0, grade.taskCount - chosen.length);
    var filler = rest.slice().sort(function (a, b) {
      var ai = grade.preferTypes.indexOf(a.type);
      var bi = grade.preferTypes.indexOf(b.type);
      if (ai < 0) ai = 99;
      if (bi < 0) bi = 99;
      if (ai !== bi) return ai - bi;
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    }).slice(0, remain);

    chosen = chosen.concat(filler);

    // 最终按「看→想→理→说」的教学顺序排列，不按选取顺序
    chosen.sort(function (a, b) {
      return TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
    });

    var items = chosen.map(function (t, idx) {
      var meta = TYPE_CATEGORY[t.type] || { category: "综合题", verb: "做" };
      // 自述题的字数要求按学段覆盖（初中 15 字、高中 20 字）
      var minLen = t.minLen || 0;
      if (t.type === "text" && grade.textMinLen) minLen = grade.textMinLen;
      var item = {
        id: t.id,
        index: idx,
        type: t.type,
        stage: t.stage || meta.verb,
        category: meta.category,
        title: t.title,
        verb: meta.verb,
        desc: t.desc || "",
        question: t.question || "",
        options: t.options || null,
        answer: typeof t.answer === "number" ? t.answer : null,
        events: t.events || null,
        placeholder: t.placeholder || "",
        minLen: minLen,
        maxLen: t.maxLen || 200,
        reasonMinLen: t.reasonMinLen || 0,
        hint: t.hint || "",
        hintOnWrong: t.hintOnWrong || "",
        rationale: rationale(t, grade, point)
      };
      return item;
    });

    return {
      point: point,
      grade: grade,
      items: items,
      generatedAt: new Date().toISOString()
    };
  }

  /** 每道题都给出「为什么这道题适合这个学段」——教师端要看得懂 */
  function rationale(task, grade, point) {
    var cat = (TYPE_CATEGORY[task.type] || {}).category || "综合题";
    var cognitive = grade.cognitive.join("、");
    if (task.type === "photo") {
      return "「" + cat + "」：不需要任何知识储备，只要在" + point.name + "现场抬头看就能完成。" +
        "这是任务单的第一步，目的是让最没有基础的学生也能拿到第一个完成标记，避免第一步就卡住。";
    }
    if (task.type === "choice") {
      return "「" + cat + "」：考察" + cognitive + "。答对不算完，必须写下理由——理由会进入研学报告，成为过程性记录的一部分。";
    }
    if (task.type === "order") {
      return "「" + cat + "」：训练时间线与因果链。" + point.name + "相关的四个事件按时间排好，为后面的表达打底。";
    }
    if (task.type === "text") {
      return "「" + cat + "」：系统不判对错，只记录长度与内容。" + grade.tone + "。这是学生唯一能完整表达自己判断的位置。";
    }
    return "「" + cat + "」：结合" + point.name + "的现场史料完成。";
  }

  /** 该点位是否有可生成的任务 */
  function availablePoints(data) {
    var pts = data.points || [];
    var tasks = data.tasks || [];
    return pts.map(function (p) {
      var n = tasks.filter(function (t) { return (t.points || []).indexOf(p.id) >= 0; }).length;
      return { id: p.id, name: p.name, taskCount: n, ready: n > 0 };
    });
  }

  return {
    GRADES: GRADES,
    TYPE_CATEGORY: TYPE_CATEGORY,
    gradeById: gradeById,
    generate: generate,
    availablePoints: availablePoints
  };
});
