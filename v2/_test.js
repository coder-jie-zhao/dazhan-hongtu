/* =========================================================================
 * 大展红途 v2 · 检索验收脚本（命令行版）
 *
 * 与前端「检索验收自测」页跑的是同一份用例（js/domain/cases.js）
 * 和同一份检索实现（js/domain/retrieval.js），数字必然一致。
 *
 * 用法：node _test.js
 * 答辩价值：这是「检索为什么命中、什么情况下必须拒答」的可复现证据。
 * ========================================================================= */
const R = require("./js/domain/retrieval.js");
const corpus = require("./data/corpus.json");
const CS = require("./js/domain/cases.js");

let pass = 0, fail = 0;
const failures = [];

console.log("========== 应答类（语料覆盖范围内，必须命中正确条目） ==========");
for (const q of CS.ANSWER) {
  const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
  if (t.hit) {
    pass++;
    console.log("  [OK] " + q + "  ->  " + t.docs[0].id + " " + t.docs[0].title);
  } else {
    fail++;
    failures.push(["ANSWER", q, t.reason]);
    console.log("  [FAIL] 误拒  " + q + "  ->  " + t.reason);
  }
}

console.log("\n========== 拒答类（超纲/涉评价/景区服务，必须拒答） ==========");
for (const q of CS.REFUSE) {
  const t = R.retrieveWithTrace(q, { corpus: corpus.corpus });
  if (!t.hit) {
    pass++;
    console.log("  [OK] 拒答  " + q + "  ->  " + t.reason);
  } else {
    fail++;
    failures.push(["REFUSE", q, "误命中 " + t.docs[0].id + " " + t.docs[0].title]);
    console.log("  [FAIL] 误答  " + q + "  ->  " + t.docs[0].id + " " + t.docs[0].title);
  }
}

console.log("\n========== 汇总 ==========");
console.log("语料条数：" + corpus.corpus.filter((c) => c.audit === "approved").length +
            "　点位：" + corpus.points.length +
            "　命中阈值：" + R.THRESHOLD);
console.log("通过 " + pass + " / " + (pass + fail) + "，失败 " + fail);

if (failures.length) {
  console.log("\n失败明细：");
  failures.forEach((f) => console.log("  [" + f[0] + "] " + f[1] + "  ->  " + f[2]));
  process.exitCode = 1;
}
