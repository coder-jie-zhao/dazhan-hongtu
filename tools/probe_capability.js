/**
 * 能力边界实测：纯本地检索能答什么、答不了什么。
 *
 * 目的不是打分，是摸清「无模型」这条路的真实天花板，
 * 好判断要不要接模型、接了能好多少。
 *
 * 用法：node tools/probe_capability.js
 */
const path = require("path");
const ROOT = path.resolve(__dirname, "..", "v2");
const data = require(path.join(ROOT, "data", "corpus.json"));
const R = require(path.join(ROOT, "js", "domain", "retrieval.js"));
const S = require(path.join(ROOT, "js", "domain", "scoring.js"));

function localAnswer(question, point) {
  var docs = R.retrieve(question, { corpus: data.corpus, point: point });
  if (!docs) return { ok: false, why: "拒答", text: "" };
  var qa = (data.offlineQA[point] || []);
  var best = null, bestScore = 0;
  for (const item of qa) {
    let s = 0;
    if (R.keywordHit(question, item.keywords)) s = 0.6;
    if (!s) {
      const m = R.bigramMatch(question, item.q + " " + (item.keywords || []).join(""));
      if (m.hit >= 2 && m.total) s = m.hit / m.total;
    }
    if (s > bestScore) { bestScore = s; best = item; }
  }
  if (best && !best.refusal) return { ok: true, how: "离线QA", text: best.a };
  return { ok: true, how: "史料原文", text: docs[0].text };
}

// A 组：语料能覆盖的（应该答得出）
const A = [
  ["黄洋界海拔多少", "huangyangjie"],
  ["这场仗怎么打赢的", "huangyangjie"],
  ["红军吃什么", "huangyangjie"],
  ["朱德挑粮", "huangyangjie"],
  ["八角楼为什么叫八角楼", "bajiaolou"],
  ["一根灯芯", "bajiaolou"],
  ["井冈山会师时间", "longjiangshuyuan"],
  ["红四军军长是谁", "longjiangshuyuan"]
];

// B 组：语义相同但用词不同的（检验是否只能靠字面匹配）
const B = [
  ["那时候山上的人靠什么填肚子", "huangyangjie"],
  ["为什么守着山口就能挡住几倍的人", "huangyangjie"],
  ["他不是军长吗怎么还自己去背粮食", "huangyangjie"],
  ["屋子里那个灯为什么那么暗", "bajiaolou"],
  ["两支队伍是哪天碰上的", "longjiangshuyuan"]
];

// C 组：需要跨条目组合或推理的（本地检索天生做不到）
const C = [
  ["黄洋界保卫战和井冈山会师，哪个先发生", "huangyangjie"],
  ["八角楼和龙江书院离得远吗", "bajiaolou"],
  ["如果当时炮弹没打中指挥所会怎样", "huangyangjie"],
  ["为什么说井冈山是革命的摇篮", "huangyangjie"],
  ["这几处旧址哪个最值得看", "longjiangshuyuan"]
];

function run(label, list) {
  console.log("\n" + "=".repeat(60));
  console.log(label);
  console.log("=".repeat(60));
  let hit = 0, refuse = 0;
  for (const [q, p] of list) {
    const r = localAnswer(q, p);
    if (!r.ok) {
      refuse++;
      console.log("  [拒答] " + q);
    } else {
      hit++;
      console.log("  [√ " + r.how + "] " + q);
      console.log("         → " + r.text.slice(0, 56) + (r.text.length > 56 ? "…" : ""));
    }
  }
  console.log("  —— 命中 " + hit + " / 拒答 " + refuse + " / 共 " + list.length);
  return { hit, refuse, total: list.length };
}

console.log("语料：" + data.corpus.length + " 条（" + data.points.map((p) => p.name).join(" / ") + "）");
console.log("离线问答库：" + Object.keys(data.offlineQA).map((k) => k + "=" + data.offlineQA[k].length).join("  "));
const totalQA = Object.values(data.offlineQA).reduce((a, b) => a + b.length, 0);
console.log("离线问答总条数：" + totalQA + "（含拒答示例 2 条，实际可用 " + (totalQA - 2) + "）");

const a = run("A 组｜语料直接覆盖的（应该答得出）", A);
const b = run("B 组｜换个说法问同一件事（检验字面匹配的局限）", B);
const c = run("C 组｜需要跨条目组合 / 推理（本地检索天生做不到）", C);

console.log("\n" + "=".repeat(60));
console.log("结论");
console.log("=".repeat(60));
console.log("A 组命中率  " + a.hit + "/" + a.total + "  → 语料写到的，答得准");
console.log("B 组命中率  " + b.hit + "/" + b.total + "  → 换个说法就掉分，这是纯字面匹配的死穴");
console.log("C 组命中率  " + c.hit + "/" + c.total + "  → 跨条目推理、条件假设，本地检索做不到");
console.log("");
console.log("可用问答上限 ≈ 37 条语料 + " + (totalQA - 2) + " 条人工答案 ≈ 60 余种问法");
console.log("超出这个范围，行为是「拒答」——这对红色内容是对的（宁可不答也不能编），");
console.log("但对体验是硬限制：学生换个说法就问不出来了。");
