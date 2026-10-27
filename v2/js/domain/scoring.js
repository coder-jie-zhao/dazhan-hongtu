/* =========================================================================
 * 大展红途 v2 · 领域层 · 评分引擎
 *
 * 计划书 2.6 明确要求：
 *   「能力评估三项分数由固定规则算出……全过程不调用大模型，
 *     以保证评价可复现：同一个学生同一份行为数据，任何时候重算都得到同一份报告。」
 *
 * 所以这一层是纯函数：给定行为数据，输出分数 + 每项的得分明细。
 * 明细要能直接印在报告上——评委一定会问「你这个分怎么算的」。
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DZHT = root.DZHT || {}, root.DZHT.domain = root.DZHT.domain || {}, root.DZHT.domain.scoring = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FORMULAS = [
    { key: "shi", label: "史料理解", max: 100, rule: "任务二单选 60 分 + 排序题 40 分" },
    { key: "probe", label: "主动探究", max: 100, rule: "提问次数 × 15（上限 70）+ 追问奖励 30" },
    { key: "observe", label: "现场观察", max: 100, rule: "拍照任务 70 + 停留满 10 分钟 30" },
    { key: "express", label: "自我表达", max: 100, rule: "写下自述 100 分（只判字数，不判对错）" }
  ];

  /**
   * 计算能力评估分。
   * @param {object} s  { tasks:{id:bool}, choiceCorrect:bool, orderCorrect:bool,
   *                      questions:[], enterTime:number, selfText:string }
   * @param {object} opts { now:number }
   * @returns {{items:Array, total:number, stayMin:number, askCount:number}}
   */
  function compute(s, opts) {
    opts = opts || {};
    var now = opts.now || Date.now();
    s = s || {};

    var tasks = s.tasks || {};
    var choiceCorrect = s.choiceCorrect === true;
    var orderCorrect = s.orderCorrect === true;
    var questions = s.questions || [];
    var askCount = questions.length;
    var stayMin = s.enterTime ? Math.floor((now - s.enterTime) / 60000) : 0;
    var selfText = (s.selfText || "").trim();

    // 史料理解 = 单选 60 + 排序 40
    var shi = (choiceCorrect ? 60 : 0) + (orderCorrect ? 40 : 0);

    // 主动探究 = min(提问次数 × 15, 70) + 追问奖励 30（提问 ≥ 2 次算追问）
    var probe = Math.min(askCount * 15, 70) + (askCount >= 2 ? 30 : 0);
    if (probe > 100) probe = 100;

    // 现场观察 = 拍照 70 + 停留满 10 分钟 30
    var observe = (tasks.photo ? 70 : 0) + (stayMin >= 10 ? 30 : 0);

    // 自我表达 = 写下自述 100（只判字数，不判对错）
    var express = selfText.length >= 20 ? 100 : (selfText.length > 0 ? 50 : 0);

    var items = [
      {
        key: "shi", label: "史料理解", value: shi, max: 100,
        detail: "单选答对 " + (choiceCorrect ? "+60" : "+0") + "，排序答对 " + (orderCorrect ? "+40" : "+0")
      },
      {
        key: "probe", label: "主动探究", value: probe, max: 100,
        detail: "提问 " + askCount + " 次 ×15（上限 70）" + (askCount >= 2 ? "，追问 +30" : "，未达追问")
      },
      {
        key: "observe", label: "现场观察", value: observe, max: 100,
        detail: "完成拍照 " + (tasks.photo ? "+70" : "+0") + "，停留 " + stayMin + " 分钟" + (stayMin >= 10 ? "（满 10 分钟 +30）" : "（未满 10 分钟）")
      },
      {
        key: "express", label: "自我表达", value: express, max: 100,
        detail: selfText.length >= 20 ? "已写下 " + selfText.length + " 字自述" : (selfText.length ? "自述仅 " + selfText.length + " 字" : "未填写自述")
      }
    ];

    return {
      items: items,
      total: items.reduce(function (a, b) { return a + b.value; }, 0),
      stayMin: stayMin,
      askCount: askCount
    };
  }

  /**
   * 评语生成 —— 模板拼接，**不调用模型**。
   *
   * 计划书 2.6 的硬约束原文：
   *   「评语由模板与学生自述拼接，不由模型自由生成。评语中引用的判断句，
   *     全部来自学生自己写的理由与自述，系统只负责组织语序。
   *     AI 给未成年人写评价，在合规上是不该碰的红线。」
   *
   * v1 的 api/comment.js 真的调了 LLM，与计划书自相矛盾 —— 这版删除该行为。
   */
  function buildComment(state, pointName) {
    var qs = (state && state.questions) || [];
    var reason = ((state && state.reason) || "").trim();
    var selfText = ((state && state.selfText) || "").trim();
    var place = pointName || "本点位";
    var last = qs.length ? String(qs[qs.length - 1]).replace(/[？?。！!]$/, "") : "";

    if (!qs.length && !selfText) {
      return "你完成了" + place + "的现场观察与任务，但还没有向讲解助手提出自己的问题，也没有写下想法。" +
        "研学不止于听——下一次不妨带着一个疑问来，比如「红军当时吃什么」「为什么要挑粮上山」。";
    }
    if (!qs.length) {
      return "你在" + place + "留下了自己的思考：" + trimQuote(selfText) + "。" +
        "没有提问并不可怕，敢写下想法就已经是在主动表达。研学不止于听，更在于想清楚。";
    }
    if (!reason && !selfText) {
      return "你围绕「" + last + "」向讲解助手追问，说明你已经在主动寻找答案。" +
        "研学不止于听，更在于问与想——继续保持这份刨根问底的劲头。";
    }
    if (!reason) {
      return "你围绕「" + last + "」追问，又在任务里写下了自己的看法：" + trimQuote(selfText) + "。" +
        "从「听讲」走到「说清」，是研学里最难、也最值钱的一步。";
    }
    return "你围绕「" + last + "」一路追问，并在任务二里写下了自己的解释：" + trimQuote(reason) + "。" +
      "这说明你不只是记住了经过，还在想这场仗为什么能赢——从「听讲」走到「求证」，是研学里最难、也最值钱的一步。";
  }

  function trimQuote(t) {
    var s = String(t || "").trim();
    if (s.length > 60) s = s.slice(0, 60) + "…";
    return "「" + s + "」";
  }

  return {
    FORMULAS: FORMULAS,
    compute: compute,
    buildComment: buildComment
  };
});
