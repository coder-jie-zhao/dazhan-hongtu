/* Vercel Serverless Function · 路由 /api/health
 *
 * 前端 js/core/net.js 的 health() 先打这个接口判断「在线模型 / 离线兜底」，
 * 只有返回 mode:"online" 才会继续调用 /api/chat。
 *
 * Vercel 上 /api/chat 函数并不覆盖 /api/health 这个路由（各自独立文件），
 * 所以必须单独建一个 health 函数，否则前端拿到 404 会误判离线、永远走本地检索。
 *
 * 返回结构必须与 v2/server.js 的 /api/health 保持一致（前端只取 mode / model / endpoint）。
 */
const corpus = require("../data/corpus.json");
const R = require("../js/domain/retrieval.js");

module.exports = (req, res) => {
  const hasKey = !!process.env.LLM_API_KEY;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.json({
    mode: hasKey ? "online" : "offline",
    model: hasKey ? (process.env.LLM_MODEL || "gpt-4o-mini") : null,
    endpoint: hasKey
      ? String(process.env.LLM_BASE_URL || "").replace(/^https?:\/\//, "").split("/")[0]
      : null,
    retrieval: "rule-based (corpus anchored)",
    threshold: R.THRESHOLD,
    corpusCount: corpus.corpus.filter((c) => c.audit === "approved").length,
    points: corpus.points.length
  });
};
