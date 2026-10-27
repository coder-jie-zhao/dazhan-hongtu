#!/usr/bin/env node
/* =========================================================================
 * 大展红途 · 本地演示服务（真模型版）
 *
 * 为什么需要这个文件：
 *   前端 app.js 里的 FALLBACK 只是「调用不到后端时」的兜底。
 *   但如果你直接双击 index.html 或用 http.server 起静态服务，
 *   POST /api/chat 会 404 —— 于是永远走兜底，看起来就像"全是预置答案"。
 *
 *   本文件把 Vercel 的 serverless 函数（api/chat.js、api/comment.js）
 *   在本地跑起来，让「检索 → 真模型生成」这条主路径真正可执行。
 *
 * 用法：
 *   1) 在同目录建 .env，填 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 *   2) node server.js
 *   3) 浏览器打开 http://127.0.0.1:8123
 *
 * 不填 key 也能启动，此时界面会显示「离线」，走兜底话术。
 * ========================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

/* ---------- 读取 .env（不引入依赖，Node 18+ 通用） ---------- */
function loadEnv() {
  const p = path.join(ROOT, ".env");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf("=");
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const LLM_ON = !!process.env.LLM_API_KEY;
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini";
const BASE = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

/* ---------- 装配 Vercel 风格的 req/res ---------- */
function shimRes(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader("Content-Type")) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 2 * 1024 * 1024) req.destroy(); // 2MB 上限
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); } catch (e) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

/* ---------- 静态文件 ---------- */
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2"
};
// 不对外暴露的文件：.env 里有 key，server.js 自身与依赖目录都不该被下载
const DENY = [/^\.env/, /^server\.js$/, /^node_modules[\\/]/, /^\.git[\\/]/, /^_probe\.js$/, /^_checkdom\.js$/];

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  try { rel = decodeURIComponent(rel); } catch (e) { res.statusCode = 400; res.end("Bad Request"); return; }

  if (DENY.some((re) => re.test(rel))) { res.statusCode = 403; res.end("Forbidden"); return; }

  const file = path.resolve(ROOT, rel);
  const relCheck = path.relative(ROOT, file);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) { res.statusCode = 403; res.end("Forbidden"); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("404 Not Found: " + rel);
      return;
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
    res.setHeader("Content-Length", st.size);
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") { res.end(); return; } // HEAD 不发送 body，避免连接悬挂
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 主流程 ---------- */
let chatHandler = null;
let commentHandler = null;
try { chatHandler = require("./api/chat.js"); } catch (e) { console.error("[warn] api/chat.js 加载失败：", e.message); }
try { commentHandler = require("./api/comment.js"); } catch (e) { console.error("[warn] api/comment.js 加载失败：", e.message); }

const server = http.createServer(async (req, res) => {
  const host = req.headers.host || "127.0.0.1";
  let pathname = "/";
  try { pathname = new URL(req.url, "http://" + host).pathname; } catch (e) { /* keep "/" */ }

  // 前端用它判断当前是「在线模型」还是「离线兜底」
  if (pathname === "/api/health") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({
      mode: LLM_ON ? "online" : "offline",
      model: LLM_ON ? MODEL : null,
      endpoint: LLM_ON ? BASE.replace(/^https?:\/\//, "").split("/")[0] : null,
      retrieval: "rule-based (corpus anchored)"
    }));
    return;
  }

  if (pathname === "/api/chat" || pathname === "/api/comment") {
    const handler = pathname === "/api/chat" ? chatHandler : commentHandler;
    if (!handler) { res.statusCode = 500; res.end(JSON.stringify({ error: "handler not loaded" })); return; }
    req.body = await readBody(req);
    try {
      await handler(req, shimRes(res));
    } catch (e) {
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: String((e && e.message) || e) }));
      }
    }
    return;
  }

  serveStatic(req, res, pathname);
});

function listen(port, triesLeft = 5) {
  // 云端部署时平台会注入 PORT，且必须绑定 0.0.0.0 才能被反向代理访问；
  // 本地运行时仍绑 127.0.0.1，避免把本机服务暴露到局域网。
  const isCloud = !!process.env.PORT;
  const host = isCloud ? "0.0.0.0" : "127.0.0.1";
  server.once("error", (e) => {
    // 云端端口是平台指定的，不能被占用也不允许递增，直接报错退出
    if (e.code === "EADDRINUSE" && !isCloud && triesLeft > 0) {
      console.log("[port] " + port + " 已被占用，改用 " + (port + 1));
      listen(port + 1, triesLeft - 1);
    } else {
      console.error("[fatal] " + e.message);
      process.exit(1);
    }
  });
  server.listen(port, host, () => {
    const url = isCloud ? "http://" + host + ":" + port + "/index.html" : "http://127.0.0.1:" + port + "/index.html";
    console.log("");
    console.log("  大展红途 · 本地演示服务已启动");
    console.log("  ──────────────────────────────────────────");
    console.log("  地址   " + url);
    console.log("  模式   " + (LLM_ON ? "在线模型（真调用）" : "离线兜底（未配置 key）"));
    if (LLM_ON) {
      console.log("  模型   " + MODEL);
      console.log("  接口   " + BASE);
    } else {
      console.log("  提示   在目录下新建 .env 并填写 LLM_API_KEY 后重启，即可走真实模型");
      console.log("         .env.example 已给出模板");
    }
    console.log("  ──────────────────────────────────────────");
    console.log("  Ctrl+C 停止");
    console.log("");
  });
}

listen(Number(process.env.PORT) || 8123);
