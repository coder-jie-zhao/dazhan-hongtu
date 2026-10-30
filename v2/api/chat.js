// =========================================================================
// Vercel Serverless Function：AI 中转 + 服务端史料锚定检索（v2）
// 部署后访问：POST /api/chat   body: { question, role, point }
// 环境变量：LLM_API_KEY（必填）、LLM_BASE_URL（可选）、LLM_MODEL（可选）
//
// v2 的关键改动：
//   1. 检索算法不再写第二遍 —— 直接 require 前端同款 js/domain/retrieval.js。
//      v1 的 api/chat.js 与 app.js 各有一份检索，阈值还不同（0.42 / 0.15），
//      导致「同一个问题离线能答、在线拒答」。现在只有一份实现、一个阈值。
//   2. 无模型 key 时不再返回 503，而是降级为「史料直出」：检索到的原文直接返回，
//      仍然标来源、仍然拒答超纲问题。现场断网/无 key 时也能演完整流程。
// =========================================================================

const corpus = require("../data/corpus.json");
const R = require("../js/domain/retrieval.js");
const P = require("../js/domain/prompt.js");

const POINT_NAMES = {
  huangyangjie: "黄洋界哨口",
  bajiaolou: "八角楼毛泽东同志旧居",
  longjiangshuyuan: "龙江书院"
};

const POINT_SCOPE = {
  huangyangjie:
    "黄洋界的地理与海拔｜保卫战的时间·兵力·经过｜胜利原因与五道工事｜胜利纪念碑｜" +
    "《西江月·井冈山》的词句与创作背景｜挑粮小道与朱德的扁担｜井冈山时期的粮食与物资困难｜" +
    "群众支前｜红军医院｜井冈山精神｜井冈山革命博物馆",
  bajiaolou:
    "八角楼的建筑形制与由来｜一根灯芯与节约用油｜《中国的红色政权为什么能够存在？》与《井冈山的斗争》｜" +
    "工农武装割据思想｜旧居原物与红军标语｜茅坪与茨坪旧址群｜红军军械处与那门迫击炮｜" +
    "公卖处与物资封锁｜红军官兵的伙食",
  longjiangshuyuan:
    "龙江书院的建造年代与规模｜井冈山会师的时间与经过｜红四军的成立｜红四军党的第一次代表大会｜" +
    "军官教导队与明道堂｜红四军军部旧址｜井冈山会师纪念碑｜井冈山根据地的创建"
};

function pickRefusal(point) {
  const pointName = POINT_NAMES[point] || "本点位";
  const qa = corpus.offlineQA && corpus.offlineQA[point];
  const suggestions = (qa || []).slice(0, 2).map((x) => x.q);
  return R.refusalText(pointName, suggestions);
}

async function callLLM(system, user, maxTokens) {
  const baseURL = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const resp = await fetch(baseURL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + process.env.LLM_API_KEY
    },
    body: JSON.stringify({
      model: model,
      temperature: maxTokens ? 0.1 : P.PARAMS.temperature,
      max_tokens: maxTokens || P.PARAMS.max_tokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  if (!resp.ok) throw new Error("LLM HTTP " + resp.status);
  const data = await resp.json();
  const msg = data.choices && data.choices[0] && data.choices[0].message;
  return msg ? String(msg.content || "").trim() : "";
}

/**
 * 把口语提问改写成检索关键词。
 *
 * 为什么需要这一步：
 * 纯关键词检索的死穴是同义不同词 —— 学生问「那时候山上的人靠什么填肚子」，
 * 语料里写的是「粮食」「红米饭、南瓜汤」，字面匹配不上就直接拒答了。
 * 模型能听懂「填肚子」就是「吃饭」，把它改写成语料里的说法再检索，就命中了。
 *
 * 只在与检索都失败时调用，正常提问不会多花这一次请求。
 */
async function rewriteQuery(question, pointName) {
  const system =
    "你是红色研学导览系统的检索助手。把用户的口语提问改写成 3–6 个检索关键词，" +
    "用空格分隔。要求：\n" +
    "1. 只输出关键词本身，不要任何解释、标点、引号、前后缀。\n" +
    "2. 关键词要贴近史料用语（例如「填肚子」→「粮食 吃饭 伙食」；" +
    "「碰面」→「会师 会见」；「守着山口」→「哨口 地形 以少胜多」）。\n" +
    "3. 如果问题涉及时间、地点、人物、数字，保留这些要素。\n" +
    "4. 如果问题与「" + (pointName || "本点位") + "」的史料无关，只输出：无关";
  const user = "问题：" + question + "\n关键词：";
  const out = await callLLM(system, user, 40);
  return String(out)
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

  const body = req.body || {};
  const question = String(body.question || "").trim();
  const role = body.role || "讲解员";
  const point = body.point || "huangyangjie";
  if (!question) { res.status(400).json({ error: "question required" }); return; }

  const hasKey = !!process.env.LLM_API_KEY;
  const pointName = POINT_NAMES[point] || "本点位";

  // ---- 服务端检索（与前端同一份实现、同一阈值）----
  // 有模型时放行「需要推理」的问题（哪个先发生 / 如果…会怎样 / 两者区别），
  // 这类问题本地检索答不了，但模型能在多条史料间比较推演。
  // 没有模型时仍在检索层拒答——硬答会答非所问，比拒答更糟。
  let tops = R.retrieve(question, {
    corpus: corpus.corpus,
    point: point,
    topN: 2,
    allowReasoning: hasKey
  });

  // ---- 检索失败时，先用模型做一次「查询改写」再试 ----
  //
  // 这一步解决的是同义不同词：学生问「那时候山上的人靠什么填肚子」，
  // 语料里是「粮食」「红米饭南瓜汤」，字面匹配不上就会拒答。
  // 让模型把它改写成史料用语（粮食 吃饭 伙食）再检索，多数能命中。
  //
  // 只在失败时触发，正常提问不会多这一次请求、也不会多这段延迟。
  let rewritten = null;
  if (!tops && hasKey) {
    try {
      rewritten = await rewriteQuery(question, pointName);
      if (rewritten && rewritten !== "无关") {
        tops = R.retrieve(rewritten, {
          corpus: corpus.corpus,
          point: point,
          topN: 2,
          allowReasoning: true,
          // 改写串是我们自己生成的检索词，跳过域外检查，
          // 否则「粮食 吃饭 伙食…」会因为含「吃饭」被判成景区服务问题
          skipDomainCheck: true
        });
      }
    } catch (e) {
      // 改写失败不影响主流程：继续走拒答即可
      rewritten = null;
    }
  }

  // 未命中 → 固定拒答话术
  if (!tops) {
    res.status(200).json({
      answer: pickRefusal(point),
      sources: [],
      refusal: true,
      mode: "retrieval"
    });
    return;
  }

  const sources = tops.map((t) => t.source);
  const uniqueSources = [...new Set(sources)];

  // ---- 无模型 key：优先用人工撰写的离线 QA 答案 ----
  //
  // 为什么不是直接返回史料原文？
  // 因为离线 QA 里的答案是人工写的、专门针对典型问法组织的，
  // 比「把史料原文整段贴出来」更像讲解，质量明显更高。
  // 前端 net.localAnswer 用的是同一套逻辑，所以在线/离线行为一致。
  //
  // 注意：这个分支必须限定在「没有 key」的情况。
  // 早期版本漏了这个判断，导致配了 key 也永远走不到模型——
  // 表现为 health 显示 online，但回答 mode 一直是 retrieval-only。
  const qa = (corpus.offlineQA && corpus.offlineQA[point]) || [];
  let best = null, bestScore = 0;
  for (const item of qa) {
    let s = 0;
    if (R.keywordHit(question, item.keywords)) s = 0.6;
    if (!s) {
      const m = R.bigramMatch(question, item.q + " " + (item.keywords || []).join(""));
      if (m.hit >= 2 && m.total) s = m.hit / m.total;
    }
    if (s > bestScore) { bestScore = s; best = item; }
  }
  // 只在无 key 时才走人工答案直出；有 key 时应该交给模型组织措辞
  if (!hasKey && best && !best.refusal) {
    res.status(200).json({
      answer: best.a,
      sources: best.source ? [best.source] : uniqueSources,
      refusal: false,
      mode: "retrieval-only"
    });
    return;
  }

  // ---- 无模型 key 且无匹配 QA：返回史料原文 ----
  // 现场断网或没配 key 时，界面仍能拿到有出处的答案（措辞是史料原文，
  // 不是模型编的），并且仍然对超纲问题拒答。
  if (!hasKey) {
    res.status(200).json({
      answer: tops[0].text,
      sources: uniqueSources,
      refusal: false,
      mode: "retrieval-only"
    });
    return;
  }

  // ---- 真模型生成 ----
  try {
    const system = P.buildSystemPrompt(role, tops, pointName, { scopeTopics: POINT_SCOPE[point] });
    const answer = await callLLM(system, question);
    res.status(200).json({
      answer: answer || pickRefusal(point),
      sources: uniqueSources,
      refusal: false,
      mode: "model",
      // 用了查询改写时回传，便于排查「为什么这个问题能答了」
      rewritten: rewritten || undefined
    });
  } catch (e) {
    // 模型挂了也不能白屏：降级为史料直出
    res.status(200).json({
      answer: best && !best.refusal ? best.a : tops[0].text,
      sources: uniqueSources,
      refusal: false,
      mode: "retrieval-only",
      degraded: String((e && e.message) || e)
    });
  }
}

module.exports = handler;
module.exports.retrieve = R.retrieve;
module.exports.isOutOfDomain = R.isOutOfDomain;
