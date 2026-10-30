/* =========================================================================
 * 大展红途 v2 · 核心层 · 路由与视图转场
 *
 * v1 的视图切换是 showView() 里直接改 class，没有任何转场、没有历史栈、
 * 不能后退。现在补上：
 *   - hash 路由（可后退、可分享链接）
 *   - 前进/后退的方向感知转场（push / pop）
 *   - 视图生命周期钩子（enter / leave / update）
 *   - 转场期间禁用重复点击
 * ========================================================================= */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var views = {};      // name -> { el, onEnter, onLeave, onUpdate }
  var current = null;
  var history = [];    // 路由栈，用于判断前进还是后退
  var transitioning = false;

  /**
   * 注册一个视图。
   * @param {string} name
   * @param {object} spec { el, onEnter(params), onLeave(), onUpdate(params) }
   */
  function register(name, spec) {
    views[name] = spec;
  }

  function getView(name) { return views[name]; }

  /**
   * 解析 hash 为路由。
   * 格式：#/view?key=value&key2=value2
   * 用具名参数而不是位置参数 —— 视图读 params.id / params.point 一目了然，
   * 也不会因为参数顺序变化而错位（位置参数曾导致点位页永远取不到 id）。
   */
  function parseHash() {
    var h = (root.location.hash || "").replace(/^#\/?/, "");
    if (!h) return { name: "home", params: {} };

    var qi = h.indexOf("?");
    var pathPart = qi >= 0 ? h.slice(0, qi) : h;
    var queryPart = qi >= 0 ? h.slice(qi + 1) : "";

    var name = pathPart.split("/").filter(Boolean)[0] || "home";

    var params = {};
    if (queryPart) {
      queryPart.split("&").forEach(function (pair) {
        if (!pair) return;
        var eq = pair.indexOf("=");
        var k = eq >= 0 ? pair.slice(0, eq) : pair;
        var v = eq >= 0 ? pair.slice(eq + 1) : "";
        try { params[decodeURIComponent(k)] = decodeURIComponent(v); }
        catch (e) { params[k] = v; }
      });
    }
    return { name: name, params: params };
  }

  function buildHash(name, params) {
    var keys = Object.keys(params || {}).filter(function (k) {
      var v = params[k];
      return v != null && v !== "";
    }).sort();
    if (!keys.length) return "#/" + name;
    var qs = keys.map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]);
    }).join("&");
    return "#/" + name + "?" + qs;
  }

  /**
   * 跳转。
   * @param {string} name
   * @param {object} params
   * @param {object} opts { replace:true 表示替换当前历史记录 }
   */
  function go(name, params, opts) {
    opts = opts || {};
    var hash = buildHash(name, params);
    if (root.location.hash === hash) {
      // 相同路由也要刷新视图
      render(name, params, "push");
      return;
    }
    if (opts.replace) {
      root.location.replace(hash);
    } else {
      root.location.hash = hash;
    }
  }

  function back() {
    if (root.history && root.history.length > 1) root.history.back();
    else go("home");
  }

  /**
   * 渲染视图。dir: push（前进）| pop（后退）| replace
   */
  function render(name, params, dir) {
    var spec = views[name];
    if (!spec) {
      console.warn("[router] unknown view:", name);
      return;
    }
    if (transitioning) return;
    transitioning = true;

    var prev = current;
    var prevEl = prev ? prev.spec.el : null;
    var nextEl = spec.el;

    // 同一个视图但参数变了（例如点位页从黄洋界切到八角楼），
    // 也要走一次离场/入场，否则旧内容会留在屏幕上。
    var sameView = prev && prev.spec.el === nextEl;
    var paramsChanged = sameView && JSON.stringify(prev.params || {}) !== JSON.stringify(params || {});

    // 离场
    if (prev && (!sameView || paramsChanged) && prev.spec.onLeave) {
      try { prev.spec.onLeave(); } catch (e) { console.error(e); }
    }

    // 入场准备
    // 先同步「当前点位」：任何带 id 参数的路由都直接生效，
    // 让对话/任务/报告/AR 视图知道自己在讲哪个点位。
    // 不带 id 的路由（如 #/selftest）沿用上一次，不影响。
    if (params && params.id) {
      DZHT.core.store.setActivePoint(params.id);
    }

    if (spec.onUpdate) {
      try { spec.onUpdate(params || {}); } catch (e) { console.error(e); }
    }

    // DOM 切换
    if (prevEl && prevEl !== nextEl) {
      prevEl.classList.remove("active");
      prevEl.setAttribute("aria-hidden", "true");
    }
    nextEl.classList.add("active");
    nextEl.removeAttribute("aria-hidden");

    // 转场方向
    var forward = dir !== "pop";
    nextEl.classList.remove("enter-push", "enter-pop");
    void nextEl.offsetWidth; // 强制重排，重启动画
    nextEl.classList.add(forward ? "enter-push" : "enter-pop");

    current = { name: name, spec: spec, params: params || {} };

    // 入场回调
    if (spec.onEnter) {
      // 等一帧，确保元素已可见再触发内容渲染
      root.requestAnimationFrame(function () {
        try { spec.onEnter(params || {}); } catch (e) { console.error(e); }
        root.requestAnimationFrame(function () {
          nextEl.classList.remove("enter-push", "enter-pop");
          transitioning = false;
        });
      });
    } else {
      transitioning = false;
    }
  }

  function start() {
    root.addEventListener("hashchange", function () {
      var r = parseHash();
      var dir = "push";
      if (history.length && history[history.length - 1] === r.name) dir = "pop";
      history.push(r.name);
      render(r.name, r.params, dir);
      DZHT.core.store.setRoute(r.name, r.params);
    });

    var r = parseHash();
    history.push(r.name);
    DZHT.core.store.setRoute(r.name, r.params);
    render(r.name, r.params, "push");
  }

  /** 供外部直接改 hash 后强制重渲染（同名视图换参数时用） */
  function refresh() {
    var r = parseHash();
    render(r.name, r.params, "push");
    DZHT.core.store.setRoute(r.name, r.params);
  }

  function currentRoute() { return current ? { name: current.name, params: current.params } : null; }

  DZHT.core.router = {
    register: register,
    getView: getView,
    go: go,
    back: back,
    start: start,
    render: render,
    parseHash: parseHash,
    buildHash: buildHash,
    current: currentRoute
  };
})(typeof self !== "undefined" ? self : this);
