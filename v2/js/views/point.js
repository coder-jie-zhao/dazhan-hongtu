/* =========================================================================
 * 大展红途 v2 · 视图 · 点位详情
 *
 * v1 的点位页是静态的（黄洋界硬编码），三个点位共用一套。
 * v2 全部由点位数据驱动：hero 图、信息卡、现场照片、讲解词都是各自的。
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

  var C = { data: null, point: null, carousel: null, inited: false, locating: false };

  function init(data) {
    C.data = data;
    C.el = {
      hero: $("point-hero"),
      heroImg: $("point-hero-img"),
      subtitle: $("point-subtitle"),
      title: $("point-title"),
      brief: $("point-brief"),
      locate: $("point-locate"),
      locateText: $("locate-text"),
      cards: $("point-cards"),
      dots: $("point-dots"),
      photos: $("point-photos")
    };
  }

  function pointById(id) {
    var pts = C.data.points;
    for (var i = 0; i < pts.length; i++) if (pts[i].id === id) return pts[i];
    return pts[0];
  }

  function render(p) {
    C.point = p;

    C.el.heroImg.src = p.hero;
    C.el.heroImg.alt = p.heroAlt;
    C.el.subtitle.textContent = p.subtitle;
    C.el.title.textContent = p.name;
    C.el.brief.textContent = p.brief;

    // 信息卡
    C.el.cards.innerHTML = p.cards.map(function (c) {
      return '<div class="info-card">' +
        '<div class="info-card-label">' + esc(c.label) + '</div>' +
        '<div class="info-card-desc">' + esc(c.desc) + '</div>' +
      '</div>';
    }).join("");

    // 圆点
    C.el.dots.innerHTML = p.cards.map(function (_, i) {
      return '<i class="' + (i === 0 ? "on" : "") + '"></i>';
    }).join("");

    // 现场照片
    var photos = p.photos || [];
    C.el.photos.innerHTML = photos.slice(0, 3).map(function (ph) {
      return '<div class="pp-item" data-photo="' + esc(ph.src) + '">' +
        '<img src="' + ph.src + '" alt="' + esc(ph.caption) + '" loading="lazy" />' +
        '<div class="pp-cap">' + esc(ph.caption) + '</div>' +
      '</div>';
    }).join("");

    // 定位动画
    C.el.locate.classList.remove("arrived");
    C.el.locateText.textContent = "正在核对点位…";
    C.locating = true;
    setTimeout(function () {
      if (!C.locating) return;
      C.el.locateText.textContent = "已到达点位 · " + p.name;
      C.el.locate.classList.add("arrived");
    }, 1200);

    // 进入时间（用于「现场观察」评分里的停留时长）
    var store = DZHT.core.store;
    var prog = store.getProgress(p.id);
    if (!prog.enterTime) {
      prog.enterTime = Date.now();
      store.setProgress(p.id, { enterTime: prog.enterTime });
    }
  }

  function bind() {
    // 卡片横滑
    C.el.cards.addEventListener("click", function (e) {
      var card = e.target.closest(".info-card");
      if (!card) return;
      var idx = Array.prototype.indexOf.call(C.el.cards.children, card);
      if (C.carousel) C.carousel.goTo(idx);
    });

    // 照片点击 → 放大查看
    C.el.photos.addEventListener("click", function (e) {
      var item = e.target.closest("[data-photo]");
      if (!item) return;
      var src = item.getAttribute("data-photo");
      var cap = item.querySelector(".pp-cap");
      showPhoto(src, cap ? cap.textContent : "");
    });

    C.el.hero.addEventListener("click", function (e) {
      if (e.target.closest("[data-act]")) return;
    });
  }

  function showPhoto(src, caption) {
    var html =
      '<div class="modal show" id="photo-modal">' +
        '<div class="modal-mask" data-close="photo-modal"></div>' +
        '<div class="modal-card" style="max-width:360px;padding:14px">' +
          '<img src="' + esc(src) + '" alt="' + esc(caption) + '" style="width:100%;border-radius:10px;display:block" />' +
          '<p class="tiny dimmer center" style="margin-top:8px">' + esc(caption) + ' · 井冈山革命博物馆官网</p>' +
          '<button class="btn btn-primary" data-close="photo-modal">关闭</button>' +
        '</div>' +
      '</div>';
    var d = document.createElement("div");
    d.innerHTML = html;
    document.body.appendChild(d.firstChild);
  }

  DZHT.views.point = {
    init: init,
    bind: bind,
    onEnter: function (params) {
      var p = pointById(params.id);
      render(p);
      if (!C.carousel) {
        C.carousel = DZHT.core.motion.carousel(C.el.cards, {
          perView: 3,
          onChange: function (idx) {
            var dots = C.el.dots.querySelectorAll("i");
            for (var i = 0; i < dots.length; i++) dots[i].classList.toggle("on", i === idx);
          }
        });
      }
    },
    onLeave: function () { C.locating = false; },
    point: function () { return C.point; }
  };
})(typeof self !== "undefined" ? self : this);
