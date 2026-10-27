/* 检索验收脚本：直接调用 api/chat.js 的生产检索逻辑（不是副本）
   用法：node _probe.js
   答辩素材：本脚本的通过率即"检索验收"结论 */
const { retrieve, isOutOfDomain } = require("./api/chat.js");

const ANSWER = [
  "这场仗是怎么打赢的？","为什么叫「黄洋界上炮声隆」？","红军当时吃什么？",
  "黄洋界有多高？","朱德为什么挑粮？","纪念碑是什么时候建的？",
  "井冈山精神是什么","八角楼的灯芯故事","红军医院条件怎么样",
  "红军用了什么工事","敌我兵力差多少","毛泽东在这里写了什么诗",
  "挑粮小道有多长","群众是怎么支持红军的","什么叫做工农武装割据",
  "《西江月·井冈山》怎么写的","那条扁担是谁的","红军守山的有多少人",
  "黄洋界保卫战哪天打的","为什么要在八角楼点一根灯芯"
];
const REFUSE = [
  "黄洋界的门票多少钱？","附近有酒店推荐吗？","今天天气怎么样？",
  "你叫什么名字？","井冈山有什么好吃的？","帮我写一篇游记",
  "iPhone 15 多少钱","推荐几首流行歌曲","这里几点关门","停车场在哪",
  "从南昌怎么过来","有没有特产可以买","毛泽东后来怎么样了？","评价一下林彪"
];

let pass = 0, fail = 0;
console.log("========== 应命中（答非所问即为错） ==========");
for (const q of ANSWER) {
  const r = retrieve(q);
  if (!r) { console.log("  ✗ 误拒 ", q); fail++; continue; }
  console.log("  ✓ " + q + "  →  " + r[0].id + " " + r[0].title);
  pass++;
}
console.log("\n========== 应拒答（命中即为错） ==========");
for (const q of REFUSE) {
  const r = retrieve(q);
  if (!r) {
    const tag = isOutOfDomain(q) ? "域外" : "低分";
    console.log("  ✓ 拒答[" + tag + "]  " + q); pass++;
  } else {
    console.log("  ✗ 误答 " + q + "  →  " + r[0].id + " " + r[0].title); fail++;
  }
}
console.log("\n通过 " + pass + " / " + (pass + fail) + "，失败 " + fail);
