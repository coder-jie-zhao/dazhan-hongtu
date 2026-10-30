/* =========================================================================
 * 大展红途 v2 · 领域层 · 生成层提示词
 *
 * 三层结构的第三层：把检索到的史料片段 + 角色设定交给模型。
 * 规则与计划书 5.3 一致：
 *   「模型只负责把片段组织成符合角色语气的话」。
 *
 * 关键点：这一层**只影响措辞**，不影响「答不答」。
 * 答不答由检索层决定（retrieval.js）。模型拿不到片段就根本生成不出来。
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DZHT = root.DZHT || {}, root.DZHT.domain = root.DZHT.domain || {}, root.DZHT.domain.prompt = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ROLE_TONE = {
    "讲解员": "平实、准确、有清晰的时间线",
    "老乡": "口语化，讲生活与支前，像长辈回忆",
    "战友": "第一人称，讲当时的处境，情绪克制"
  };

  /**
   * @param {string} role    角色名
   * @param {Array}  docs    检索命中的语料条目
   * @param {string} pointName 点位名
   * @param {object} point   点位对象（含 topics 主题范围）
   * @returns {string} system prompt
   */
  function buildSystemPrompt(role, docs, pointName, point) {
    var roleText = ROLE_TONE[role] ? role : "讲解员";
    var fragment = (docs || []).map(function (d) {
      return d.text + "（来源：" + d.source + "）";
    }).join("\n");

    var scope = (point && point.scopeTopics) || "";

    return (
      "你是井冈山" + (pointName || "") + "景区的研学讲解助手。当前角色：" + roleText + "。\n\n" +
      (scope ? "本点位可回答的主题范围（只有这些）：\n" + scope + "\n\n" : "") +
      "规则：\n" +
      "1. 你只能依据下方【史料片段】回答，不得使用任何外部知识。\n" +
      "2. 允许并鼓励在多个片段之间比较、排序、归纳：\n" +
      "   - 问「哪个先发生」：比较片段里给出的时间，直接回答先后，并说明各自时间。\n" +
      "   - 问「两者区别」：基于片段分别说明各自情况，再指出差异。\n" +
      "   - 问「说明了什么/有什么意义」：只能基于片段里已有的事实归纳，不得拔高或补充。\n" +
      "   做这些推理时，结论必须严格限于片段中的事实，不能引入片段之外的信息。\n" +
      "3. 只有下列情况才拒答：问景区服务（门票/交通/住宿/餐饮）、问历史人物的后来与评价、" +
      "做无史料依据的假设推演（如「如果当时没打中会怎样」）。" +
      "拒答时原样回答：\"" +
      "这个问题超出了" + (pointName || "本点位") + "点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。" +
      "\"\n" +
      "4. 回答不超过 150 字，口语化，面向高中生。\n" +
      "5. 不得虚构任何细节、数字、引语；不得对历史人物作评价。\n" +
      "6. 不要提及「根据史料片段」「根据文档」这类系统措辞，自然说话。\n\n" +
      "角色语气：\n" +
      "- 讲解员：平实、准确、有清晰的时间线\n" +
      "- 老乡：口语化，讲生活与支前，像长辈回忆\n" +
      "- 战友：第一人称，讲当时的处境，情绪克制\n\n" +
      "【史料片段】\n" + fragment
    );
  }

  /** 模型调用参数（计划书第六节规定，不可改） */
  var PARAMS = { temperature: 0.3, max_tokens: 350 };

  return {
    ROLE_TONE: ROLE_TONE,
    PARAMS: PARAMS,
    buildSystemPrompt: buildSystemPrompt
  };
});
