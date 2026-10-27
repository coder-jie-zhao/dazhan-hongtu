// =========================================================================
// Vercel Serverless Function：生成研学报告评语（需求书第五节：只有 80 字评语用 AI）
// body: { name, questions: string[], reason: string }
// 环境变量：LLM_API_KEY、LLM_BASE_URL（可选）、LLM_MODEL（可选）
// =========================================================================

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

  if (!process.env.LLM_API_KEY) {
    res.status(503).json({ error: "LLM_API_KEY not configured" });
    return;
  }

  const body = req.body || {};
  const name = body.name || "同学";
  const questions = (body.questions || []).slice(-3).join("；") || "（无记录）";
  const reason = (body.reason || "").slice(0, 40) || "（无记录）";

  const system =
    "你是研学报告的评语撰写者，为一位参加井冈山黄洋界研学的学生写一段评语。语气真诚、有针对性，肯定探究精神，点出与历史思考相关的亮点。";
  const user =
    "学生：" + name + "。\n" +
    "他问过的问题：" + questions + "。\n" +
    "任务二（红军为何能守住黄洋界）他写的理由：" + reason + "。\n" +
    "请写一段 80 字左右的评语，只输出评语本身，不要加引号。";

  try {
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
        temperature: 0.7,
        max_tokens: 200,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });
    if (!resp.ok) throw new Error("LLM HTTP " + resp.status);
    const data = await resp.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    res.status(200).json({ comment: msg ? String(msg.content || "").trim() : "" });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
