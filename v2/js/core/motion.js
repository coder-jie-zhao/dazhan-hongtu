/* =========================================================================
 * 大展红途 v2 · 核心层 · 动效引擎
 *
 * v1 全站只有 fade / rise 两套 CSS 动画，且没有任何交互反馈。
 * 这一层把常用动效做成统一 API：
 *   - ripple   按压涟漪
 *   - countTo  数字滚动
 *   - type     打字机（AI 回答逐字出现）
 *   - shake    错误抖动
 *   - pull     下拉刷新手势
 *   - swipe    横向滑动（点位信息卡、任务排序）
 *   - haptic   轻震动（支持的设备）
 *
 * 全部尊重 prefers-reduced-motion。
 * ========================================================================= */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var reduceMotion = root.matchMedia
    ? root.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------------------------------------------------------------------
   * 涟漪
   * ------------------------------------------------------------------- */
  function attachRipple(rootEl, selector) {
    var sel = selector || ".btn, .chip, .task-option, .card-tap, .point-card, .sugg";
    rootEl.addEventListener("pointerdown", function (e) {
      var target = e.target.closest(sel);
      if (!target || !rootEl.contains(target)) return;
      if (reduceMotion) return;
      var rect = target.getBoundingClientRect();
      var r = Math.max(rect.width, rect.height) * 0.55;
      var span = el("span", "ripple");
      span.style.width = span.style.height = r + "px";
      span.style.left = (e.clientX - rect.left - r / 2) + "px";
      span.style.top = (e.clientY - rect.top - r / 2) + "px";
      if (getComputedStyle(target).position === "static") target.style.position = "relative";
      target.appendChild(span);
      root.setTimeout(function () {
        span.classList.add("fade");
        root.setTimeout(function () { span.remove(); }, 320);
      }, 12);
    });
  }

  /* ---------------------------------------------------------------------
   * 数字滚动
   * ------------------------------------------------------------------- */
  function countTo(node, to, opts) {
    opts = opts || {};
    var dur = opts.duration || 900;
    var from = opts.from || 0;
    var suffix = opts.suffix || "";
    if (reduceMotion) { node.textContent = to + suffix; return; }
    var start = performance.now();
    function frame(t) {
      var p = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * eased) + suffix;
      if (p < 1) root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }

  /* ---------------------------------------------------------------------
   * 打字机
   * ------------------------------------------------------------------- */
  function type(node, text, opts) {
    opts = opts || {};
    var speed = opts.speed || 16;          // ms/字
    var onDone = opts.onDone || function () {};
    var cursor = opts.cursor !== false;
    if (cursor && !node.querySelector(".type-cursor")) {
      node.appendChild(el("span", "type-cursor"));
    }
    if (reduceMotion) {
      node.textContent = text;
      if (cursor) node.appendChild(el("span", "type-cursor"));
      onDone();
      return { cancel: function () {} };
    }
    var i = 0;
    var cancelled = false;
    var timer = null;
    function step() {
      if (cancelled) return;
      i++;
      node.textContent = text.slice(0, i);
      if (i >= text.length) {
        onDone();
        return;
      }
      timer = root.setTimeout(step, speed);
    }
    timer = root.setTimeout(step, 0);
    return {
      cancel: function () {
        cancelled = true;
        if (timer) root.clearTimeout(timer);
      },
      skip: function () {
        cancelled = true;
        if (timer) root.clearTimeout(timer);
        node.textContent = text;
        onDone();
      }
    };
  }

  /* ---------------------------------------------------------------------
   * 抖动 / 轻震动
   * ------------------------------------------------------------------- */
  function shake(node) {
    if (!node) return;
    node.classList.remove("shake");
    void node.offsetWidth;
    node.classList.add("shake");
    root.setTimeout(function () { node.classList.remove("shake"); }, 520);
  }

  function haptic(ms) {
    if (reduceMotion) return;
    if (navigator.vibrate) { try { navigator.vibrate(ms || 12); } catch (e) { /* ignore */ } }
  }

  /* ---------------------------------------------------------------------
   * 横向滑动（信息卡 carousel）
   * ------------------------------------------------------------------- */
  function carousel(track, opts) {
    opts = opts || {};
    var items = Array.prototype.slice.call(track.children);
    if (!items.length) return null;
    var index = 0;
    var startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;
    var perView = opts.perView || 1;

    function setIndex(i, animate) {
      index = Math.max(0, Math.min(items.length - perView, i));
      if (animate === false) track.style.transition = "none";
      track.style.transform = "translate3d(" + (-index * (100 / perView)) + "%,0,0)";
      if (animate === false) {
        void track.offsetWidth;
        track.style.transition = "";
      }
      if (opts.onChange) opts.onChange(index);
    }

    track.addEventListener("pointerdown", function (e) {
      dragging = true; decided = false; dx = 0;
      startX = e.clientX; startY = e.clientY;
    });

    track.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!decided) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
          decided = true;
          horizontal = Math.abs(dx) > Math.abs(dy);
          if (horizontal) track.classList.add("dragging");
        }
      }
      if (horizontal) {
        var pct = (-index * (100 / perView)) + (dx / track.clientWidth) * 100;
        track.style.transition = "none";
        track.style.transform = "translate3d(" + pct + "%,0,0)";
      }
    });

    function end() {
      if (!dragging) return;
      dragging = false;
      if (!horizontal) { dx = 0; return; }
      track.classList.remove("dragging");
      var w = track.clientWidth || 1;
      if (Math.abs(dx) > w * 0.18) {
        var dir = dx < 0 ? 1 : -1;
        var ni = index + dir;
        if (ni >= 0 && ni <= items.length - perView) {
          index = ni;
          haptic(8);
        }
      }
      setIndex(index, true);
      horizontal = false;
      dx = 0;
    }

    track.addEventListener("pointerup", end);
    track.addEventListener("pointercancel", end);
    track.addEventListener("pointerleave", end);

    setIndex(0, false);
    return {
      next: function () { if (index < items.length - perView) { index++; setIndex(index, true); } },
      prev: function () { if (index > 0) { index--; setIndex(index, true); } },
      goTo: function (i) { setIndex(i, true); },
      get index() { return index; }
    };
  }

  /* ---------------------------------------------------------------------
   * 拖拽排序（任务三）
   * ------------------------------------------------------------------- */
  function sortable(container, opts) {
    opts = opts || {};
    var drag = null;
    var placeholder = null;

    container.addEventListener("pointerdown", function (e) {
      var item = e.target.closest(opts.itemSelector || ".sort-item");
      if (!item) return;
      drag = item;
      item.classList.add("dragging");
      item.setPointerCapture && item.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    container.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var target = document.elementFromPoint(e.clientX, e.clientY);
      if (!target) return;
      var over = target.closest(opts.itemSelector || ".sort-item");
      if (!over || over === drag || !container.contains(over)) return;
      var rect = over.getBoundingClientRect();
      var before = (e.clientY < rect.top + rect.height / 2) ||
        (Math.abs(e.clientY - (rect.top + rect.height / 2)) < 12 && e.clientX < rect.left + rect.width / 2);
      if (before) container.insertBefore(drag, over);
      else over.insertAdjacentElement("afterend", drag);
      haptic(6);
    });

    function end() {
      if (!drag) return;
      drag.classList.remove("dragging");
      drag = null;
      if (opts.onChange) opts.onChange(Array.prototype.map.call(container.children, function (n) { return n.getAttribute("data-order"); }));
    }
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);
  }

  /* ---------------------------------------------------------------------
   * 骨架屏 → 内容 替换
   * ------------------------------------------------------------------- */
  function reveal(container, delay) {
    if (!container) return;
    container.classList.add("revealing");
    root.setTimeout(function () {
      container.classList.remove("skeleton");
      container.classList.remove("revealing");
    }, delay || 420);
  }

  DZHT.core.motion = {
    reduceMotion: reduceMotion,
    attachRipple: attachRipple,
    countTo: countTo,
    type: type,
    shake: shake,
    haptic: haptic,
    carousel: carousel,
    sortable: sortable,
    reveal: reveal
  };
})(typeof self !== "undefined" ? self : this);
