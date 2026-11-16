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

  // 演示用的超纲题，在线离线都会拒答；标明是演示，不冒充真实提问
  var REDLINE_Q = "评价一下当时的红军将领";

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
      clear: $("btn-clear-chat"),
      speechToggle: $("speech-toggle"),
      speechAuto: $("speech-auto")
    };
    initSpeech();
  }

  function initSpeech() {
    var S = DZHT.core.speech;
    if (!S || !S.supported() || !S.hasChineseVoice()) return;
    if (C.el.speechToggle) C.el.speechToggle.hidden = false;
    if (C.el.speechAuto) {
      C.el.speechAuto.checked = S.isAuto();
      C.el.speechAuto.addEventListener("change", function () {
        S.unlock(); // checkbox 的 change 也是用户手势，顺手解锁
        S.setAuto(this.checked);
        if (!this.checked) S.cancel();
        DZHT.core.toast(this.checked ? "已开启自动朗读" : "已关闭自动朗读");
      });
    }
    var unlockOnce = function () {
      S.unlock();
      document.removeEventListener("touchend", unlockOnce, true);
      document.removeEventListener("click", unlockOnce, true);
    };
    document.addEventListener("touchend", unlockOnce, true);
    document.addEventListener("click", unlockOnce, true);
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
    // 390px 屏幕放 4 个 chip 会把最后一个挤出滚动区，红线按钮要点得到所以放首位
    var list = (p && p.offline) ? p.offline.slice(0, 2) : [];
    C.el.sugg.innerHTML =
      '<button class="sugg sugg-redline" data-redline="1" title="演示：看系统如何守住史料边界">⚑ 试试红线题</button>' +
      list.map(function (q) {
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
    d.innerHTML = html;
    C.el.body.appendChild(d);

    var bubble = d.querySelector(".bubble");
    if (animate && !DZHT.core.motion.reduceMotion) {
      DZHT.core.motion.type(bubble, text, { speed: 18, onDone: function () {
        attachMsgTools(d, text, sources, refusal);
        maybeAutoSpeak(text, refusal);
      }});
    } else {
      bubble.textContent = text;
      attachMsgTools(d, text, sources, refusal);
      maybeAutoSpeak(text, refusal);
    }
    scrollChat();
    return d;
  }

  // 回答下方的依据 chip 和朗读按钮
  function attachMsgTools(d, text, sources, refusal) {
    var box = document.createElement("div");
    box.className = "msg-tools";

    // 按 source 反查本地语料，不用改后端返回结构
    if (!refusal && sources && sources.length) {
      var srcWrap = document.createElement("div");
      srcWrap.className = "msg-sources";
      var label = document.createElement("span");
      label.className = "ms-label";
      label.textContent = "依据 · 点击看原文";
      srcWrap.appendChild(label);
      sources.forEach(function (s) {
        var doc = findSourceDoc(s);
        var chip = document.createElement("button");
        chip.className = "src-chip";
        chip.type = "button";
        chip.textContent = (doc && doc.title) ? doc.title : String(s);
        chip.setAttribute("data-src-title", (doc && doc.title) || String(s));
        chip.addEventListener("click", function () { openSourceCard(doc, s); });
        srcWrap.appendChild(chip);
      });
      box.appendChild(srcWrap);
    }

    // 朗读按钮：能力检测通过才渲染
    var S = DZHT.core.speech;
    if (S && S.supported() && S.hasChineseVoice() && text) {
      var spk = document.createElement("button");
      spk.className = "speak-btn";
      spk.type = "button";
      spk.innerHTML = '<span class="spk-ico" aria-hidden="true">▶</span><span class="spk-txt">朗读</span>';
      spk.addEventListener("click", function () {
        S.unlock();
        if (S.isSpeaking()) {
          S.cancel();
          spk.classList.remove("speaking");
          spk.querySelector(".spk-txt").textContent = "朗读";
          return;
        }
        spk.classList.add("speaking");
        spk.querySelector(".spk-txt").textContent = "停止";
        S.speak(text, function () {
          spk.classList.remove("speaking");
          spk.querySelector(".spk-txt").textContent = "朗读";
        });
      });
      box.appendChild(spk);
    }

    if (box.children.length) {
      d.querySelector(".bubble").after(box);
      scrollChat();
    }
  }

  function maybeAutoSpeak(text, refusal) {
    var S = DZHT.core.speech;
    if (S && S.isAuto() && S.supported() && !refusal && text) S.speak(text);
  }

  /** 用来源字符串反查语料条目（source 字段完全相等，或互相包含） */
  function findSourceDoc(src) {
    var corpus = (C.data && C.data.corpus) || [];
    var s = String(src || "");
    for (var i = 0; i < corpus.length; i++) {
      if (corpus[i].source === s) return corpus[i];
    }
    for (var j = 0; j < corpus.length; j++) {
      var cs = String(corpus[j].source || "");
      if (cs && (cs.indexOf(s) >= 0 || s.indexOf(cs) >= 0) && s.length > 6) return corpus[j];
    }
    return null;
  }

  function openSourceCard(doc, srcFallback) {
    var title = (doc && doc.title) || "史料原文";
    var source = (doc && doc.source) || String(srcFallback || "");
    var year = (doc && doc.year) || "—";
    var text = (doc && doc.text) || "（本地语料中未找到可展示的原文）";
    var url = (doc && doc.sourceUrl) || "";
    var modal = $("source-modal");
    if (!modal) return;
    $("src-card-title").textContent = title;
    $("src-card-source").textContent = source;
    $("src-card-year").textContent = String(year);
    $("src-card-text").textContent = text;
    var a = $("src-card-link");
    if (url && /^https?:\/\//.test(url)) {
      a.href = url;
      a.hidden = false;
    } else {
      a.removeAttribute("href");
      a.hidden = true;
    }
    modal.classList.add("show");
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
    if (res.refusal) {
      addRefusalExplain();
    } else if (res.mode === "offline" || res.mode === "offline-spoken" || res.mode === "offline-retrieval") {
      addSystem("当前为离线讲解模式（回答来自已审核史料库）");
    }
    C.busy = false;
  }

  function addRefusalExplain() {
    var d = document.createElement("div");
    d.className = "refusal-explain";
    d.innerHTML =
      '<div class="re-head"><span class="re-flag">⚑</span><b>为什么它不回答？</b>' +
      '<button class="re-close" aria-label="收起">×</button></div>' +
      '<div class="re-body">红色内容的史实错误不只是产品缺陷，而是政治风险。<br />' +
      '红途只从已审核史料取材；涉及人物评价、景区服务、无史料依据的推演，一律拒答。<br />' +
      '<span class="re-from">—— 项目计划书 · 内容安全约束</span></div>';

    // 换个问法：用本点位有史料支撑的问题，把拒答引导到能答的范围
    var p = currentPoint();
    var near = (p && p.offline) ? p.offline.slice(0, 3) : [];
    if (near.length) {
      var box = document.createElement("div");
      box.className = "re-next";
      box.innerHTML = '<div class="re-next-title">换个问法，这些我能答：</div>' +
        near.map(function (q) {
          return '<button class="re-next-q" data-q="' + esc(q) + '">' + esc(q) + '</button>';
        }).join("");
      box.addEventListener("click", function (e) {
        var b = e.target.closest("[data-q]");
        if (b) sendQuestion(b.getAttribute("data-q"));
      });
      d.appendChild(box);
    }

    d.querySelector(".re-close").addEventListener("click", function () { d.remove(); });
    C.el.body.appendChild(d);
    scrollChat();
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
      var red = e.target.closest("[data-redline]");
      if (red) {
        C.el.input.value = "";
        sendQuestion(REDLINE_Q);
        return;
      }
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
