/* Vercel Serverless Function · 路由 /api/chat
 *
 * 薄壳：把 v2/api/chat.js 的 Express 风格 handler 接到 Vercel 的 (req, res)。
 *
 * 为什么能直接复用：
 *   Vercel 的 Node 运行时原生提供 req.body（按 Content-Type 自动解析 JSON）
 *   与 res.status(code).json(obj) —— 正好是 handler 内部用到的全部接口。
 *   所以业务逻辑(api/_lib/handler.js，即 v2/api/chat.js 原样复制)一行不改，
 *   本地/线上/EdgeOne 三处用的是同一份实现。
 *
 * 这一层只做两件事：
 *   1) 畸形 JSON 兜底成 400（Vercel 在请求体非法时，访问 req.body 会抛错，否则会 500）
 *   2) handler 运行期异常兜底成 500，避免函数静默挂死
 */
const handler = require("./_handler.js");

module.exports = async (req, res) => {
  // 触发 Vercel 的 req.body getter；畸形 JSON 会抛错 → 转 400
  try {
    req.body; // eslint-disable-line no-unused-expressions
  } catch (e) {
    if (!res.writableEnded) res.status(400).json({ error: "invalid JSON body" });
    return;
  }
  try {
    await handler(req, res);
  } catch (e) {
    if (!res.writableEnded) {
      res.status(500).json({
        error: "internal error: " + (e && e.message ? e.message : String(e))
      });
    }
  }
};
