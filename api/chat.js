// =========================================================================
// Vercel Serverless Function：AI 中转 + 服务端史料检索
// 部署后访问：POST /api/chat   body: { question, role, point }
// 环境变量：LLM_API_KEY（必填）、LLM_BASE_URL（可选，OpenAI 兼容）、LLM_MODEL（可选）
// 语料放在服务端（require 进来），不暴露给前端。
// =========================================================================

const corpus = require("../data/corpus.json");

const THRESHOLD = 0.42; // 检索命中阈值（v2：IDF 加权后重新标定，见 _probe.js 测试结果）
const STOP = new Set("的了是在和与及都也还又而吗呢吧啊嘛怎么什么为什么怎样如何多少哪里这那个些谁为".split(""));
// 每条语料都出现的低信息词：检索前先剔除，避免"黄洋界"这类共享词把超纲问题抬过阈值
const GENERIC = ["黄洋界", "井冈山", "红军", "井冈"];
// 泛词：出现在某条语料的关键词表里，但区分度太低，不参与关键词命中
const WEAK = ["今天", "现在", "当时", "历史", "故事", "情况", "介绍", "主要", "相关", "内容", "特点"];
// 域外问题：景区服务类，不属于史料问答范围。命中即拒答（对应 BP 里"景区服务信息交由导览屏/人工"的边界）
const OUT_OF_DOMAIN = [
  "门票", "票价", "价格", "多少钱", "收费", "售票", "开放时间", "几点", "预约",
  "酒店", "住宿", "民宿", "宾馆", "吃饭", "餐厅", "餐馆", "美食", "特产", "纪念品", "商店",
  "天气", "气温", "下雨", "下雪", "停车", "交通", "高铁", "火车", "机票", "怎么去", "怎么走",
  "导航", "电话", "wifi", "厕所", "洗手间", "行李", "寄存", "导游", "拍照收费"
];
// 超出史料范围的问题类型：不是景区服务，但也答不了（问后事、问评价、问假设）。
// 这类问题史料里没有依据，强行回答就是编，一律拒答。
const OUT_OF_SCOPE = ["后来", "之后", "结局", "下场", "评价", "你觉得", "你认为", "假如", "如果是你", "为什么他", "为什么她"];

const REFUSAL =
  "这个问题超出了黄洋界点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。\n你可以问我：这场仗是怎么打赢的？／ 为什么要挑粮上山？";

/* ---------- 检索：归一化 + bigram + 关键词（可解释，无向量库） ---------- */
function normalizeRaw(s) {
  return String(s || "").replace(/[^一-龥a-zA-Z0-9]/g, ""); // 仅去标点
}
function normalize(s) {
  return normalizeRaw(s).split("").filter((c) => !STOP.has(c)).join(""); // 再去停用词
}
function stripGeneric(s) {
  let t = String(s || "");
  for (const g of GENERIC) t = t.split(g).join("");
  return t;
}
function prep(s) { return normalize(stripGeneric(s)); }
function bigrams(s) {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
// 计算 query 与 text 的二元组重合（返回命中数与查询二元组总数）
function bigramMatch(query, text) {
  const qb = bigrams(prep(query));
  const tb = new Set(bigrams(prep(text)));
  let hit = 0;
  for (const b of qb) if (tb.has(b)) hit++;
  return { hit, total: qb.length };
}
/* IDF：关键词在多少条语料里出现，出现越多区分度越低。
   "朱德"同时出现在「纪念碑（朱德题字）」和「挑粮（朱德挑粮）」两条里，
   加权后「朱德+挑粮」的组合会稳定胜过只有「朱德」的纪念碑条目。 */
const DOCS = corpus.filter((c) => c.audit === "approved");
const DF = Object.create(null);
for (const c of DOCS) {
  for (const k of new Set(c.keywords || [])) {
    const nk = normalizeRaw(k);
    if (nk) DF[nk] = (DF[nk] || 0) + 1;
  }
}
function idf(k) { return Math.log((DOCS.length + 1) / ((DF[k] || 0) + 0.5)); }

function isOutOfDomain(query) {
  const n = normalizeRaw(query);
  return OUT_OF_DOMAIN.some((w) => n.includes(w)) || OUT_OF_SCOPE.some((w) => n.includes(w));
}

// 关键词得分：按 IDF 加权求和后饱和到 [0,1]（v1 用布尔命中直接给 1.0，会让弱关键词压过强语料）
function kwScore(query, keywords) {
  const nq = normalizeRaw(query);
  let sum = 0;
  const hits = [];
  for (const k of (keywords || [])) {
    const nk = normalizeRaw(k);
    if (!nk || nk.length < 2 || GENERIC.includes(nk) || WEAK.includes(nk)) continue;
    if (nq.includes(nk)) { sum += idf(nk); hits.push(nk); }
  }
  return { score: Math.min(sum / 3.2, 1), hits };
}

function retrieve(query) {
  if (isOutOfDomain(query)) return null; // 域外问题直接拒答
  const scored = DOCS
    .map((c) => {
      const kws = kwScore(query, c.keywords);
      const m = bigramMatch(query, c.text + c.title + (c.keywords || []).join(""));
      // 纯 bigram 命中要求至少 2 个二元组重合，避免"纪念品/纪念碑"这类单字面重合误判
      const bg = m.hit >= 2 && m.total ? m.hit / m.total : 0;
      return { c, s: 0.65 * kws.score + 0.35 * bg };
    })
    .sort((a, b) => b.s - a.s);
  if (!scored.length || scored[0].s < THRESHOLD) return null; // 未命中 → 拒答
  // 第二条也要单独过阈值，否则不塞给模型，避免无关片段污染生成
  const second = scored[1] && scored[1].s >= THRESHOLD ? scored[1].c : null;
  return [scored[0].c, second].filter(Boolean);
}

/* ---------- System Prompt（需求书第六节，逐字使用） ---------- */
function buildSystemPrompt(role, top1, top2) {
  const roleText = { 讲解员: "讲解员", 老乡: "老乡", 战友: "战友" }[role] || "讲解员";
  const fragment = [
    top1 ? top1.text + "（来源：" + top1.source + "）" : "",
    top2 ? top2.text + "（来源：" + top2.source + "）" : ""
  ].filter(Boolean).join("\n");

  return (
    "你是井冈山黄洋界景区的研学讲解助手。当前角色：" + roleText + "。\n\n" +
    "本点位可回答的主题范围（只有这些）：\n" +
    "黄洋界的地理与海拔｜保卫战的时间·兵力·经过｜胜利原因与工事｜胜利纪念碑｜" +
    "《西江月·井冈山》的词句与创作背景｜挑粮小道与朱德的扁担｜井冈山时期的粮食与物资困难｜" +
    "群众支前｜红军医院｜八角楼与《中国的红色政权为什么能够存在》｜红军纪律｜井冈山精神｜井冈山革命博物馆\n\n" +
    "规则：\n" +
    "1. 你只能依据下方【史料片段】回答，不得使用任何外部知识。\n" +
    "2. 若【史料片段】不足以回答，或用户问题不属于上面的主题范围（例如问历史人物的后事、" +
    "问对人物的评价、问景区服务信息），必须原样回答：\"" +
    "这个问题超出了黄洋界点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。" +
    "\"\n" +
    "3. 回答不超过 150 字，口语化，面向高中生。\n" +
    "4. 不得虚构任何细节、数字、引语；不得对历史人物作评价。\n" +
    "5. 不要提及\"根据史料片段\"\"根据文档\"这类系统措辞，自然说话。\n\n" +
    "角色语气：\n" +
    "- 讲解员：平实、准确、有清晰的时间线\n" +
    "- 老乡：口语化，讲生活与支前，像长辈回忆\n" +
    "- 战友：第一人称，讲当时的处境，情绪克制\n\n" +
    "【史料片段】\n" + fragment
  );
}

/* ---------- 调用 OpenAI 兼容接口 ---------- */
async function callLLM(system, user) {
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
      temperature: 0.3,
      max_tokens: 350,
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

async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

  const body = req.body || {};
  const question = (body.question || "").trim();
  const role = body.role || "讲解员";
  if (!question) { res.status(400).json({ error: "question required" }); return; }

  // 服务端检索
  const tops = retrieve(question);
  if (!tops) {
    // 未命中 → 固定拒答话术（需求书第五节 / 第六节）
    res.status(200).json({ answer: REFUSAL, sources: [], refusal: true });
    return;
  }

  if (!process.env.LLM_API_KEY) {
    res.status(503).json({ error: "LLM_API_KEY not configured" });
    return;
  }

  try {
    const system = buildSystemPrompt(role, tops[0], tops[1]);
    const answer = await callLLM(system, question);
    res.status(200).json({
      answer: answer || REFUSAL,
      sources: tops.map((t) => t.source),
      refusal: false
    });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};

module.exports = handler;
module.exports.retrieve = retrieve;      // 供 _probe.js 直接测试生产检索逻辑
module.exports.isOutOfDomain = isOutOfDomain;
