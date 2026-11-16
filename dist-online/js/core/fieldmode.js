/* 现场模式：给带队教师用。大字、关动画、停轮播、只走本地数据。
   状态存 localStorage，刷新后保持。全部靠 body 上的 class 起作用。 */
(function (root) {
  "use strict";
  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var KEY = "dzht_v2_field_mode";
  var CLS = "field-mode";

  function isOn() {
    try { return root.localStorage.getItem(KEY) === "1"; } catch (e) { return false; }
  }

  function apply(on) {
    try { root.localStorage.setItem(KEY, on ? "1" : "0"); } catch (e) { /* file:// 忽略 */ }
    if (root.document && root.document.body) {
      root.document.body.classList.toggle(CLS, !!on);
    }
  }

  function toggle() {
    var next = !isOn();
    apply(next);
    return next;
  }

  // 页面初始化时把已存的状态贴回 body
  function boot() {
    if (isOn() && root.document && root.document.body) {
      root.document.body.classList.add(CLS);
    }
  }

  DZHT.core.fieldmode = {
    isOn: isOn,
    apply: apply,
    toggle: toggle,
    boot: boot
  };
})(typeof self !== "undefined" ? self : this);
