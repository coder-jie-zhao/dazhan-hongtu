/* =========================================================================
 * 大展红途 v2 · 视图 · 现场任务
 *
 * v1 只有三题（看/想/理），计划书 2.1 动线里 9:15 的「写下自述」不存在。
 * v2 补上第四题「说」，并且任务单是**按点位 + 学段动态生成**的，
 * 不是写死的那一份。
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

  var C = { data: null, plan: null, point: null, inited: false };

  function init(data) {
    C.data = data;
    C.el = {
      progress: $("task-progress"),
      body: $("task-body"),
      report: $("btn-report"),
      badge: $("task-grade-badge")
    };
  }

  function pointById(id) {
    var pts = C.data.points;
    for (var i = 0; i < pts.length; i++) if (pts[i].id === id) return pts[i];
    return null;
  }

  /** 当前点位：优先用路由参数写入的 activePointId，其次点位页状态，最后兜底 */
  function currentPoint() {
    var p = pointById(DZHT.core.store.getActivePointId());
    if (p) return p;
    p = DZHT.views.point.point();
    if (p) return p;
    return C.data.points[0];
  }

  function currentGrade() {
    var user = DZHT.core.store.getUser();
    return (user && user.grade) || "junior";
  }

  /* ---------- 生成任务单 ---------- */
  function buildPlan() {
    var p = currentPoint();
    C.point = p;
    C.plan = DZHT.domain.tasks.generate(C.data, p.id, currentGrade());
    return C.plan;
  }

  /* ---------- 渲染 ---------- */
  function render() {
    var plan = buildPlan();
    var store = DZHT.core.store;
    var prog = store.getProgress(C.point.id);

    C.el.badge.textContent = plan.grade.name;

    // 进度条
    C.el.progress.innerHTML = plan.items.map(function (item, i) {
      var done = isDone(item, prog);
      var cls = done ? "done" : (i === firstUndone(plan, prog) ? "current" : "");
      return '<span class="tprog-item ' + cls + '" data-i="' + i + '">' +
        (i + 1) + " · " + esc(item.verb) + '</span>';
    }).join("");

    // 任务卡
    C.el.body.innerHTML = plan.items.map(function (item, i) {
      // stage 与 verb 常常是同一个字（都是「看」），只显示一次，别出现「看／看」
      var tagExtra = item.stage && item.stage !== item.verb
        ? '<span class="tcat">／' + esc(item.verb) + '</span>'
        : "";
      return '<div class="task-card" id="task-' + item.id + '" data-task="' + item.id + '">' +
        '<div class="task-tag">' + esc(item.category) + ' · ' + esc(item.stage) + tagExtra + '</div>' +
        '<h3 class="task-title">' + esc(item.title) + '</h3>' +
        (item.desc ? '<p class="task-desc">' + esc(item.desc) + '</p>' : "") +
        (item.question ? '<p class="task-q">' + esc(item.question) + '</p>' : "") +
        '<div class="task-why">' + esc(item.rationale) + '</div>' +
        renderBody(item, prog) +
        '<div class="task-status" id="status-' + item.id + '"></div>' +
        // 拍照题上传即完成，不需要单独的提交按钮
        (item.type === "photo" || item.type === "text" ? "" : '<button class="btn btn-primary btn-sm" data-submit="' + item.id + '">提交</button>') +
      '</div>';
    }).join("");

    // 恢复已填状态
    plan.items.forEach(function (item) {
      restore(item, prog);
    });

    updateReportBtn();
  }

  function renderBody(item, prog) {
    if (item.type === "photo") {
      var shot = (prog.photos || {})[item.id];
      return '<button class="btn btn-secondary btn-sm" id="btn-photo-' + item.id + '">' +
        (shot ? "重新拍照" : "拍照上传") + '</button>' +
        '<input type="file" id="photo-input-' + item.id + '" accept="image/*" capture="environment" hidden />' +
        '<div class="photo-preview" id="preview-' + item.id + '"' + (shot ? "" : " hidden") + '>' +
        (shot ? '<img src="' + shot + '" alt="上传的现场照片" />' +
          '<button class="pp-del" aria-label="删除">×</button>' : "") +
        '</div>';
    }
    if (item.type === "choice") {
      return '<div class="task-options">' + item.options.map(function (o, i) {
        return '<button class="task-option" data-task="' + item.id + '" data-opt="' + i + '">' +
          '<span class="opt-key">' + String.fromCharCode(65 + i) + '</span>' + esc(o) + '</button>';
      }).join("") + '</div>' +
      '<textarea class="task-reason" id="reason-' + item.id + '" placeholder="说说你的理由（至少 ' +
      item.reasonMinLen + ' 字）" maxlength="200"></textarea>';
    }
    if (item.type === "order") {
      var shuffled = shuffleStable(item.events.map(function (_, i) { return i; }));
      return '<div class="task-order" id="order-' + item.id + '">' +
        shuffled.map(function (i) {
          return '<div class="sort-item" data-order="' + i + '">' +
            '<span class="sort-handle">≡</span>' +
            '<span class="sort-time">' + esc(item.events[i].t) + '</span>' +
            '<span class="sort-name">' + esc(item.events[i].e) + '</span>' +
          '</div>';
        }).join("") + '</div>';
    }
    if (item.type === "text") {
      return '<textarea class="task-text" id="text-' + item.id + '" placeholder="' +
        esc(item.placeholder) + '" maxlength="' + item.maxLen + '"></textarea>' +
        '<div class="row-between mt-2"><span class="micro dimmer" id="count-' + item.id + '">0 / ' + item.maxLen + ' 字</span>' +
        '<button class="btn btn-primary btn-sm" data-submit="' + item.id + '">写完了</button></div>';
    }
    return "";
  }

  function restore(item, prog) {
    if (item.type === "choice") {
      var ta = $("reason-" + item.id);
      if (ta && prog.reason) { ta.value = prog.reason; autoGrow(ta); }
      if (prog.choiceCorrect) {
        var opt = C.el.body.querySelector('[data-task="' + item.id + '"][data-opt="' + item.answer + '"]');
        if (opt) opt.classList.add("correct");
      }
    }
    if (item.type === "order" && prog.orderCorrect) {
      var wrap = $("order-" + item.id);
      if (wrap) {
        var byOrder = {};
        wrap.querySelectorAll(".sort-item").forEach(function (el) { byOrder[el.getAttribute("data-order")] = el; });
        wrap.innerHTML = "";
        item.events.forEach(function (_, i) { if (byOrder[String(i)]) wrap.appendChild(byOrder[String(i)]); });
      }
    }
    if (item.type === "text" && prog.selfText) {
      var t = $("text-" + item.id);
      if (t) { t.value = prog.selfText; autoGrow(t); updateCount(item); }
    }
  }

  function isDone(item, prog) {
    if (item.type === "photo") return !!(prog.tasks && prog.tasks[item.id]);
    if (item.type === "choice") return !!prog.choiceCorrect;
    if (item.type === "order") return !!prog.orderCorrect;
    // 自述题的门槛必须与本题的 minLen 一致（初中 15 字 / 高中 20 字）。
    // 写死 20 会导致初中生写满 15 字能提交、却判不过，报告按钮永远不解锁。
    if (item.type === "text") {
      var need = item.minLen || 20;
      return (prog.selfText || "").trim().length >= need;
    }
    return false;
  }

  function firstUndone(plan, prog) {
    for (var i = 0; i < plan.items.length; i++) if (!isDone(plan.items[i], prog)) return i;
    return -1;
  }

  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight + 2, 180) + "px";
  }

  /**
   * 把图片压缩成最大边 maxSize 的 JPEG dataURL。
   *
   * 为什么要压：手机直出照片动辄 5–10MB，原样转成 dataURL 会是十几 MB 的字符串，
   * 塞进 DOM 会卡、存进 localStorage 会直接爆配额（通常 5MB）。
   * 压到 720px / q0.72 后约 60–90KB，清晰度足够看清"学生确实在现场拍了张照"。
   *
   * @returns {Promise<string>} dataURL
   */
  function compressImage(file, maxSize, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read fail")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("decode fail")); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width;
            var h = img.naturalHeight || img.height;
            if (!w || !h) { reject(new Error("empty image")); return; }

            var scale = Math.min(1, maxSize / Math.max(w, h));
            var cw = Math.round(w * scale);
            var ch = Math.round(h * scale);

            var canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext("2d");
            // 白底：PNG 透明图转 JPEG 后透明区会变黑，先铺白
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);

            resolve(canvas.toDataURL("image/jpeg", quality || 0.72));
          } catch (e) {
            reject(e);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function updateCount(item) {
    var c = $("count-" + item.id);
    var t = $("text-" + item.id);
    if (c && t) c.textContent = t.value.length + " / " + item.maxLen + " 字";
  }

  function updateReportBtn() {
    var prog = DZHT.core.store.getProgress(C.point.id);
    var all = C.plan.items.every(function (i) { return isDone(i, prog); });
    C.el.report.disabled = !all;
    C.el.report.classList.toggle("ready", all);
    C.el.report.textContent = all ? "生成我的研学报告" : "完成全部 " + C.plan.items.length + " 项任务后解锁";
  }

  function markDone(itemId, patch) {
    var store = DZHT.core.store;
    var prog = store.getProgress(C.point.id);
    var tasks = Object.assign({}, prog.tasks);
    tasks[itemId] = true;
    patch = patch || {};
    patch.tasks = tasks;
    patch.done = C.plan.items.every(function (i) { return isDone(i, Object.assign({}, prog, patch)); });
    store.setProgress(C.point.id, patch);
    render();
  }

  function setStatus(itemId, text, kind) {
    var el = $("status-" + itemId);
    if (!el) return;
    el.textContent = text;
    el.className = "task-status " + (kind || "");
  }

  /* ---------- 交互 ---------- */
  function bind() {
    // 选项选择
    C.el.body.addEventListener("click", function (e) {
      var opt = e.target.closest(".task-option");
      if (opt) {
        var tid = opt.getAttribute("data-task");
        C.el.body.querySelectorAll('.task-option[data-task="' + tid + '"]').forEach(function (o) {
          o.classList.remove("selected");
        });
        opt.classList.add("selected");
        DZHT.core.motion.haptic(8);
        return;
      }

      // 拍照
      var photoBtn = e.target.closest("[id^='btn-photo-']");
      if (photoBtn) {
        var pid = photoBtn.id.replace("btn-photo-", "");
        var input = $("photo-input-" + pid);
        if (input) input.click();
        return;
      }

      // 提交
      var submit = e.target.closest("[data-submit]");
      if (submit) {
        submitTask(submit.getAttribute("data-submit"));
      }
    });

    // 文件上传
    C.el.body.addEventListener("change", function (e) {
      var input = e.target.closest("input[type='file']");
      if (!input) return;
      var f = input.files && input.files[0];
      if (!f) return;
      var tid = input.id.replace("photo-input-", "");
      input.value = ""; // 允许重复选同一张图

      // 手机直出照片常 5–10MB，原样塞进 page 会卡，也没必要（演示版不识别内容）
      if (f.size > 20 * 1024 * 1024) {
        setStatus(tid, "照片太大（超过 20MB），换一张或先压缩", "err");
        return;
      }

      setStatus(tid, "正在处理照片…", "");

      compressImage(f, 720, 0.72).then(function (dataUrl) {
        var prev = $("preview-" + tid);
        if (prev) {
          prev.innerHTML = '<img src="' + dataUrl + '" alt="上传的现场照片" />' +
            '<button class="pp-del" aria-label="删除">×</button>';
          prev.hidden = false;
        }
        // 缩略图存进进度：render() 重建 DOM 后还能恢复，
        // 学生不会遇到「照片一闪就没了」。720px JPEG 约 60–90KB，localStorage 放得下。
        var store = DZHT.core.store;
        var prog = store.getProgress(C.point.id);
        var photos = Object.assign({}, prog.photos || {});
        photos[tid] = dataUrl;
        store.setProgress(C.point.id, { photos: photos });
        markDone(tid);
        setStatus(tid, "✓ 已上传，任务完成", "ok");
        DZHT.core.motion.haptic(14);
      }).catch(function () {
        setStatus(tid, "这张图片读不出来，换一张试试", "err");
      });
    });

    // 输入
    C.el.body.addEventListener("input", function (e) {
      var ta = e.target.closest(".task-reason, .task-text");
      if (!ta) return;
      autoGrow(ta);
      var tid = ta.id.replace("reason-", "").replace("text-", "");
      updateCount({ id: tid, maxLen: ta.maxLength });
    });

    // 删除照片
    C.el.body.addEventListener("click", function (e) {
      var del = e.target.closest(".pp-del");
      if (!del) return;
      var card = del.closest(".task-card");
      if (card) {
        var tid = card.getAttribute("data-task");
        var store = DZHT.core.store;
        var prog = store.getProgress(C.point.id);
        var tasks = Object.assign({}, prog.tasks);
        delete tasks[tid];
        // 缩略图也要一起删，否则照片"删掉了"但重建后还在
        var photos = Object.assign({}, prog.photos || {});
        delete photos[tid];
        store.setProgress(C.point.id, { tasks: tasks, photos: photos });
        render();
      } else {
        var prev = del.closest(".photo-preview");
        if (prev) { prev.innerHTML = ""; prev.hidden = true; }
      }
    });

    // 拖拽排序
    C.el.body.addEventListener("pointerdown", function (e) {
      var order = e.target.closest(".task-order");
      if (!order) return;
      if (!order._bound) {
        order._bound = true;
        DZHT.core.motion.sortable(order, { itemSelector: ".sort-item" });
      }
    });
  }

  /* ---------- 提交判定 ---------- */
  function submitTask(itemId) {
    var item = null;
    for (var i = 0; i < C.plan.items.length; i++) if (C.plan.items[i].id === itemId) item = C.plan.items[i];
    if (!item) return;

    if (item.type === "choice") {
      var sel = C.el.body.querySelector('.task-option[data-task="' + itemId + '"].selected');
      if (!sel) { setStatus(itemId, "请先选择一个选项", "err"); return; }
      var choice = parseInt(sel.getAttribute("data-opt"), 10);
      var ta = $("reason-" + itemId);
      var reason = (ta ? ta.value : "").trim();

      if (choice !== item.answer) {
        // hintOnWrong 在语料里已经是完整措辞（如「再想想：山下的人为什么肯往山上送粮」），
        // 这里不能再拼一次前缀，否则会变成「再想想：再想想：…」
        setStatus(itemId, item.hintOnWrong || "答案不对，再想想。", "err");
        DZHT.core.motion.shake($("task-" + itemId));
        return;
      }
      if (reason.length < item.reasonMinLen) {
        setStatus(itemId, "理由至少写 " + item.reasonMinLen + " 字（当前 " + reason.length + " 字）", "err");
        return;
      }
      markDone(itemId, { choiceCorrect: true, reason: reason });
      setStatus(itemId, "✓ 回答正确，任务完成", "ok");
      DZHT.core.motion.haptic(16);
      return;
    }

    if (item.type === "order") {
      var wrap = $("order-" + itemId);
      var order = Array.prototype.map.call(wrap.querySelectorAll(".sort-item"), function (el) {
        return parseInt(el.getAttribute("data-order"), 10);
      });
      var correct = item.events.map(function (_, i) { return i; });
      var ok = order.length === correct.length && order.every(function (v, i2) { return v === correct[i2]; });
      if (!ok) {
        setStatus(itemId, "顺序不对，再试试（时间越早越靠前）", "err");
        DZHT.core.motion.shake($("task-" + itemId));
        return;
      }
      markDone(itemId, { orderCorrect: true });
      setStatus(itemId, "✓ 排序正确，任务完成", "ok");
      DZHT.core.motion.haptic(16);
      return;
    }

    if (item.type === "text") {
      var tx = $("text-" + itemId);
      var text = (tx ? tx.value : "").trim();
      var need = item.minLen || 20;
      if (text.length < need) {
        setStatus(itemId, "再多写几个字（至少 " + need + " 字），系统不判对错，只记录你的想法", "err");
        DZHT.core.motion.shake($("task-" + itemId));
        return;
      }
      markDone(itemId, { selfText: text });
      setStatus(itemId, "✓ 已记录。这段话会原样进入你的研学报告", "ok");
      DZHT.core.motion.haptic(16);
    }
  }

  function shuffleStable(arr) {
    // 固定打乱顺序（保证演示可复现）
    var seed = [2, 0, 3, 1, 3, 1, 2, 0];
    return arr.map(function (_, i) { return seed[i % seed.length] % arr.length; })
      .filter(function (v, i, a) { return a.indexOf(v) === i; });
  }

  DZHT.views.task = {
    init: init,
    bind: bind,
    onEnter: function () {
      render();
    },
    plan: function () { return C.plan; }
  };
})(typeof self !== "undefined" ? self : this);
