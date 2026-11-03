/* =========================================================================
 * 大展红途 v2 · 核心层 · 状态存储
 *
 * 一个极简的发布订阅 store。所有视图通过它读写状态，通过它订阅变化。
 * 没有框架，但有单一数据源 —— 这是 v1 最大的架构问题（状态散在 localStorage
 * 和各个闭包里，谁都能改，改了没人知道）。
 *
 * 持久化分两片：
 *   dzht_v2_user    —— 学生身份（姓名/学校/学段）
 *   dzht_v2_progress —— 学习进度（按点位分区）
 * ========================================================================= */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var USER_KEY = "dzht_v2_user";
  var PROGRESS_KEY = "dzht_v2_progress";

  /* localStorage 在 file:// 打开或隐私模式下可能直接抛异常，
     这里统一包一层：能用就用，不能用就退回内存，保证功能不中断。 */
  var MEM_STORE = {};

  function lsGet(k) {
    try { return root.localStorage.getItem(k); } catch (e) {
      return Object.prototype.hasOwnProperty.call(MEM_STORE, k) ? MEM_STORE[k] : null;
    }
  }
  function lsSet(k, v) {
    try { root.localStorage.setItem(k, v); } catch (e) { MEM_STORE[k] = v; }
  }

  var listeners = [];
  var state = {
    user: null,
    progress: {},
    route: { name: "home", params: {} },
    // 当前点位 id —— 由路由参数驱动，是各视图（对话/任务/报告/AR）
    // 判断"我现在在讲哪个点位"的唯一依据。
    // 不能让视图去读「上一次访问过的点位页」这个隐式状态：
    // 那样刷新页面或直接打开 #/chat?id=xxx 时会拿到错误点位，
    // 出现「问黄洋界却回答超出龙江书院范围」这种硬伤。
    activePointId: null,
    net: { mode: "unknown", model: null, endpoint: null },
    ui: { online: false, busy: false }
  };

  /* ---------- 初始加载 ---------- */
  function load() {
    try { state.user = JSON.parse(lsGet(USER_KEY)); } catch (e) { state.user = null; }
    if (!state.user) state.user = null;
    try { state.progress = JSON.parse(lsGet(PROGRESS_KEY)) || {}; } catch (e) { state.progress = {}; }
    return state;
  }

  /* ---------- 订阅 ---------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      var i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function emit(reason) {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state, reason); } catch (e) { console.error("[store] listener error", e); }
    }
  }

  /* ---------- 用户 ---------- */
  function getUser() { return state.user; }

  function saveUser(name, school, grade) {
    state.user = { name: name, school: school || "—", grade: grade || "junior" };
    lsSet(USER_KEY, JSON.stringify(state.user));
    emit("user");
    return state.user;
  }

  function updateUser(patch) {
    if (!state.user) return null;
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.user[k] = patch[k];
    lsSet(USER_KEY, JSON.stringify(state.user));
    emit("user");
    return state.user;
  }

  /* ---------- 进度（按点位分区） ---------- */
  function defaultPointProgress() {
    return {
      tasks: {},        // { taskId: bool }
      choiceCorrect: false,
      orderCorrect: false,
      reason: "",       // 任务二的理由
      selfText: "",     // 任务四的自述
      questions: [],    // 提问记录
      photos: {},       // { taskId: 压缩后的 dataURL } —— 重建 DOM 后用于恢复预览
      enterTime: 0,    // 进入点位的时间戳
      done: false
    };
  }

  function getProgress(pointId) {
    var p = state.progress[pointId];
    if (!p) {
      p = defaultPointProgress();
      state.progress[pointId] = p;
    }
    // 兼容旧字段
    if (!p.tasks) p.tasks = {};
    if (!Array.isArray(p.questions)) p.questions = [];
    return p;
  }

  function setProgress(pointId, patch) {
    var p = getProgress(pointId);
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) p[k] = patch[k];
    lsSet(PROGRESS_KEY, JSON.stringify(state.progress));
    emit("progress:" + pointId);
    return p;
  }

  function resetProgress(pointId) {
    state.progress[pointId] = defaultPointProgress();
    lsSet(PROGRESS_KEY, JSON.stringify(state.progress));
    emit("progress:" + pointId);
    return state.progress[pointId];
  }

  function allProgress() { return state.progress; }

  /* ---------- 路由 ---------- */
  function setRoute(name, params) {
    state.route = { name: name, params: params || {} };
    emit("route");
  }

  /* ---------- 当前点位 ---------- */
  function setActivePoint(id) {
    if (!id || state.activePointId === id) return state.activePointId;
    state.activePointId = id;
    emit("activePoint");
    return id;
  }

  function getActivePointId() { return state.activePointId; }

  /* ---------- 网络状态 ---------- */
  function setNet(patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.net[k] = patch[k];
    emit("net");
  }

  function setUI(patch) {
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) state.ui[k] = patch[k];
    emit("ui");
  }

  DZHT.core.store = {
    state: state,
    load: load,
    subscribe: subscribe,
    emit: emit,
    getUser: getUser,
    saveUser: saveUser,
    updateUser: updateUser,
    getProgress: getProgress,
    setProgress: setProgress,
    resetProgress: resetProgress,
    allProgress: allProgress,
    setRoute: setRoute,
    setActivePoint: setActivePoint,
    getActivePointId: getActivePointId,
    setNet: setNet,
    setUI: setUI
  };
})(typeof self !== "undefined" ? self : this);
