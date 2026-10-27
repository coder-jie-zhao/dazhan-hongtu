#!/usr/bin/env node
/* =========================================================================
 * 大展红途 v2 · 本地演示服务
 *
 * 作用：把 Vercel 的 serverless 函数（api/chat.js）在本机跑起来，
 * 让「检索 → 生成」这条主路径真正可执行。
 *
 * 用法：
 *   1) 在同目录建 .env，填 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL
 *   2) node server.js
 *   3) 浏览器打开 http://127.0.0.1:8130
 *
 * 不填 key 也能启动：此时界面显示「离线讲解」，回答来自服务端史料直出
 * （不是 503 白屏），超纲问题照样拒答。
 * ========================================================================= */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 8130;

/* ---------- 读取 .env（不引入依赖） ---------- */
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

/* ---------- Vercel 风格的 req/res 适配 ---------- */
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
      if (raw.length > 256 * 1024) req.destroy(); // 256KB 上限
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

// 不对外暴露：.env（含 key）、node_modules、.git、以及探测脚本
const DENY = [
  /^\.env/,
  /^\.git[\\/]/,
  /^node_modules[\\/]/,
  /^_probe\.js$/,
  /^_checkdom\.js$/,
  /^_shot.*\.js$/,
  /^_extract\.py$/
];

function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  try { rel = decodeURIComponent(rel); } catch (e) { res.statusCode = 400; res.end("Bad Request"); return; }

  if (DENY.some((re) => re.test(rel))) { res.statusCode = 403; res.end("Forbidden"); return; }

  const file = path.resolve(ROOT, rel);
  const relCheck = path.relative(ROOT, file);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    res.statusCode = 403; res.end("Forbidden"); return;
  }

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
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

/* ---------- 装配路由 ---------- */
let chatHandler = null;
try { chatHandler = require("./api/chat.js"); } catch (e) { console.error("[warn] api/chat.js 加载失败：", e.message); }

const corpus = require("./data/corpus.json");
const R = require("./js/domain/retrieval.js");

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
      retrieval: "rule-based (corpus anchored)",
      threshold: R.THRESHOLD,
      corpusCount: corpus.corpus.filter((c) => c.audit === "approved").length,
      points: corpus.points.length
    }));
    return;
  }

  // 检索自测接口：给外部脚本/答辩现场快速验证
  if (pathname === "/api/selftest") {
    const { ANSWER, REFUSE } = require("./js/domain/cases.js");
    let pass = 0, fail = 0;
    const results = [];
    for (const q of ANSWER) {
      const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
      if (t.hit) pass++; else fail++;
      results.push({ q, kind: "answer", pass: t.hit, detail: t.reason });
    }
    for (const q of REFUSE) {
      const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
      if (!t.hit) pass++; else fail++;
      results.push({ q, kind: "refuse", pass: !t.hit, detail: t.reason });
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ pass, fail, total: pass + fail, results }));
    return;
  }

  if (pathname === "/api/chat") {
    if (!chatHandler) { res.statusCode = 500; res.end(JSON.stringify({ error: "handler not loaded" })); return; }
    req.body = await readBody(req);
    try {
      await chatHandler(req, shimRes(res));
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
  const isCloud = !!process.env.PORT;
  const host = isCloud ? "0.0.0.0" : "127.0.0.1";
  server.once("error", (e) => {
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
    console.log("  大展红途 v2 · 本地演示服务已启动");
    console.log("  ──────────────────────────────────────────");
    console.log("  地址   " + url);
    console.log("  点位   " + corpus.points.length + " 个（" + corpus.points.map((p) => p.name).join(" / ") + "）");
    console.log("  语料   " + corpus.corpus.filter((c) => c.audit === "approved").length + " 条已审核");
    console.log("  模式   " + (LLM_ON ? "在线模型（真调用）" : "离线史料直出（未配置 key）"));
    if (LLM_ON) {
      console.log("  模型   " + MODEL);
      console.log("  接口   " + BASE);
    } else {
      console.log("  提示   在目录下新建 .env 并填写 LLM_API_KEY 后重启，即可走真实模型");
    }
    console.log("  自测   " + url.replace("/index.html", "") + " → 检索验收自测页，或 curl /api/selftest");
    console.log("  ──────────────────────────────────────────");
    console.log("  Ctrl+C 停止");
    console.log("");
  });
}

listen(PORT);
