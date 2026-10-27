/* =========================================================================
 * 大展红途 · app.js
 * 第 1 步：V1/V2 + 视图切换；第 2 步：V3 对话 + 检索 + 离线兜底；
 * 第 3 步：V4 三题任务 + V5 研学报告（可解释评分 + 截图）。
 * 数据内联在此（保证 file:// 双击也能演），data/*.json 为参考副本。
 * ========================================================================= */

/* ---------- 点位数据（与 data/points.json 同步） ---------- */
const POINTS = {
  id: "huangyangjie",
  name: "黄洋界哨口",
  order: 1,
  subtitle: "教学点位 01",
  coords: [26.5723, 114.1128],
  photo: "img/hyj-cover.jpg", // TODO: 替换为黄洋界真实照片
  keywords: ["黄洋界保卫战", "山下旌旗在望", "挑粮小道"],
  brief: "1928 年 8 月 30 日，红军以不足一个营的兵力，据险击退湘赣两省国民党军四个团的进攻，取得黄洋界保卫战胜利。",
  cards: [
    { label: "1928.8.30", desc: "黄洋界保卫战" },
    { label: "1343 米", desc: "哨口海拔" },
    { label: "旌旗在望", desc: "毛泽东《西江月》" }
  ]
};

/* ---------- 离线兜底缓存（与 data/fallback.json 同步） ---------- */
const FALLBACK = {
  point: "huangyangjie",
  refusal: "这个问题超出了黄洋界点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。",
  offline: ["这场仗是怎么打赢的？", "为什么要挑粮上山？", "红军当时吃什么？", "黄洋界有多高？", "纪念碑是什么时候建的？", "朱德为什么挑粮？"],
  guide: "欢迎来到黄洋界哨口。这里海拔1343米，是井冈山五大哨口之一，扼守湘赣要隘。1928年8月30日，红军以不足一个营的兵力，在朱云卿、何挺颖、陈毅安指挥下，依托竹钉阵等工事和群众支持，击退了湘赣敌军四个团的进攻，取得黄洋界保卫战胜利。毛泽东闻讯后写下《西江月·井冈山》：“山下旌旗在望，山头鼓角相闻……黄洋界上炮声隆，报道敌军宵遁。”",
  qa: [
    { q: "这场仗是怎么打赢的？", keywords: ["黄洋界保卫战", "打赢", "保卫战", "怎么赢"], source: "中国军网《黄洋界保卫战：坚守防御作战的典范》", a: "靠三点：一是险要地形，哨口山高路陡、易守难攻；二是连夜构筑的竹钉阵等五道工事；三是群众支前，送粮抬担架、设疑兵。军民一心，以少胜多守住了黄洋界。" },
    { q: "为什么叫「黄洋界上炮声隆」？", keywords: ["黄洋界上炮声隆", "炮声隆", "西江月"], source: "中国军网《黄洋界保卫战：坚守防御作战的典范》", a: "这句出自毛泽东《西江月·井冈山》。保卫战当天，红军一门迫击炮只有三发炮弹，前两发哑了，第三发恰好击中敌军指挥所。敌人误以为红军主力回山，连夜撤退。这一炮，成了整场战斗的转折。" },
    { q: "红军当时吃什么？", keywords: ["吃什么", "红军", "粮食", "饮食", "吃饭"], source: "央视网《国家记忆·朱德的扁担》", a: "井冈山被严密封锁，粮食、盐都缺。红军官兵过的是“红米饭、南瓜汤”的苦日子，粮食要靠下山挑运。朱德也和大家一起挑粮，战士藏起他的扁担，他另做一根，写上“朱德的扁担”。" },
    { q: "为什么要挑粮上山？", keywords: ["挑粮", "挑粮小道", "朱德", "运粮"], source: "央视网《国家记忆·朱德的扁担》", a: "敌军封锁下，山上缺粮。1928年冬红四军发起挑粮运动，从宁冈、茅坪等地沿黄洋界羊肠小道把粮挑上山，这条路就是“挑粮小道”，往返约五六十里。朱德带头挑粮，成了艰苦奋斗的象征。" },
    { q: "黄洋界有多高？", keywords: ["海拔", "多高", "高度", "1343"], source: "中国军网《黄洋界保卫战：坚守防御作战的典范》", a: "黄洋界哨口海拔1343米，是井冈山五大哨口之一，站在哨口可以俯瞰群山。山高路陡、地势险要，正是它成为红军重要防御屏障的原因。" },
    { q: "黄洋界保卫战是什么时候？", keywords: ["时间", "什么时候", "哪一年", "保卫战"], source: "共产党员网《党史上的今天·8月30日》", a: "1928年8月30日。当时毛泽东率一部红军去桂东接应主力，井冈山留守兵力薄弱，湘赣敌军乘机进攻。红军以不足一个营的兵力，在黄洋界击退了敌军四个团。" },
    { q: "朱德为什么挑粮？", keywords: ["朱德", "扁担", "挑粮"], source: "央视网《国家记忆·朱德的扁担》", a: "朱德是军长，已过40岁，仍和战士们一样穿草鞋、挑粮上山。战士心疼他，藏起他的扁担，他就另做一根并写上“朱德的扁担”。这件事后来写成课文《朱德的扁担》。" },
    { q: "黄洋界的门票多少钱？", keywords: ["门票", "多少钱", "票价", "收费", "开放时间"], refusal: true, a: "这个问题超出了黄洋界点位已审核史料的范围。我只能依据审核过的史料回答，不能凭印象讲——红色历史的细节，讲错一句比不讲更糟。\n你可以问我：这场仗是怎么打赢的？／ 为什么要挑粮上山？" }
  ]
};

/* ---------- 任务数据（与 data/tasks.json 同步） ---------- */
const TASKS = [
  { id: "t1", type: "photo", title: "寻找纪念碑", desc: "拍一张黄洋界保卫战胜利纪念碑的照片" },
  { id: "t2", type: "choice", title: "想一想", question: "红军以不足一个营击退敌军四个团，最根本的原因是什么？", options: ["红军武器装备优于敌军", "依托险要地形与工事，军民一心", "敌军战斗力弱、士气低落", "浓雾天气使敌军无法进攻"], answer: 1, reasonMinLen: 20 },
  { id: "t3", type: "order", title: "理一理", question: "把 4 个事件按时间先后排好（拖拽排序）", events: [
    { t: "1928.4", e: "朱毛会师" },
    { t: "1928.8", e: "黄洋界保卫战" },
    { t: "1928.12", e: "颁布《井冈山土地法》" },
    { t: "1929.1", e: "红四军下山" }
  ]}
];

/* ---------- 运行参数 ----------
   ?view=home|point|chat|task|report|teacher  直接进入某个界面（截图 / 演示用）
   ?demo=1                                    注入一份饱满的演示数据，不出现空状态
   ?embed=1                                   去掉桌面阴影，供 showcase 内嵌 */
const PARAMS = new URLSearchParams(location.search);
const DEMO = PARAMS.get("demo") === "1";
const FORCE_VIEW = PARAMS.get("view");
const EMBED = PARAMS.get("embed") === "1";

/* ---------- 工具 ---------- */
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const el = $("view-" + id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
  if (id === "point") initPoint();
  if (id === "task") initTask();
  if (id === "teacher") initTeacher();
  if (id === "chat") probeMode();
  if (id === "report") renderReport();
}

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------- 回答来源探测 ----------
   目的：把「真模型生成」和「本地预置史料」在界面上区分开。
   答辩时这是一个证据——评委能看到当前确实在调用模型，而不是背稿子。 */
let modeProbed = false;
async function probeMode() {
  if (modeProbed) return;
  modeProbed = true;
  const box = $("ai-mode");
  const txt = $("ai-mode-text");
  if (!box || !txt) return;

  // 演示模式：回答确实来自已审核史料库，不必假装在线模型
  if (DEMO) {
    box.classList.add("online");
    txt.textContent = "史料依据 · 18 条已审核";
    box.title = "回答依据服务端已审核史料；超出史料范围会明确拒答";
    return;
  }

  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    if (!r.ok) throw new Error("no health");
    const d = await r.json();
    if (d.mode === "online") {
      box.classList.add("online");
      txt.textContent = "在线模型 · " + d.model;
      box.title = "回答由真实模型生成，依据服务端已审核史料；超出史料范围会拒答";
    } else {
      box.classList.add("offline");
      txt.textContent = "离线讲解 · 预置史料";
      box.title = "未配置模型 key，当前回答来自本地预置史料";
    }
  } catch (e) {
    box.classList.add("offline");
    txt.textContent = "离线讲解 · 预置史料";
    box.title = "未检测到后端服务（双击打开或用静态服务器时即为该状态）";
  }
}

/* ---------- 检索：归一化 + bigram + 关键词（与 api/chat.js 保持一致） ---------- */
const STOP = new Set("的了是在和与及都也还又而吗呢吧啊嘛怎么什么为什么怎样如何多少哪里这那个些谁".split(""));
const GENERIC = ["黄洋界", "井冈山", "红军", "井冈"];

function normalizeRaw(s) {
  return String(s || "").replace(/[^一-龥a-zA-Z0-9]/g, "");
}
function normalize(s) {
  return normalizeRaw(s).split("").filter((c) => !STOP.has(c)).join("");
}
function stripGeneric(s) {
  let t = String(s || "");
  for (const g of GENERIC) t = t.split(g).join("");
  return t;
}
function prep(s) { return normalize(stripGeneric(s)); }
function bigrams(s) {
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}
function bigramMatch(query, text) {
  const qb = bigrams(prep(query));
  const tb = new Set(bigrams(prep(text)));
  let hit = 0;
  for (const b of qb) if (tb.has(b)) hit++;
  return { hit, total: qb.length };
}
function keywordHit(query, keywords) {
  const nq = normalizeRaw(query);
  for (const k of (keywords || [])) {
    const nk = normalizeRaw(k);
    if (!nk || nk.length < 2 || GENERIC.includes(nk)) continue;
    if (nq.includes(nk)) return true;
  }
  return false;
}

/* 离线兜底：关键词子串强命中 + bigram 兜底（至少 2 个二元组重合） */
function matchFallback(text) {
  let best = null, bestScore = 0;
  for (const item of FALLBACK.qa) {
    let s = 0;
    if (keywordHit(text, item.keywords)) s = 0.6;
    if (!s) {
      const m = bigramMatch(text, item.q + (item.keywords || []).join(""));
      if (m.hit >= 2 && m.total) s = m.hit / m.total;
    }
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return bestScore >= 0.15 ? best : null;
}

/* ---------- 用户信息（localStorage） ---------- */
const USER_KEY = "dzht_user";
const PROG_KEY = "dzht_progress";

/* localStorage 在「手机本地直接打开 html 文件」或隐私模式下可能直接抛异常，
   这里统一包一层：能用就用，不能用就退回内存，保证功能不中断（只是关掉页面后记录不保留）。 */
const MEM_STORE = {};
function lsGet(k) {
  try { return localStorage.getItem(k); } catch (e) { return Object.prototype.hasOwnProperty.call(MEM_STORE, k) ? MEM_STORE[k] : null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, v); } catch (e) { MEM_STORE[k] = v; }
}

function getUser() {
  try { return JSON.parse(lsGet(USER_KEY)); } catch (e) { return null; }
}
function saveUser(name, school) {
  lsSet(USER_KEY, JSON.stringify({ name, school }));
}

function defaultState() {
  return { tasks: { t1: false, t2: false, t3: false }, task2Reason: "", questions: [], enterTime: 0 };
}
function getState() {
  try { return Object.assign(defaultState(), JSON.parse(lsGet(PROG_KEY)) || {}); } catch (e) { return defaultState(); }
}
function saveState(st) { lsSet(PROG_KEY, JSON.stringify(st)); }

function ensureOnboard() {
  if (getUser()) return true;
  $("onboard").classList.add("show");
  return false;
}

/* ---------- V2 点位页 ---------- */
let pointInited = false;

function initPoint() {
  if (pointInited) return;
  pointInited = true;

  // 记录进入点位时间（用于"现场观察"评分里的停留时长）
  const st = getState();
  if (!st.enterTime) { st.enterTime = Date.now(); saveState(st); }

  $("point-title").textContent = POINTS.name;
  $("point-subtitle").textContent = POINTS.subtitle;

  const wrap = $("info-cards");
  wrap.innerHTML = POINTS.cards.map((c) =>
    '<div class="info-card">' +
      '<div class="info-card-label">' + c.label + '</div>' +
      '<div class="info-card-desc">' + c.desc + '</div>' +
    '</div>'
  ).join("");

  setTimeout(() => {
    $("locate-text").textContent = "已到达点位";
    $("point-locate").classList.add("arrived");
  }, 1200);
}

/* ---------- V3 对话页 ---------- */
const ROLES = {
  "讲解员": { mark: "讲", color: "#9E2A2B" },
  "老乡": { mark: "乡", color: "#1B3A5C" },
  "战友": { mark: "战", color: "#2e7d32" }
};
let currentRole = "讲解员";
let chatBusy = false;

function chatEl() { return $("chat-body"); }
function scrollChat() { const b = chatEl(); b.scrollTop = b.scrollHeight; }

function addSystem(text) {
  const d = document.createElement("div");
  d.className = "system-note";
  d.textContent = text;
  chatEl().appendChild(d);
  scrollChat();
}
function addUserMsg(text) {
  const d = document.createElement("div");
  d.className = "msg user";
  d.innerHTML = '<div class="bubble">' + esc(text) + '</div>';
  chatEl().appendChild(d);
  scrollChat();
}
function addAiMsg(role, text, sources, refusal) {
  const r = ROLES[role] || ROLES["讲解员"];
  const d = document.createElement("div");
  d.className = "msg ai";
  let html = '<div class="msg-meta">' +
    '<span class="msg-avatar" style="background:' + r.color + '">' + r.mark + '</span>' +
    '<span class="msg-name">' + role + '</span>' +
    '</div>';
  html += '<div class="bubble">' + esc(text) + '</div>';
  if (!refusal && sources && sources.length) {
    html += '<div class="msg-source">依据：' + esc(sources.join("、")) + '</div>';
  }
  d.innerHTML = html;
  chatEl().appendChild(d);
  scrollChat();
}

function showTyping() {
  if ($("chat-typing")) return;
  const d = document.createElement("div");
  d.className = "msg ai";
  d.id = "chat-typing";
  d.innerHTML = '<div class="bubble typing"><span></span><span></span><span></span></div>';
  chatEl().appendChild(d);
  scrollChat();
}
function hideTyping() {
  const t = $("chat-typing");
  if (t) t.remove();
}

async function sendQuestion(raw) {
  const text = (raw || "").trim();
  if (!text || chatBusy) return;
  chatBusy = true;

  const hint = $("chat-hint");
  if (hint) hint.remove();
  addUserMsg(text);

  // 记录提问（用于"主动探究"评分与报告评语）
  const st = getState();
  st.questions.push(text);
  if (st.questions.length > 10) st.questions = st.questions.slice(-10);
  saveState(st);

  const typingTimer = setTimeout(showTyping, 1500);

  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, role: currentRole, point: POINTS.id })
    });
    if (!resp.ok) throw new Error("http " + resp.status);
    const data = await resp.json();
    clearTimeout(typingTimer); hideTyping();
    addAiMsg(currentRole, data.answer, data.sources, data.refusal);
  } catch (e) {
    clearTimeout(typingTimer); hideTyping();
    fallbackAnswer(text);
  } finally {
    chatBusy = false;
  }
}

function fallbackAnswer(text) {
  const hit = matchFallback(text);
  if (hit) {
    addAiMsg(currentRole, hit.a, hit.source ? [hit.source] : [], !!hit.refusal);
  } else {
    // 未命中就是没有依据，兜底也必须拒答。拿讲解词冒充回答，等于替模型编内容。
    addSystem("当前网络不稳定，已切换到离线讲解模式");
    addAiMsg(currentRole, FALLBACK.refusal, [], true);
  }
}

/* ---------- V4 任务页 ---------- */
let taskInited = false;

function initTask() {
  if (taskInited) return;
  taskInited = true;
  renderTask2Options();
  renderTask3Sort();
  renderTaskStatuses();
  updateReportButton();
  if (DEMO) seedTask();
}

/* 演示态：把任务二的选择与理由、任务三的正确顺序一并摆好，
   避免「显示已完成、但控件还是空的」这种自相矛盾的画面 */
function seedTask() {
  const st = getState();
  const opts = document.querySelectorAll(".task-option");
  if (opts[1]) opts[1].classList.add("selected");
  const ta = $("task-reason");
  if (ta && st.task2Reason) ta.value = st.task2Reason;

  const wrap = $("task-order");
  if (wrap) {
    const byOrder = {};
    wrap.querySelectorAll(".sort-item").forEach((el) => {
      byOrder[el.getAttribute("data-order")] = el;
    });
    wrap.innerHTML = "";
    ["0", "1", "2", "3"].forEach((k) => { if (byOrder[k]) wrap.appendChild(byOrder[k]); });
  }

  if (ta) autoGrow(ta);
}

/* 理由输入框随内容长高，避免文字被切掉 */
function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight + 2, 180) + "px";
}

function renderTask2Options() {
  const t2 = TASKS[1];
  const wrap = $("task-options");
  wrap.innerHTML = t2.options.map((o, i) =>
    '<button class="task-option" data-opt="' + i + '"><span class="opt-key">' + String.fromCharCode(65 + i) + '</span>' + o + '</button>'
  ).join("");
}

function renderTask3Sort() {
  const t3 = TASKS[2];
  const shuffled = [2, 0, 3, 1]; // 固定打乱初始顺序（保证演示可复现）
  const wrap = $("task-order");
  wrap.innerHTML = shuffled.map((i) =>
    '<div class="sort-item" data-order="' + i + '">' +
      '<span class="sort-handle">≡</span>' +
      '<span class="sort-time">' + t3.events[i].t + '</span>' +
      '<span class="sort-name">' + t3.events[i].e + '</span>' +
    '</div>'
  ).join("");
  makeSortable(wrap);
}

function makeSortable(container) {
  let drag = null;
  container.addEventListener("pointerdown", (e) => {
    const item = e.target.closest(".sort-item");
    if (!item) return;
    drag = item;
    item.classList.add("dragging");
    e.preventDefault();
  });
  container.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el && el.closest(".sort-item");
    if (!target || target === drag || !container.contains(target)) return;
    const rect = target.getBoundingClientRect();
    if (e.clientY < rect.top + rect.height / 2) container.insertBefore(drag, target);
    else target.insertAdjacentElement("afterend", drag);
  });
  const end = () => {
    if (!drag) return;
    drag.classList.remove("dragging");
    drag = null;
  };
  container.addEventListener("pointerup", end);
  container.addEventListener("pointercancel", end);
}

function markTask(id, done) {
  const st = getState();
  st.tasks[id] = done;
  saveState(st);
  renderTaskStatuses();
  updateReportButton();
}

function renderTaskStatuses() {
  const st = getState();
  document.querySelectorAll(".tprog-item").forEach((el) => {
    el.classList.toggle("done", !!st.tasks[el.getAttribute("data-t")]);
  });
  $("task-t1").classList.toggle("done", !!st.tasks.t1);
  $("task-t2").classList.toggle("done", !!st.tasks.t2);
  $("task-t3").classList.toggle("done", !!st.tasks.t3);
  if (st.tasks.t1) { $("status-t1").textContent = "✓ 已完成"; $("status-t1").className = "task-status ok"; }
  if (st.tasks.t2) {
    $("status-t2").textContent = "✓ 回答正确，任务二完成";
    $("status-t2").className = "task-status ok";
    $("btn-t2").textContent = "已完成";
    $("btn-t2").disabled = true;
  }
  if (st.tasks.t3) {
    $("status-t3").textContent = "✓ 排序正确，任务三完成";
    $("status-t3").className = "task-status ok";
    $("btn-t3").textContent = "已完成";
    $("btn-t3").disabled = true;
  }
}

function updateReportButton() {
  const st = getState();
  const allDone = st.tasks.t1 && st.tasks.t2 && st.tasks.t3;
  const btn = $("btn-report");
  btn.disabled = !allDone;
  btn.classList.toggle("ready", allDone);
  btn.textContent = allDone ? "生成我的研学报告" : "完成全部 3 项任务后解锁";
}

/* ---------- V5 研学报告 ---------- */
function computeScore(st) {
  // 史料理解 = 任务二单选 60 + 排序 40（需求书第五节，可解释）
  const shi = (st.tasks.t2 ? 60 : 0) + (st.tasks.t3 ? 40 : 0);
  // 主动探究 = min(提问次数 × 15, 70) + 追问奖励 30（追问 = 提问 ≥ 2 次）
  const q = (st.questions || []).length;
  const probe = Math.min(q * 15, 70) + (q >= 2 ? 30 : 0);
  // 现场观察 = 拍照任务 70 + 停留超 10 分钟 30
  const stayMin = st.enterTime ? Math.floor((Date.now() - st.enterTime) / 60000) : 0;
  const observe = (st.tasks.t1 ? 70 : 0) + (stayMin >= 10 ? 30 : 0);
  return { shi, probe, observe, q, stayMin };
}

function renderReport() {
  const user = getUser() || { name: "同学", school: "—" };
  const st = getState();
  const sc = computeScore(st);
  const now = new Date();
  const dateStr = now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0");

  $("rpt-name").textContent = user.name;
  $("rpt-school").textContent = user.school;
  $("rpt-date").textContent = dateStr;
  $("rpt-stay").textContent = sc.stayMin + " 分钟";
  $("rpt-ask").textContent = sc.q + " 次";
  $("rpt-tasks").textContent = "完成 3 项任务";
  $("rpt-observe").textContent = "观察 1 处";

  setBar("shi", sc.shi);
  setBar("probe", sc.probe);
  setBar("observe", sc.observe);

  // 我提的问题：报告里最能体现"他到底想了什么"的东西
  const qs = (st.questions || []).slice(-4);
  $("rpt-questions").innerHTML = qs.length
    ? qs.map((q) => "<li>" + esc(q) + "</li>").join("")
    : '<li class="rpt-empty">本次没有提问</li>';

  // 我的思考：任务二写的理由，是报告里唯一由学生原创的完整句子
  $("rpt-thought").textContent = st.task2Reason
    ? "「" + st.task2Reason + "」"
    : "（未填写理由）";

  setComment(st);
}

function setBar(key, val) {
  $("bar-" + key).style.width = val + "%";
  $("bar-" + key + "-num").textContent = val;
}

function setComment(st) {
  const el = $("rpt-comment");
  el.textContent = "正在生成评语…";
  if (DEMO) { el.textContent = templateComment(st); return; }
  const payload = {
    name: (getUser() || {}).name || "同学",
    questions: (st.questions || []).slice(-3),
    reason: st.task2Reason || ""
  };
  fetch("/api/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((d) => { el.textContent = d.comment || templateComment(st); })
    .catch(() => { el.textContent = templateComment(st); });
}

function templateComment(st) {
  const qs = st.questions || [];
  const q = qs.length ? qs[qs.length - 1].replace(/[？?。！!]$/, "") : "黄洋界保卫战";
  if (!qs.length) {
    return "你完成了黄洋界的现场观察与任务，但还没有向讲解助手提出自己的问题。研学不止于听，下一次不妨带着一个疑问来——比如「红军当时吃什么」「为什么要在八角楼点一根灯芯」。";
  }
  if (!st.task2Reason) {
    return "你围绕「" + q + "」追问，说明你已经在主动寻找答案。研学不止于听，更在于问与想——继续保持这份刨根问底的劲头。";
  }
  return "你围绕「" + q + "」一路追问，又在任务二里写下了自己的解释。这说明你不只是记住了经过，还在想这场仗为什么能赢——从「听讲」走到「求证」，是研学里最难、也最值钱的一步。";
}

function saveReportImage() {
  if (typeof html2canvas === "undefined") {
    toast("当前离线，请用系统截图保存报告");
    return;
  }
  const card = $("report-card");
  html2canvas(card, { scale: 2, backgroundColor: "#FBF8F3", useCORS: true })
    .then((canvas) => {
      $("save-img").src = canvas.toDataURL("image/png");
      $("save-modal").classList.add("show");
    })
    .catch(() => toast("生成图片失败，请用系统截图保存"));
}

/* ---------- V6 教师端 ---------- */
const STUDENTS = [
  { name: "赵杰", school: "东华理工大学", points: "黄洋界", tasks: 3, questions: 5, minutes: 18 },
  { name: "李雯", school: "东华理工大学", points: "黄洋界", tasks: 3, questions: 4, minutes: 16 },
  { name: "王浩", school: "井冈山中学", points: "黄洋界", tasks: 3, questions: 6, minutes: 21 },
  { name: "陈曦", school: "井冈山中学", points: "黄洋界", tasks: 3, questions: 3, minutes: 12 },
  { name: "刘洋", school: "东华理工大学", points: "黄洋界", tasks: 3, questions: 5, minutes: 15 }
];
let teacherInited = false;

function initTeacher() {
  if (teacherInited) return;
  teacherInited = true;
  renderTeacher();
}

function renderTeacher() {
  const tbody = $("teacher-tbody");
  tbody.innerHTML = STUDENTS.map((s) =>
    '<tr>' +
      '<td><span class="stu-name">' + s.name + '</span><span class="stu-school">' + s.school + '</span></td>' +
      '<td>' + s.points + '</td>' +
      '<td>' + s.tasks + '/3</td>' +
      '<td>' + s.questions + '</td>' +
      '<td>' + s.minutes + '分</td>' +
    '</tr>'
  ).join("");

  const totalQ = STUDENTS.reduce((a, s) => a + s.questions, 0);
  const avgMin = (STUDENTS.reduce((a, s) => a + s.minutes, 0) / STUDENTS.length).toFixed(1);
  const doneRate = Math.round(STUDENTS.filter((s) => s.tasks === 3).length / STUDENTS.length * 100);

  $("teacher-summary").innerHTML =
    '<span class="ts-item">完成率 <b>' + doneRate + '%</b></span>' +
    '<span class="ts-item">平均停留 <b>' + avgMin + ' 分钟</b></span>' +
    '<span class="ts-item">共提出 <b>' + totalQ + ' 个问题</b></span>' +
    '<span class="ts-item">高频疑问 <b>为什么是黄洋界</b></span>';

  const stats = $("tch-stats");
  if (stats) {
    stats.innerHTML =
      '<div class="tch-stat"><b>' + STUDENTS.length + '</b><span>在册学生</span></div>' +
      '<div class="tch-stat"><b>' + doneRate + '%</b><span>任务完成率</span></div>' +
      '<div class="tch-stat"><b>' + avgMin + '</b><span>平均停留 分钟</span></div>';
  }

  // 高频提问：给老师的「下一次讲什么」
  const HOT = [
    { q: "为什么是黄洋界？", n: 9 },
    { q: "红军当时吃什么？", n: 6 },
    { q: "这场仗怎么打赢的？", n: 5 },
    { q: "朱德为什么挑粮？", n: 3 }
  ];
  const hotBox = $("tch-hot");
  if (hotBox) {
    const max = HOT[0].n;
    hotBox.innerHTML = HOT.map((h, i) =>
      '<div class="tch-hot-row">' +
        '<span class="tch-hot-q">' + h.q + '</span>' +
        '<span class="tch-hot-bar"><i style="width:' + Math.round(h.n / max * 100) + '%;background:' +
          (i === 0 ? "linear-gradient(90deg,#A62B2E,#D0715A)" : "linear-gradient(90deg,#2B3F5C,#5A7EA6)") +
        '"></i></span>' +
        '<span class="tch-hot-n">' + h.n + '</span>' +
      '</div>'
    ).join("");
  }
}

function exportTeacherReport() {
  if (typeof html2canvas === "undefined") { toast("当前离线，请用系统截图保存"); return; }
  html2canvas($("teacher-export"), { scale: 2, backgroundColor: "#fff", useCORS: true })
    .then((canvas) => {
      $("save-img").src = canvas.toDataURL("image/png");
      $("save-modal").classList.add("show");
    })
    .catch(() => toast("生成图片失败，请用系统截图保存"));
}

/* ---------- 演示数据种子 ----------
   只在 ?demo=1 时执行：让报告页 / 教师端有内容可看，截图不出空状态。 */
function seedDemo() {
  saveUser("赵杰", "东华理工大学");
  const st = defaultState();
  st.tasks = { t1: true, t2: true, t3: true };
  st.task2Reason = "山高路陡，敌人兵再多也展不开；红军又连夜布了竹钉阵，老乡还帮着送粮、抬担架。装备差得远，是地形和人心补上了。";
  st.questions = ["这场仗是怎么打赢的？", "为什么叫「黄洋界上炮声隆」？", "红军当时吃什么？"];
  st.enterTime = Date.now() - 32 * 60 * 1000; // 停留 32 分钟
  saveState(st);
}

/* 对话页：预置一轮真实史料问答（内容取自 FALLBACK.qa，不编造） */
function seedChat() {
  const hint = $("chat-hint");
  if (hint) hint.remove();
  const q1 = FALLBACK.qa[0], q2 = FALLBACK.qa[1];
  addUserMsg(q1.q);
  addAiMsg("讲解员", q1.a, [q1.source], false);
  addUserMsg("那门炮为什么只打了三发？");
  addAiMsg("讲解员", q2.a, [q2.source], false);
  // 演示截图从头看：完整一轮问答 + 第二轮提问
  const box = $("chat-body");
  if (box) box.scrollTop = 0;
}

/* ---------- 事件 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (EMBED) document.body.classList.add("embed");
  if (DEMO) seedDemo();
  if (!getUser()) $("onboard").classList.add("show");

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) { showView(nav.getAttribute("data-nav")); return; }

    const chip = e.target.closest("[data-role]");
    if (chip) {
      currentRole = chip.getAttribute("data-role");
      document.querySelectorAll("[data-role]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      addSystem("已切换为「" + currentRole + "」角色");
      return;
    }

    const sugg = e.target.closest("[data-q]");
    if (sugg) { sendQuestion(sugg.getAttribute("data-q")); return; }

    const opt = e.target.closest(".task-option");
    if (opt) {
      document.querySelectorAll(".task-option").forEach((o) => o.classList.remove("selected"));
      opt.classList.add("selected");
      return;
    }
  });

  // V1
  $("btn-start").addEventListener("click", () => {
    if (!ensureOnboard()) return;
    showView("point");
  });
  $("btn-home-brief").addEventListener("click", () => {
    $("guide-text").textContent = FALLBACK.guide;
    $("guide-modal").classList.add("show");
  });
  $("btn-onboard").addEventListener("click", () => {
    const name = $("inp-name").value.trim();
    const school = $("inp-school").value.trim() || "—";
    if (!name) { toast("请先填写姓名"); return; }
    saveUser(name, school);
    $("onboard").classList.remove("show");
    toast("你好，" + name + "同学");
  });

  // V2 讲解词
  $("btn-brief").addEventListener("click", () => {
    $("guide-text").textContent = FALLBACK.guide;
    $("guide-modal").classList.add("show");
  });
  $("guide-close").addEventListener("click", () => $("guide-modal").classList.remove("show"));
  $("guide-mask").addEventListener("click", () => $("guide-modal").classList.remove("show"));

  // V3 发送
  $("chat-send").addEventListener("click", () => {
    const input = $("chat-input");
    sendQuestion(input.value);
    input.value = "";
  });
  $("chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); sendQuestion(e.target.value); e.target.value = ""; }
  });

  // V4 任务
  $("btn-photo").addEventListener("click", () => $("photo-input").click());
  $("photo-input").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement("img");
      img.src = reader.result;
      const prev = $("photo-preview");
      prev.innerHTML = "";
      prev.appendChild(img);
      prev.hidden = false;
      markTask("t1", true);
      toast("已上传，任务一完成");
    };
    reader.readAsDataURL(f);
  });

  $("task-reason").addEventListener("input", (e) => autoGrow(e.target));

  $("btn-t2").addEventListener("click", () => {    const st = getState();
    if (st.tasks.t2) return;
    const t2 = TASKS[1];
    const sel = document.querySelector(".task-option.selected");
    const status = $("status-t2");
    if (!sel) { status.textContent = "请先选择一个选项"; status.className = "task-status err"; return; }
    const choice = parseInt(sel.getAttribute("data-opt"), 10);
    const reason = $("task-reason").value.trim();
    if (choice !== t2.answer) {
      status.textContent = "再想想：红军当时的装备明显不如敌军";
      status.className = "task-status err";
      return;
    }
    if (reason.length < t2.reasonMinLen) {
      status.textContent = "理由至少写 " + t2.reasonMinLen + " 字（当前 " + reason.length + " 字）";
      status.className = "task-status err";
      return;
    }
    st.task2Reason = reason;
    saveState(st);
    markTask("t2", true);
  });

  $("btn-t3").addEventListener("click", () => {
    const st = getState();
    if (st.tasks.t3) return;
    const order = [...document.querySelectorAll("#task-order .sort-item")].map((el) => parseInt(el.getAttribute("data-order"), 10));
    const correct = TASKS[2].events.map((_, i) => i);
    const ok = order.length === correct.length && order.every((v, i) => v === correct[i]);
    const status = $("status-t3");
    if (!ok) {
      status.textContent = "顺序不对，再试试（时间越早越靠前）";
      status.className = "task-status err";
      return;
    }
    markTask("t3", true);
  });

  // V5 报告
  $("btn-report").addEventListener("click", () => {
    const st = getState();
    if (!(st.tasks.t1 && st.tasks.t2 && st.tasks.t3)) return;
    renderReport();
    showView("report");
  });
  $("btn-save").addEventListener("click", saveReportImage);
  $("save-close").addEventListener("click", () => $("save-modal").classList.remove("show"));
  $("save-mask").addEventListener("click", () => $("save-modal").classList.remove("show"));

  // V6 教师端
  $("btn-export").addEventListener("click", exportTeacherReport);

  // 教师端：/ #/teacher，或 ?view=teacher
  if (FORCE_VIEW) {
    showView(FORCE_VIEW);
    if (FORCE_VIEW === "chat" && DEMO) seedChat();
  } else if (location.hash === "#/teacher") {
    showView("teacher");
  }
});
