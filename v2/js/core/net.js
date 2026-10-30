/* =========================================================================
 * 大展红途 v2 · 核心层 · 网络层
 *
 * 统一处理：超时、错误降级、在线/离线探测。
 *
 * 关键设计（计划书 5.2 弱网要求 + 需求书铁律一「现场网络不可信」）：
 *   · 请求超时 6 秒，超时即降级，绝不让用户对着转圈等
 *   · 每层都有降级路径：在线模型 → 服务端史料检索 → 本地离线兜底
 *   · /api/health 探测结果缓存，避免每次进对话页都打一次
 * ========================================================================= */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var TIMEOUT = 6000;
  var healthCache = null;
  var healthPromise = null;

  function withTimeout(promise, ms, label) {
    return new Promise(function (resolve, reject) {
      var timer = root.setTimeout(function () {
        reject(new Error((label || "请求") + "超时（" + (ms / 1000) + "s）"));
      }, ms);
      promise.then(function (v) { root.clearTimeout(timer); resolve(v); },
        function (e) { root.clearTimeout(timer); reject(e); });
    });
  }

  function postJSON(path, body, opts) {
    opts = opts || {};
    var url = opts.url || path;
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = root.setTimeout(function () { if (ctl) ctl.abort(); }, opts.timeout || TIMEOUT);

    var p = fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl ? ctl.signal : undefined,
      cache: "no-store"
    }).then(function (r) {
      root.clearTimeout(timer);
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });

    return withTimeout(p, (opts.timeout || TIMEOUT) + 500, "接口");
  }

  /**
   * 探测后端状态：在线模型 / 离线兜底 / 无后端。
   * 结果缓存 60 秒。
   */
  function health(force) {
    if (healthCache && !force && Date.now() - healthCache.at < 60000) {
      return Promise.resolve(healthCache.data);
    }
    if (healthPromise) return healthPromise;

    healthPromise = fetch("/api/health", { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("no health");
        return r.json();
      })
      .then(function (d) {
        healthCache = { at: Date.now(), data: d };
        DZHT.core.store.setNet({ mode: d.mode, model: d.model, endpoint: d.endpoint });
        return d;
      })
      .catch(function () {
        var d = { mode: "offline", model: null, endpoint: null };
        healthCache = { at: Date.now(), data: d };
        DZHT.core.store.setNet({ mode: "offline", model: null, endpoint: null });
        return d;
      })
      .finally(function () { healthPromise = null; });

    return healthPromise;
  }

  /**
   * 提问。三级降级：
   *   1. /api/chat 在线（含真模型）
   *   2. /api/chat 但模型未配置 → 服务端只做检索，返回史料直出
   *   3. 整个后端不可用 → 前端本地检索 + 离线语料
   *
   * 纯静态托管（EdgeOne Pages / GitHub Pages / Vercel 静态）时没有 /api/*，
   * 每次提问都先打一次必失败的请求既慢又在控制台刷红字。
   * 所以先看 health 探测结果：已知离线就直接走本地。
   *
   * @returns {Promise<{answer, sources, refusal, mode}>}
   */
  function ask(question, role, point, corpus, offlineQA, offlinePointName, onStage) {
    // 已确认没有后端 → 直接本地作答，不再发必失败的请求
    var knownMode = DZHT.core.store.state.net.mode;
    if (knownMode === "offline") {
      if (onStage) onStage("done");
      return Promise.resolve(localAnswer(question, corpus, offlineQA, offlinePointName, point));
    }

    if (onStage) onStage("connecting");

    return postJSON("/api/chat", { question: question, role: role, point: point })
      .then(function (d) {
        if (onStage) onStage("done");
        return {
          answer: d.answer,
          sources: d.sources || [],
          refusal: !!d.refusal,
          mode: d.mode || (d.sources && d.sources.length ? "retrieval" : "offline")
        };
      })
      .catch(function (err) {
        if (onStage) onStage("fallback");
        // 失败一次就记住：后续提问不再白试后端
        DZHT.core.store.setNet({ mode: "offline", model: null, endpoint: null });
        return localAnswer(question, corpus, offlineQA, offlinePointName, point);
      });
  }

  /**
   * 本地兜底：调用与后端**完全相同**的检索实现（js/domain/retrieval.js），
   * 命中则用离线 QA 库的答案，未命中则拒答。
   *
   * 这一点是 v2 相对 v1 的关键修正：
   * v1 前端用 0.15 阈值 + 简化算法，导致离线能答的问题在线拒答。
   * 现在前后端同一份实现、同一阈值、同一语料 —— 行为必然一致。
   */
  function localAnswer(question, corpus, offlineQA, pointName, point) {
    var R = DZHT.domain.retrieval;
    var docs = R.retrieve(question, { corpus: corpus, point: point });
    if (!docs) {
      return {
        answer: R.refusalText(pointName, (offlineQA && offlineQA.offline) || []),
        sources: [],
        refusal: true,
        mode: "offline"
      };
    }

    // 命中了：先找离线问答库里对应答案（人工撰写，措辞稳定）
    var qa = (offlineQA && offlineQA.qa) || [];
    var best = null, bestScore = 0;
    for (var i = 0; i < qa.length; i++) {
      var s = 0;
      if (R.keywordHit(question, qa[i].keywords)) s = 0.6;
      if (!s) {
        var m = R.bigramMatch(question, qa[i].q + " " + (qa[i].keywords || []).join(""));
        if (m.hit >= 2 && m.total) s = m.hit / m.total;
      }
      if (s > bestScore) { bestScore = s; best = qa[i]; }
    }

    if (best) {
      return {
        answer: best.a,
        sources: best.source ? [best.source] : [docs[0].source],
        refusal: !!best.refusal,
        mode: "offline"
      };
    }

    // 检索命中但离线问答库没有现成措辞 → 用史料原文直出（标注来源），不编造
    return {
      answer: docs[0].text,
      sources: [docs[0].source],
      refusal: false,
      mode: "offline-retrieval"
    };
  }

  DZHT.core.net = {
    postJSON: postJSON,
    health: health,
    ask: ask,
    localAnswer: localAnswer
  };
})(typeof self !== "undefined" ? self : this);
