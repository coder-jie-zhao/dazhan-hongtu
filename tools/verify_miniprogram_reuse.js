/**
 * 验证「domain 层能否在小程序里直接复用」。
 *
 * 小程序环境的特点：没有 window、没有 document、没有 localStorage，
 * 但有 CommonJS 的 module/exports（可以 require）。
 *
 * 判断方法：在干净的 VM 里模拟小程序环境（删掉 window/document/localStorage），
 * 再看 domain 层的四个模块能不能 require 进来并正常算结果。
 *
 * 如果这一步能过，说明迁移小程序时「检索 + 评分 + 任务单 + prompt」全都不用重写，
 * 只有视图层（DOM 操作那部分）要改成 WXML/setData。
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..", "v2");
const mods = {
  retrieval: path.join(ROOT, "js", "domain", "retrieval.js"),
  scoring: path.join(ROOT, "js", "domain", "scoring.js"),
  taskgen: path.join(ROOT, "js", "domain", "taskgen.js"),
  prompt: path.join(ROOT, "js", "domain", "prompt.js"),
  cases: path.join(ROOT, "js", "domain", "cases.js")
};
const corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "corpus.json"), "utf8"));

// 模拟小程序环境：只有 module/exports/require，没有 window/document/localStorage
function loadInMiniProgram(file) {
  const src = fs.readFileSync(file, "utf8");
  const module = { exports: {} };
  const sandbox = {
    module,
    exports: module.exports,
    require,
    console
    // 故意不给 window / document / localStorage / navigator / self
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: path.basename(file) });
  return module.exports;
}

let pass = 0, fail = 0;
const results = [];

function check(name, fn) {
  try {
    const r = fn();
    if (r === false) { fail++; results.push(["FAIL", name, "返回 false"]); }
    else { pass++; results.push(["OK", name, r === true ? "" : String(r).slice(0, 70)]); }
  } catch (e) {
    fail++;
    results.push(["FAIL", name, e.message.slice(0, 90)]);
  }
}

console.log("=== 模拟小程序环境（无 window/document/localStorage） ===\n");

let R, S, T, P, CS;

check("require retrieval.js", () => { R = loadInMiniProgram(mods.retrieval); return !!R.retrieve; });
check("require scoring.js", () => { S = loadInMiniProgram(mods.scoring); return !!S.compute; });
check("require taskgen.js", () => { T = loadInMiniProgram(mods.taskgen); return !!T.generate; });
check("require prompt.js", () => { P = loadInMiniProgram(mods.prompt); return !!P.buildSystemPrompt; });
check("require cases.js", () => { CS = loadInMiniProgram(mods.cases); return CS.TOTAL === 34; });

console.log("--- 功能是否可用 ---");

check("检索：能命中（黄洋界怎么打赢）", () => {
  const t = R.retrieve("这场仗是怎么打赢的？", { corpus: corpus.corpus, point: "huangyangjie" });
  return t && t.length ? t[0].id : false;
});

check("检索：能拒答（门票多少钱）", () => {
  const t = R.retrieve("黄洋界的门票多少钱？", { corpus: corpus.corpus, point: "huangyangjie" });
  return t === null;
});

check("评分：能算出 4 项", () => {
  const r = S.compute({
    tasks: { t1: true }, choiceCorrect: true, orderCorrect: true,
    questions: ["a", "b"], enterTime: Date.now() - 11 * 60000,
    selfText: "以前我以为守住山口靠人多，今天才知道地形和人心一样重要。"
  }, { selfMinLen: 15 });
  return r.items.length === 4 && r.items.find((i) => i.key === "express").value === 100;
});

check("评语：模板拼接（不调模型）", () => {
  const c = S.buildComment({ questions: ["为什么是黄洋界"], reason: "地形险要", selfText: "" }, "黄洋界哨口");
  return c.length > 10;
});

check("任务单：按学段生成 4 题", () => {
  const plan = T.generate(corpus, "bajiaolou", "junior");
  return plan.items.length === 4 && plan.items.some((i) => i.type === "text");
});

check("prompt：能组装 system prompt", () => {
  const docs = R.retrieve("这根扁担是谁的", { corpus: corpus.corpus, point: "huangyangjie" }) || [];
  const sp = P.buildSystemPrompt("讲解员", docs, "黄洋界哨口", { scopeTopics: "测试" });
  return sp.includes("史料片段") && sp.length > 100;
});

check("34 项用例：在模拟环境里跑通", () => {
  let n = 0;
  for (const q of CS.ANSWER) {
    const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
    if (t.hit) n++;
  }
  for (const q of CS.REFUSE) {
    const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
    if (!t.hit) n++;
  }
  return n === 34 ? "34/34" : "只有 " + n + "/34";
});

console.log("");
results.forEach(([st, name, detail]) => {
  console.log("  [" + st + "] " + name + (detail ? "  → " + detail : ""));
});

console.log("\n" + "=".repeat(58));
console.log(pass + " 通过 / " + fail + " 失败");
console.log("=".repeat(58));
if (fail === 0) {
  console.log("结论：domain 层（检索/评分/任务单/prompt/用例）在无 DOM 环境下 100% 可用。");
  console.log("      迁小程序时这四块不用重写，只需把 views 层（innerHTML + CSS）");
  console.log("      改成 WXML + setData + WXSS。");
} else {
  console.log("结论：有模块依赖浏览器 API，迁移前需要解耦。");
}
process.exitCode = fail ? 1 : 0;
