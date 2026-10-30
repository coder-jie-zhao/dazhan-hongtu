/**
 * Mock LLM 服务：冒充 OpenAI 兼容接口，验证「接模型」这条链路是否通。
 *
 * 它不做真推理，只按 prompt 里给的史料片段拼一句回答，
 * 目的是验证：检索 → 组装 prompt → 调用 → 返回 这条通路没问题，
 * 以及配了 key 之后前端会正确显示「在线模型」。
 *
 * 用法：node tools/mock_llm.js   （监听 8125）
 * 然后把 .env 指向 http://127.0.0.1:8125/v1
 */
const http = require("http");

const PORT = 8125;

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

  let raw = "";
  req.on("data", (c) => {
    raw += c;
    if (raw.length > 2 * 1024 * 1024) req.destroy();
  });
  req.on("end", () => {
    if (!req.url.includes("/chat/completions")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }

    let body = {};
    try { body = JSON.parse(raw || "{}"); } catch (e) { /* ignore */ }

    const msgs = body.messages || [];
    const system = (msgs.find((m) => m.role === "system") || {}).content || "";
    const user = (msgs.find((m) => m.role === "user") || {}).content || "";

    // 分支一：查询改写请求（system 里带「检索助手」）
    // 模拟真实模型做同义词归一：把口语说法换成史料用语。
    if (system.includes("检索助手")) {
      const dict = [
        [/(填肚子|吃饭|吃的|肚子饿)/, "粮食 吃饭 伙食 红米饭 南瓜汤"],
        [/(背粮食|扛粮食|挑东西)/, "挑粮 朱德的扁担 挑粮小道"],
        [/(碰面|遇上|见到)/, "会师 会见 文星阁"],
        [/(守.*山口|挡住|拦住)/, "哨口 地形 以少胜多 工事"],
        [/(灯.*暗|点灯|油灯)/, "灯芯 油灯 节约用油"],
        [/(哪个先|先后|谁先)/, "时间 1928年4月 1928年8月"],
        [/(炮弹|开炮|打炮)/, "迫击炮 三发炮弹 哑炮"]
      ];
      let kw = "无关";
      for (const [re, mapped] of dict) {
        if (re.test(user)) { kw = mapped; break; }
      }
      // 没命中词典时，退化为原问题里抽连续汉字（模拟模型给近义词）
      if (kw === "无关") {
        const q = user.replace(/^问题：/, "").replace(/关键词：$/, "").trim();
        const zh = q.replace(/[^\u4e00-\u9fa5]/g, "");
        if (zh.length >= 2) kw = zh.slice(0, 8);
      }
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({
        id: "chatcmpl-mock-rewrite",
        object: "chat.completion",
        model: body.model || "mock-model",
        choices: [{ index: 0, message: { role: "assistant", content: kw }, finish_reason: "stop" }]
      }));
      return;
    }

    // 分支二：正常回答生成
    const roleMatch = system.match(/当前角色：([^。\n]+)/);
    const role = roleMatch ? roleMatch[1].trim() : "讲解员";

    const fragMatch = system.match(/【史料片段】\n([\s\S]+)$/);
    const frag = fragMatch ? fragMatch[1].trim() : "";
    // 取第一句史料作为回答主体
    const firstSentence = frag.split(/[。；\n]/).filter(Boolean)[0] || "";

    let answer;
    if (!firstSentence) {
      answer = "这个问题超出了本点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。";
    } else {
      const prefix = role === "老乡" ? "那年我就在山下面，"
        : role === "战友" ? "我就在阵地上，"
        : "";
      answer = prefix + firstSentence + "。（本回答由 mock 模型生成，仅用于验证链路）";
    }

    const payload = {
      id: "chatcmpl-mock",
      object: "chat.completion",
      model: body.model || "mock-model",
      choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      // 把收到的 system prompt 长度回传，便于排查
      _debug: { systemLen: system.length, userLen: user.length, hasFragments: !!fragMatch, role: role }
    };

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(payload));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("mock LLM 已启动: http://127.0.0.1:" + PORT + "/v1");
  console.log("配 .env:  LLM_API_KEY=mock  LLM_BASE_URL=http://127.0.0.1:" + PORT + "/v1  LLM_MODEL=mock-model");
});
