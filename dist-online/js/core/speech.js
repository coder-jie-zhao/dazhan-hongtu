/* 语音朗读：Web Speech API，本地合成，断网可用。
   iOS 和微信要求 speak() 在用户手势的同步调用栈里触发，异步回答要先 unlock() 解锁。
   浏览器不支持时调用方把按钮藏起来，不提示错误。 */
(function (root) {
  "use strict";

  var DZHT = root.DZHT = root.DZHT || {};
  DZHT.core = DZHT.core || {};

  var AUTO_KEY = "dzht_v2_speech_auto";
  var unlocked = false;
  var currentUtter = null;

  function supported() {
    try {
      return typeof root.speechSynthesis !== "undefined" &&
        typeof root.SpeechSynthesisUtterance !== "undefined";
    } catch (e) { return false; }
  }

  // 没有中文 voice 时朗读等于没有，按钮也藏起来
  function hasChineseVoice() {
    if (!supported()) return false;
    try {
      var voices = root.speechSynthesis.getVoices() || [];
      for (var i = 0; i < voices.length; i++) {
        var lang = (voices[i].lang || "").toLowerCase();
        if (lang.indexOf("zh") === 0) return true;
      }
      // 安卓机初次可能返回空数组，放行让 speak 用系统默认
      return voices.length === 0;
    } catch (e) { return true; }
  }

  // 用户手势同步栈里调一次，空串解锁 iOS / 微信的播放权限
  function unlock() {
    if (!supported() || unlocked) return;
    try {
      var u = new root.SpeechSynthesisUtterance("");
      u.volume = 0;
      root.speechSynthesis.speak(u);
      unlocked = true;
    } catch (e) { /* 失败就留着 false，下次点击再试 */ }
  }

  function pickVoice() {
    try {
      var voices = root.speechSynthesis.getVoices() || [];
      var zh = [];
      for (var i = 0; i < voices.length; i++) {
        var lang = (voices[i].lang || "").toLowerCase();
        if (lang.indexOf("zh") === 0) zh.push(voices[i]);
      }
      // 本地 voice 不受网络语音超时影响
      for (var j = 0; j < zh.length; j++) if (zh[j].localService) return zh[j];
      return zh[0] || null;
    } catch (e) { return null; }
  }

  // 发起朗读，返回 true 只代表调用成功，不代表一定出声
  function speak(text, onEnd) {
    if (!supported() || !text) return false;
    try {
      root.speechSynthesis.cancel();
      var u = new root.SpeechSynthesisUtterance(String(text));
      u.lang = "zh-CN";
      u.rate = 0.96;
      u.pitch = 1;
      var v = pickVoice();
      if (v) u.voice = v;
      var done = function () {
        currentUtter = null;
        if (onEnd) onEnd();
      };
      u.onend = done;
      u.onerror = done;
      currentUtter = u;
      root.speechSynthesis.speak(u);
      return true;
    } catch (e) {
      if (onEnd) onEnd();
      return false;
    }
  }

  function cancel() {
    if (!supported()) return;
    try {
      root.speechSynthesis.cancel();
      currentUtter = null;
    } catch (e) { /* ignore */ }
  }

  function isSpeaking() {
    if (!supported()) return false;
    try { return !!root.speechSynthesis.speaking; } catch (e) { return false; }
  }

  function isAuto() {
    try { return root.localStorage.getItem(AUTO_KEY) === "1"; } catch (e) { return false; }
  }
  function setAuto(on) {
    try { root.localStorage.setItem(AUTO_KEY, on ? "1" : "0"); } catch (e) { /* file:// 忽略 */ }
  }

  DZHT.core.speech = {
    supported: supported,
    hasChineseVoice: hasChineseVoice,
    unlock: unlock,
    speak: speak,
    cancel: cancel,
    isSpeaking: isSpeaking,
    isAuto: isAuto,
    setAuto: setAuto
  };
})(typeof self !== "undefined" ? self : this);
