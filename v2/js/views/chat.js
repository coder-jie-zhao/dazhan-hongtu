/* =========================================================================
 * 大展红途 v2 · 视图 · AI 对话
 *
 * v1 的三处不足，这版补上：
 *   1. 没有「正在查阅史料」的过程反馈 —— 用户盯着空白等
 *   2. 回答是瞬间出现的，不真实
 *   3. 没有三角色并排对比 —— 计划书 2.4 说这是「三条认知路径」
 *
 * 另外：三角色并排对照（同一个问题，三种视角）是 v2 新增的关键交互，
 * 它把「三种身份」从一个切换器变成了一个可对比的产品特征。
 * ========================================================================= */
(function (root) {
  "use strict";
  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.views = DZHT.views || {};

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  var C = {
    data: null,
    role: "讲解员",
    busy: false,
    point: null,
    modeProbed: false,
    comparing: false,
    compareResults: null
  };

  function init(data) {
    C.data = data;
    C.el = {
      roleBar: $("role-bar"),
      aiMode: $("ai-mode"),
      aiModeText: $("ai-mode-text"),
      body: $("chat-body"),
      hint: $("chat-hint"),
      sugg: $("suggestions"),
      input: $("chat-input"),
      send: $("chat-send"),
      clear: $("btn-clear-chat")
    };
  }

  function pointById(id) {
    var pts = C.data.points;
    for (var i = 0; i < pts.length; i++) if (pts[i].id === id) return pts[i];
    return null;
  }

  /**
   * 当前点位。优先级：
   *   1. store 里的 activePointId（由路由参数写入，最权威）
   *   2. 点位页上次渲染过的点位（从点位页点进来时它是对的）
   *   3. 第一个点位（兜底）
   *
   * 不能只读第 2 条：刷新页面或直接打开 #/chat?id=xxx 时，
   * 点位页还没渲染过，会拿到错误点位。
   */
  function currentPoint() {
    var p = pointById(DZHT.core.store.getActivePointId());
    if (p) return p;
    p = DZHT.views.point.point();
    if (p) return p;
    return C.data.points[0];
  }

  /* ---------- 角色选择器 ---------- */
  function renderRoles() {
    C.el.roleBar.innerHTML = C.data.roles.map(function (r) {
      return '<button class="chip' + (r.name === C.role ? " active" : "") + '" data-role="' + r.name + '">' +
        '<span class="chip-mark">' + r.mark + '</span>' + r.name + '</button>';
    }).join("");
  }

  /* ---------- 推荐问题 ---------- */
  function renderSuggestions() {
    var p = currentPoint();
    var list = (p && p.offline) ? p.offline.slice(0, 3) : [];
    C.el.sugg.innerHTML = list.map(function (q) {
      return '<button class="sugg" data-q="' + esc(q) + '">' + esc(q) + '</button>';
    }).join("");
  }

  /* ---------- 在线/离线探测 ---------- */
  async function probeMode() {
    if (C.modeProbed) return;
    C.modeProbed = true;
    var box = C.el.aiMode, txt = C.el.aiModeText;
    if (!box || !txt) return;

    var d = await DZHT.core.net.health();
    if (d.mode === "online") {
      box.classList.add("online");
      txt.textContent = "在线模型 · " + (d.model || "已连接");
      box.title = "回答由真实模型生成，依据服务端已审核史料；超出史料范围会拒答";
    } else {
      box.classList.add("offline");
      txt.textContent = "离线讲解 · 预置史料";
      box.title = "未配置模型 key 或后端不可用；当前回答来自本地史料库与离线问答";
    }
  }

  /* ---------- 消息渲染 ---------- */
  function scrollChat() { C.el.body.scrollTop = C.el.body.scrollHeight; }

  function addSystem(text) {
    var d = document.createElement("div");
    d.className = "system-note";
    d.textContent = text;
    C.el.body.appendChild(d);
    scrollChat();
  }

  function addUserMsg(text) {
    var d = document.createElement("div");
    d.className = "msg user";
    d.innerHTML = '<div class="bubble">' + esc(text) + '</div>';
    C.el.body.appendChild(d);
    scrollChat();
  }

  function addAiMsg(role, text, sources, refusal, animate) {
    var r = roleInfo(role);
    var d = document.createElement("div");
    d.className = "msg ai" + (refusal ? " msg-refusal" : "");
    var html = '<div class="msg-meta">' +
      '<span class="msg-avatar" style="background:' + r.color + '">' + r.mark + '</span>' +
      '<span class="msg-name">' + esc(role) + '</span>' +
      '<span class="msg-view">' + esc(r.viewpoint) + '</span>' +
      '</div><div class="bubble"></div>';
    if (!refusal && sources && sources.length) {
      html += '<div class="msg-source">依据：' + esc(sources.join("、")) + '</div>';
    }
    d.innerHTML = html;
    C.el.body.appendChild(d);

    var bubble = d.querySelector(".bubble");
    if (animate && !DZHT.core.motion.reduceMotion) {
      DZHT.core.motion.type(bubble, text, { speed: 18 });
    } else {
      bubble.textContent = text;
    }
    scrollChat();
    return d;
  }

  function roleInfo(name) {
    for (var i = 0; i < C.data.roles.length; i++) if (C.data.roles[i].name === name) return C.data.roles[i];
    return C.data.roles[0];
  }

  function addRetrieving() {
    var d = document.createElement("div");
    d.className = "retrieving";
    d.id = "chat-retrieving";
    d.innerHTML = '<span class="spin"></span><span>正在查阅史料…</span>';
    C.el.body.appendChild(d);
    scrollChat();
  }
  function removeRetrieving() {
    var d = $("chat-retrieving");
    if (d) d.remove();
  }

  /* ---------- 提问 ---------- */
  async function sendQuestion(raw) {
    var text = String(raw || "").trim();
    if (!text || C.busy) return;
    C.busy = true;

    var hint = C.el.hint;
    if (hint) hint.remove();

    addUserMsg(text);

    // 记录提问（用于「主动探究」评分与报告）
    var store = DZHT.core.store;
    var p = currentPoint();
    var prog = store.getProgress(p.id);
    var qs = (prog.questions || []).concat([text]);
    if (qs.length > 12) qs = qs.slice(-12);
    store.setProgress(p.id, { questions: qs });

    addRetrieving();

    var offlineQA = {
      qa: (C.data.offlineQA && C.data.offlineQA[p.id]) || [],
      offline: p.offline || []
    };

    var res = await DZHT.core.net.ask(
      text, C.role, p.id, C.data.corpus, offlineQA, p.name,
      function (stage) {
        if (stage === "connecting") {
          var el = $("chat-retrieving");
          if (el) el.querySelector("span:last-child").textContent = "正在查阅史料…";
        } else if (stage === "fallback") {
          var el2 = $("chat-retrieving");
          if (el2) el2.querySelector("span:last-child").textContent = "网络不稳定，切换离线史料…";
        }
      }
    );

    removeRetrieving();
    // 来源去重：同一份出处可能被多条语料引用，重复显示会让评委以为答非所问
    var uniqSources = [];
    (res.sources || []).forEach(function (s) {
      if (s && uniqSources.indexOf(s) < 0) uniqSources.push(s);
    });
    addAiMsg(C.role, res.answer, uniqSources, res.refusal, true);
    if (res.mode === "offline" && !res.refusal) {
      addSystem("当前为离线讲解模式（回答来自已审核史料库）");
    }
    C.busy = false;
  }

  /* ---------- 三角色并排对比 ---------- */
  async function compareAll() {
    if (C.busy || C.comparing) return;
    var p = currentPoint();
    var q = C.el.input.value.trim();
    if (!q) {
      addSystem("先在输入框写一个问题，再点「三角色对照」");
      return;
    }
    C.busy = true;
    C.comparing = true;
    C.el.hint && C.el.hint.remove();
    addUserMsg(q);

    var store = DZHT.core.store;
    var prog = store.getProgress(p.id);
    var qs = (prog.questions || []).concat([q]);
    store.setProgress(p.id, { questions: qs.slice(-12) });

    addRetrieving();
    var results = [];
    for (var i = 0; i < C.data.roles.length; i++) {
      var role = C.data.roles[i];
      var offlineQA = {
        qa: (C.data.offlineQA && C.data.offlineQA[p.id]) || [],
        offline: p.offline || []
      };
      var res = await DZHT.core.net.ask(q, role.name, p.id, C.data.corpus, offlineQA, p.name);
      results.push({ role: role, answer: res.answer, sources: res.sources, refusal: res.refusal });
    }
    removeRetrieving();

    // 并排卡片
    var wrap = document.createElement("div");
    wrap.className = "compare-grid";
    wrap.innerHTML = results.map(function (r) {
      return '<div class="compare-cell">' +
        '<div class="compare-head">' +
          '<span class="msg-avatar" style="background:' + r.role.color + '">' + r.role.mark + '</span>' +
          '<div><div class="compare-name">' + esc(r.role.name) + '</div>' +
          '<div class="compare-view">' + esc(r.role.viewpoint) + '</div></div>' +
        '</div>' +
        '<div class="compare-body' + (r.refusal ? " is-refusal" : "") + '">' + esc(r.answer) + '</div>' +
        (r.sources && r.sources.length ? '<div class="compare-src">' + esc(r.sources[0]) + '</div>' : '') +
      '</div>';
    }).join("");
    C.el.body.appendChild(wrap);
    scrollChat();

    addSystem("三种身份、三条认知路径 —— 同一个问题，三个切面");
    C.busy = false;
    C.comparing = false;
  }

  /* ---------- 交互 ---------- */
  function bind() {
    C.el.roleBar.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-role]");
      if (!chip) return;
      C.role = chip.getAttribute("data-role");
      C.el.roleBar.querySelectorAll(".chip").forEach(function (c) {
        c.classList.toggle("active", c.getAttribute("data-role") === C.role);
      });
      DZHT.core.motion.haptic(8);
      addSystem("已切换为「" + C.role + "」" + roleInfo(C.role).intro);
    });

    C.el.sugg.addEventListener("click", function (e) {
      var s = e.target.closest("[data-q]");
      if (!s) return;
      sendQuestion(s.getAttribute("data-q"));
    });

    C.el.send.addEventListener("click", function () {
      var v = C.el.input.value;
      C.el.input.value = "";
      sendQuestion(v);
    });

    C.el.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var v = C.el.input.value;
        C.el.input.value = "";
        sendQuestion(v);
      }
    });

    C.el.clear.addEventListener("click", function () {
      C.el.body.innerHTML = "";
      var store = DZHT.core.store;
      var p = currentPoint();
      store.setProgress(p.id, { questions: [] });
      addSystem("对话已清空");
    });

    // 长按输入框 → 三角色对照
    var pressTimer = null;
    C.el.input.addEventListener("pointerdown", function () {
      pressTimer = setTimeout(compareAll, 800);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      C.el.input.addEventListener(ev, function () { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } });
    });
  }

  DZHT.views.chat = {
    init: init,
    bind: bind,
    onEnter: function () {
      renderRoles();
      renderSuggestions();
      probeMode();
      if (!C.el.hint) {
        var h = document.createElement("div");
        h.className = "chat-hint";
        h.innerHTML = '<p class="title-sm">选一个身份，问问当年的事。</p>' +
          '<p class="tiny dimmer mt-2">每个回答下方都会标出史料出处。超出已审核史料范围的问题，它会直接拒答。</p>';
        C.el.body.appendChild(h);
        C.el.hint = h;
      }
    }
  };
})(typeof self !== "undefined" ? self : this);
