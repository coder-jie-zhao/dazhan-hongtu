/* =========================================================================
 * 大展红途 v2 · 领域层 · 史料锚定检索
 *
 * 这份文件是**唯一一份**检索实现。前端（离线兜底、检索自测台）和
 * 后端（api/chat.js 真模型调用）都 require/引用它。
 *
 * v1 的问题：检索逻辑在 app.js 和 api/chat.js 各写了一遍，
 * 阈值还不一样（前端 0.15 / 后端 0.42），
 * 结果是同一个问题「离线能答、在线拒答」——评委一问就穿帮。
 *
 * 现在的做法：一份实现，两个消费方，阈值只有一个。
 *
 * 打包方式同时兼容浏览器与 Node：
 *   浏览器 → window.DZHT.domain.retrieval
 *   Node   → module.exports
 * ========================================================================= */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DZHT = root.DZHT || {}, root.DZHT.domain = root.DZHT.domain || {}, root.DZHT.domain.retrieval = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------------------------------------------------------------------
   * 配置
   * ------------------------------------------------------------------- */

  // 命中阈值。v1 后端经 IDF 加权后标定为 0.42，前端仍是旧的 0.15。
  // 现在只有这一个值 —— 在线与离线行为完全一致。
  var THRESHOLD = 0.42;

  // 停用词：检索前剔除
  //
  // 注意：多字词与单字词必须分开处理。v1 的实现把「什么」「怎么」「为什么」
  // 放进一个 Set，然后用 `Set.has(单字)` 过滤 —— 这意味着这些双字词
  // **从未生效**，它们仍留在检索串里污染 bigram。v2 拆成两组：
  //   STOP_MULTI 先按整串剔除，STOP_CHAR 再逐字剔除。
  var STOP_MULTI = ["为什么", "什么", "怎么", "怎样", "如何", "多少", "哪里", "是不是", "有没有"];
  var STOP_CHAR = new Set("的是在和与及都也还又而吗呢吧啊嘛这那个些谁为把被让从对给".split(""));

  // 泛词：几乎每条语料都出现，区分度太低，检索前剔除
  var GENERIC = ["黄洋界", "井冈山", "红军", "井冈", "八角楼", "龙江书院", "毛泽东", "朱德"];

  // 弱区分度词：出现在关键词表里但区分度不足，不参与关键词命中
  var WEAK = ["今天", "现在", "当时", "历史", "故事", "情况", "介绍", "主要", "相关", "内容", "特点", "自己"];

  // 域外问题：景区服务类，不属于史料问答范围，命中即拒答
  var OUT_OF_DOMAIN = [
    "门票", "票价", "价格", "多少钱", "收费", "售票", "开放时间", "几点", "预约",
    "酒店", "住宿", "民宿", "宾馆", "吃饭", "餐厅", "餐馆", "美食", "特产", "纪念品", "商店",
    "天气", "气温", "下雨", "下雪", "停车", "交通", "高铁", "火车", "机票", "怎么去", "怎么走",
    "导航", "电话", "wifi", "厕所", "洗手间", "行李", "寄存", "导游", "拍照收费"
  ];

  // 超纲问题：不是景区服务，但史料里也没有依据，强行答就是编
  var OUT_OF_SCOPE = ["后来", "之后", "结局", "下场", "评价", "你觉得", "你认为", "假如", "如果是你", "为什么他", "为什么她"];

  /* ---------------------------------------------------------------------
   * 需要推理的问题类型
   *
   * 这是本地检索最容易翻车、也最危险的地方：
   * 问「黄洋界保卫战和井冈山会师哪个先发生」，检索会找到「保卫战的时间」
   * 那条史料，然后把时间念一遍 —— 看起来答了，其实没回答「哪个先」。
   *
   * 答非所问比拒答糟糕得多：学生会以为自己得到了答案。
   * 这类问题要么靠模型做跨条目推理，要么老老实实拒答。
   * 没有模型时，拒答是唯一诚实的选择。
   * ------------------------------------------------------------------- */
  var NEEDS_REASONING = [
    { re: /(哪个先|哪一个先|谁先|孰先|哪个早|哪个更早|先后顺序|哪个在前)/, why: "时间先后比较" },
    { re: /(如果|假如|要是|万一|倘若|假设|若不是|要不是)/, why: "假设推演" },
    { re: /(区别|不同点|差异|相比|对比|比起|哪个更|哪个最|更值得)/, why: "对比评价" },
    { re: /(为什么呢|说明了什么|意味着|反映了什么|有什么启示|给我们什么)/, why: "提炼升华" }
  ];

  /**
   * 判断问题是否需要跨史料推理。
   * @returns {string|null} 需要时返回原因，否则 null
   */
  function reasoningReason(query) {
    var n = String(query == null ? "" : query);
    for (var i = 0; i < NEEDS_REASONING.length; i++) {
      if (NEEDS_REASONING[i].re.test(n)) return NEEDS_REASONING[i].why;
    }
    return null;
  }

  /* ---------------------------------------------------------------------
   * 文本归一化
   * ------------------------------------------------------------------- */

  function normalizeRaw(s) {
    return String(s == null ? "" : s).replace(/[^一-龥a-zA-Z0-9]/g, "");
  }

  function normalize(s) {
    var t = String(s == null ? "" : s);
    // 先剔多字停用词（整串匹配）
    for (var i = 0; i < STOP_MULTI.length; i++) t = t.split(STOP_MULTI[i]).join("");
    // 再剔单字停用词
    return t.split("").filter(function (c) { return !STOP_CHAR.has(c); }).join("");
  }

  function stripGeneric(s) {
    var t = String(s == null ? "" : s);
    for (var i = 0; i < GENERIC.length; i++) t = t.split(GENERIC[i]).join("");
    return t;
  }

  /**
   * 生成用于匹配的若干候选串。
   *
   * 为什么要候选而不是一条：
   * GENERIC 里包含点位名（黄洋界 / 八角楼 / 龙江书院）。这在跨点位检索时是对的
   * ——「黄洋界」到处都是，不该主导打分。但在单点位检索时就过度了：
   * 问「八角楼为什么叫八角楼」，剔除点位名后只剩一个「叫」字，
   * bigram 通道完全失效，分数卡在 0.405 差一点被拒答。
   *
   * 做法：优先用剔除泛词的版本；如果剔除后短到无法生成 bigram（< 2 字），
   * 回退到只去停用词、不剔泛词的版本。两条候选都参与匹配，取较高分。
   */
  function prepCandidates(s) {
    var stripped = prep(s);
    var full = normalize(s);
    var out = [stripped];
    if (stripped !== full && stripped.length < 2) out.push(full);
    return out;
  }

  function prep(s) { return normalize(stripGeneric(s)); }

  function bigrams(s) {
    var out = [];
    for (var i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  }

  /**
   * 二元组重合度。query 与 text 都可能有多个候选串（见 prepCandidates），
   * 取所有组合里比例最高的一组。
   * @returns {{hit:number, total:number, ratio:number}}
   */
  function bigramMatch(query, text) {
    var qCands = prepCandidates(query);
    var tCands = prepCandidates(text);
    var best = { hit: 0, total: 0, ratio: 0 };

    for (var i = 0; i < qCands.length; i++) {
      var qb = bigrams(qCands[i]);
      if (!qb.length) continue;
      for (var j = 0; j < tCands.length; j++) {
        var tb = new Set(bigrams(tCands[j]));
        var hit = 0;
        for (var k = 0; k < qb.length; k++) if (tb.has(qb[k])) hit++;
        var ratio = hit / qb.length;
        if (ratio > best.ratio) best = { hit: hit, total: qb.length, ratio: ratio };
      }
    }
    return best;
  }

  function keywordHit(query, keywords) {
    var nq = normalizeRaw(query);
    var list = keywords || [];
    for (var i = 0; i < list.length; i++) {
      var nk = normalizeRaw(list[i]);
      if (!nk || nk.length < 2 || GENERIC.indexOf(nk) >= 0) continue;
      if (nq.indexOf(nk) >= 0) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------------
   * IDF 加权
   * 「朱德」同时出现在纪念碑与挑粮两条语料里，加权后
   * 「朱德+挑粮」的组合会稳定胜过只有「朱德」的纪念碑条目。
   * ------------------------------------------------------------------- */

  var DF = Object.create(null);
  var DOC_COUNT = 0;
  var _docs = [];

  function indexDocs(docs) {
    _docs = docs.slice();
    DOC_COUNT = docs.length;
    DF = Object.create(null);
    for (var i = 0; i < docs.length; i++) {
      var ks = new Set(docs[i].keywords || []);
      ks.forEach(function (k) {
        var nk = normalizeRaw(k);
        if (nk) DF[nk] = (DF[nk] || 0) + 1;
      });
    }
  }

  function idf(k) { return Math.log((DOC_COUNT + 1) / ((DF[k] || 0) + 0.5)); }

  /* ---------------------------------------------------------------------
   * 检索主流程
   * ------------------------------------------------------------------- */

  function isOutOfDomain(query) {
    var n = normalizeRaw(query);
    for (var i = 0; i < OUT_OF_DOMAIN.length; i++) if (n.indexOf(OUT_OF_DOMAIN[i]) >= 0) return true;
    for (var j = 0; j < OUT_OF_SCOPE.length; j++) if (n.indexOf(OUT_OF_SCOPE[j]) >= 0) return true;
    return false;
  }

  function kwScore(query, keywords) {
    var nq = normalizeRaw(query);
    var sum = 0;
    var hits = [];
    var list = keywords || [];
    for (var i = 0; i < list.length; i++) {
      var nk = normalizeRaw(list[i]);
      if (!nk || nk.length < 2 || GENERIC.indexOf(nk) >= 0 || WEAK.indexOf(nk) >= 0) continue;
      if (nq.indexOf(nk) >= 0) { sum += idf(nk); hits.push(nk); }
    }
    return { score: Math.min(sum / 3.2, 1), hits: hits };
  }

  /**
   * 检索一条语料库。
   * @param {string} query 用户问题
   * @param {object} opts  { point, corpus, threshold, topN, allowReasoning, skipDomainCheck }
   *   allowReasoning：是否放行「需要跨史料推理」的问题。
   *     false（默认，离线模式用）：推理类问题直接拒答——本地做不了，硬答会答非所问。
   *     true（有模型时）：正常检索，把史料交给模型做比较与推演。
   *   skipDomainCheck：跳过「景区服务类问题」检查。
   *     用于模型改写出来的关键词串 —— 那是我们自己生成的检索词，
   *     不是用户原话，不该再按用户问题判断是否越界。
   *     踩过的坑：改写串里带「吃饭」，被 OUT_OF_DOMAIN 的「吃饭」误判，
   *     导致「红军靠什么填肚子」明明能查到史料却被拒答。
   * @returns {Array|null} 命中的语料条目数组（已按相关度降序），未命中返回 null
   */
  function retrieve(query, opts) {
    opts = opts || {};
    var corpus = opts.corpus || [];
    var threshold = typeof opts.threshold === "number" ? opts.threshold : THRESHOLD;
    var point = opts.point || null;
    var topN = opts.topN || 2;
    var allowReasoning = opts.allowReasoning === true;
    var skipDomainCheck = opts.skipDomainCheck === true;

    if (!query || !String(query).trim()) return null;
    if (!skipDomainCheck && isOutOfDomain(query)) return null;
    // 需要跨史料推理的问题：没有模型就答不了，硬答会答非所问
    if (!allowReasoning && reasoningReason(query)) return null;

    var docs = corpus.filter(function (c) {
      return c.audit === "approved" && (!point || !c.point || c.point === point);
    });
    if (!docs.length) return null;

    indexDocs(docs);

    var scored = docs.map(function (c) {
      var kws = kwScore(query, c.keywords);
      var m = bigramMatch(query, c.text + " " + c.title + " " + (c.keywords || []).join(""));
      // 纯 bigram 命中要求至少 2 个二元组重合，避免「纪念品/纪念碑」这类单字面重合误判
      var bg = (m.hit >= 2 && m.total) ? m.hit / m.total : 0;
      return { doc: c, score: 0.65 * kws.score + 0.35 * bg, kwHits: kws.hits };
    }).sort(function (a, b) { return b.score - a.score; });

    if (!scored.length || scored[0].score < threshold) return null;

    var out = [];
    for (var i = 0; i < scored.length && out.length < topN; i++) {
      // 第二条也要单独过阈值，否则不塞给模型，避免无关片段污染生成
      if (i === 0 || scored[i].score >= threshold) {
        out.push(scored[i].doc);
        out[out.length - 1].__score = scored[i].score;
        out[out.length - 1].__kwHits = scored[i].kwHits;
      }
    }
    return out;
  }

  /**
   * 带诊断信息的检索：给「检索自测台」用。
   * @returns {{hit:boolean, docs:Array, reason:string, score:number}}
   */
  function retrieveWithTrace(query, opts) {
    opts = opts || {};
    var corpus = opts.corpus || [];
    var threshold = typeof opts.threshold === "number" ? opts.threshold : THRESHOLD;
    var point = opts.point || null;

    var q = String(query == null ? "" : query).trim();
    if (!q) return { hit: false, docs: [], reason: "空问题", score: 0 };

    if (isOutOfDomain(q)) {
      var n = normalizeRaw(q);
      var why = "";
      for (var i = 0; i < OUT_OF_DOMAIN.length; i++) {
        if (n.indexOf(OUT_OF_DOMAIN[i]) >= 0) { why = "域外词「" + OUT_OF_DOMAIN[i] + "」"; break; }
      }
      if (!why) {
        for (var j = 0; j < OUT_OF_SCOPE.length; j++) {
          if (n.indexOf(OUT_OF_SCOPE[j]) >= 0) { why = "超纲词「" + OUT_OF_SCOPE[j] + "」"; break; }
        }
      }
      return { hit: false, docs: [], reason: why || "域外问题", score: 0 };
    }

    // 推理类问题：不是「没查到」，而是「查到了也答不对」，要区分开
    var whyReason = reasoningReason(q);
    if (whyReason) {
      return { hit: false, docs: [], reason: "需要" + whyReason + "（超出单条史料的回答能力）", score: 0 };
    }

    var docs = corpus.filter(function (c) {
      return c.audit === "approved" && (!point || !c.point || c.point === point);
    });
    if (!docs.length) return { hit: false, docs: [], reason: "该点位无已审核语料", score: 0 };

    indexDocs(docs);

    var scored = docs.map(function (c) {
      var kws = kwScore(q, c.keywords);
      var m = bigramMatch(q, c.text + " " + c.title + " " + (c.keywords || []).join(""));
      var bg = (m.hit >= 2 && m.total) ? m.hit / m.total : 0;
      return { doc: c, score: 0.65 * kws.score + 0.35 * bg, kwHits: kws.hits, bgHits: m.hit };
    }).sort(function (a, b) { return b.score - a.score; });

    var top = scored[0];
    if (!top || top.score < threshold) {
      return {
        hit: false,
        docs: scored.slice(0, 3).map(function (s) {
          return { id: s.doc.id, title: s.doc.title, score: s.score, point: s.doc.point };
        }),
        reason: "最高分 " + (top ? top.score.toFixed(3) : "0") + " < 阈值 " + threshold,
        score: top ? top.score : 0
      };
    }

    var hits = scored.filter(function (s) { return s.score >= threshold; }).slice(0, 3);
    return {
      hit: true,
      docs: hits.map(function (s) {
        return { id: s.doc.id, title: s.doc.title, score: s.score, point: s.doc.point, source: s.doc.source };
      }),
      reason: "命中 " + hits.length + " 条，最高分 " + top.score.toFixed(3),
      score: top.score
    };
  }

  /**
   * 生成拒答话术（点位相关，措辞统一）
   */
  function refusalText(pointName, suggestions) {
    var base = "这个问题超出了" + (pointName || "本点位") + "点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。";
    if (suggestions && suggestions.length) {
      base += "\n你可以问我：" + suggestions[0] + "／ " + suggestions[1];
    }
    return base;
  }

  return {
    THRESHOLD: THRESHOLD,
    GENERIC: GENERIC,
    OUT_OF_DOMAIN: OUT_OF_DOMAIN,
    OUT_OF_SCOPE: OUT_OF_SCOPE,
    normalizeRaw: normalizeRaw,
    normalize: normalize,
    prep: prep,
    bigrams: bigrams,
    bigramMatch: bigramMatch,
    keywordHit: keywordHit,
    idf: idf,
    isOutOfDomain: isOutOfDomain,
    reasoningReason: reasoningReason,
    prepCandidates: prepCandidates,
    kwScore: kwScore,
    retrieve: retrieve,
    retrieveWithTrace: retrieveWithTrace,
    refusalText: refusalText
  };
});
