/* EdgeOne Pages Node 云函数入口 —— 路由 /api/chat
 *
 * 为什么需要这一层：
 *   项目里的 api/chat.js 是「Express 风格」的 handler(req, res)，
 *   而 EdgeOne 要求 onRequestPost(context) 返回标准 Response。
 *   两者形状不一样，但业务逻辑没必要重写——直接把它 require 进来，
 *   这边只做「请求形状转换」和「响应形状转换」。
 *
 *   好处：检索、拒答、查询改写、跨点位取材这些逻辑，与本地版是同一份代码。
 *   一份实现、一个阈值、一套语料，线上线下行为一致（这也是项目一开始的约定）。
 *
 * 部署位置：cloud-functions/api/chat.js  →  对外路由 /api/chat
 * 目录依赖：cloud-functions/_lib/handler.js   （就是 v2/api/chat.js 原样复制）
 *           cloud-functions/js/domain/*.js    （retrieval / prompt）
 *           cloud-functions/data/corpus.json
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../_lib/handler.js");

/**
 * 用最小的 res 垫片把 Express 风格的 handler 收束成一个 Promise。
 * handler 内部只用到 setHeader / status / json / end 四个方法。
 */
function runHandler(body) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const res = {
      statusCode: 200,
      _headers: {},
      setHeader(k, v) { this._headers[k] = v; return this; },
      status(code) { this.statusCode = code; return this; },
      json(obj) {
        if (settled) return this;
        settled = true;
        resolve({
          code: this.statusCode,
          body: JSON.stringify(obj),
          headers: this._headers
        });
        return this;
      },
      end() {
        if (settled) return this;
        settled = true;
        resolve({ code: this.statusCode, body: "", headers: this._headers });
        return this;
      }
    };

    try {
      const ret = handler({ body, method: "POST", headers: {} }, res);
      if (ret && typeof ret.then === "function") {
        ret.catch((e) => {
          if (!settled) { settled = true; reject(e); }
        });
      }
    } catch (e) {
      if (!settled) { settled = true; reject(e); }
    }
  });
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}

export async function onRequestPost(context) {
  // 环境变量：EdgeOne 注入到 context.env，本机走 process.env。
  // 两边都兜住，同一份代码在云上和本地都能跑。
  // 注意必须在调用 handler 之前注入——handler 里是每次调用时读 process.env。
  const env = (context && context.env) || {};
  for (const k of Object.keys(env)) {
    if (process.env[k] === undefined) process.env[k] = env[k];
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  try {
    const out = await runHandler(body);
    return new Response(out.body, {
      status: out.code,
      headers: Object.assign(
        { "Content-Type": "application/json; charset=utf-8" },
        out.headers
      )
    });
  } catch (e) {
    return jsonResponse({
      error: "internal error: " + (e && e.message ? e.message : String(e))
    }, 500);
  }
}

/* 同域部署其实不触发预检，留个口子防止换域名后翻车 */
export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    }
  });
}

/* 健康检查：部署后先打开 /api/chat 看一眼，能返回 JSON 就说明函数挂载成功 */
export function onRequestGet() {
  return jsonResponse({
    ok: true,
    service: "dazhan-hongtu /api/chat",
    mode: process.env.LLM_API_KEY ? "online" : "offline",
    model: process.env.LLM_MODEL || "(未配置)",
    hint: "用 POST 提交 {question, role, point}"
  });
}
