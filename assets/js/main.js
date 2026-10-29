/* Aditya Sharma · portfolio interactions. No dependencies. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)');

  /* ---------- Theme ---------- */

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return prefersDark.matches ? 'dark' : 'light';
  }

  var themeListeners = [];
  function onThemeChange(fn) { themeListeners.push(fn); }
  function themeChanged() { themeListeners.forEach(function (fn) { fn(currentTheme()); }); }

  var toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      themeChanged();
    });
  }
  if (prefersDark.addEventListener) prefersDark.addEventListener('change', themeChanged);

  /* ---------- Navigation ---------- */

  var nav = document.getElementById('nav');
  function onScroll() {
    if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 12);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var menuBtn = document.getElementById('menu-btn');
  var navLinks = document.getElementById('nav-links');
  function setMenu(open) {
    if (!menuBtn || !navLinks) return;
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    navLinks.classList.toggle('is-open', open);
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      setMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setMenu(false);
    });
  }

  // Highlight the nav link for the section in view.
  var linkFor = {};
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function (a) {
    linkFor[a.getAttribute('href').slice(1)] = a;
  });
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var link = linkFor[entry.target.id];
        if (!link) return;
        if (entry.isIntersecting) {
          Object.keys(linkFor).forEach(function (k) { linkFor[k].classList.remove('is-current'); });
          link.classList.add('is-current');
        } else {
          link.classList.remove('is-current');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { sectionObserver.observe(s); });
  }

  /* ---------- Reveal on scroll ---------- */

  var revealables = document.querySelectorAll('.reveal');
  // Stagger siblings that share a parent, so grids cascade in.
  var seen = new Map();
  revealables.forEach(function (el) {
    var i = seen.get(el.parentNode) || 0;
    seen.set(el.parentNode, i + 1);
    el.style.setProperty('--d', Math.min(i * 0.07, 0.35) + 's');
  });

  if ('IntersectionObserver' in window && !reduceMotion.matches) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- Project filter ---------- */

  var chips = document.querySelectorAll('.filters .chip');
  var filterables = document.querySelectorAll('.projects .card, .more-list li');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.getAttribute('data-filter');
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', String(on));
      });
      filterables.forEach(function (el) {
        var cats = (el.getAttribute('data-cat') || '').split(/\s+/);
        var show = f === 'all' || cats.indexOf(f) !== -1;
        el.classList.toggle('is-hidden', !show);
        if (show) el.classList.add('is-in');
      });
    });
  });

  /* ---------- Email (assembled here to keep it away from simple scrapers) ---------- */

  var address = ['hiadityasharma09', 'gmail.com'].join('@');
  document.querySelectorAll('.js-email').forEach(function (a) {
    a.setAttribute('href', 'mailto:' + address);
  });

  var toast = document.getElementById('toast');
  var toastTimer;
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 2200);
  }

  var copyBtn = document.getElementById('copy-email');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(
          function () { showToast('Copied ' + address); },
          function () { showToast(address); }
        );
      } else {
        showToast(address);
      }
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Hero landscape ----------
     A dotted terrain with two peaks, a nod to the two-peaked fitness
     distribution in my p53 thesis. The pointer raises a small hill. */

  var canvas = document.getElementById('landscape');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');

  var W = 0, H = 0, cols = 0, rows = 0, t = 0, raf = 0, running = false, visible = true;
  var pointer = { u: 0.5, v: 0.5, strength: 0, target: 0 };
  var colours = { a: '#ffb04a', b: '#7fb2ff' };

  function readColours() {
    var cs = getComputedStyle(root);
    colours.a = cs.getPropertyValue('--accent').trim() || colours.a;
    colours.b = cs.getPropertyValue('--viz').trim() || colours.b;
  }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = W < 640 ? 42 : W < 1100 ? 64 : 80;
    rows = W < 640 ? 26 : 34;
  }

  function gauss(x, y, cx, cy, s) {
    var dx = x - cx, dy = y - cy;
    return Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
  }

  function height(u, v) {
    var z = 0.62 * gauss(u, v, 0.72 + 0.025 * Math.sin(t * 0.37), 0.42, 0.095)
          + 0.34 * gauss(u, v, 0.34, 0.5 + 0.035 * Math.cos(t * 0.29), 0.15);
    z += 0.045 * Math.sin(u * 13 + t * 0.8) * Math.cos(v * 9 - t * 0.55);
    if (pointer.strength > 0.001) z += 0.3 * pointer.strength * gauss(u, v, pointer.u, pointer.v, 0.06);
    return z;
  }

  // Where row v sits on screen, and how wide it is (simple perspective).
  var TOP = 0.34, SPAN = 0.62, CURVE = 1.35;
  function rowY(v) { return H * TOP + H * SPAN * Math.pow(v, CURVE); }
  function rowWidth(v) { return W * (0.62 + 0.75 * v); }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pointer.strength += (pointer.target - pointer.strength) * 0.06;
    for (var j = 0; j < rows; j++) {
      var v = j / (rows - 1);
      var y0 = rowY(v);
      var rw = rowWidth(v);
      var depth = 0.3 + 0.7 * v;
      for (var i = 0; i < cols; i++) {
        var u = i / (cols - 1);
        var z = height(u, v);
        var x = W / 2 + (u - 0.5) * rw;
        var y = y0 - z * H * 0.42 * depth;
        var r = (0.5 + 1.5 * depth) * (0.75 + z * 1.1);
        ctx.globalAlpha = Math.max(0.06, Math.min(0.95, 0.1 + z * 1.15 + v * 0.18));
        ctx.fillStyle = z > 0.22 ? colours.a : colours.b;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    t += 0.012;
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (running || reduceMotion.matches || !visible || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  function setup() {
    readColours();
    resize();
    draw();
    start();
  }

  canvas.parentNode.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var v = Math.pow(Math.max(0, Math.min(1, (py - H * TOP) / (H * SPAN))), 1 / CURVE);
    var u = (px - W / 2) / rowWidth(v) + 0.5;
    pointer.u = u;
    pointer.v = v;
    pointer.target = py > H * (TOP - 0.05) ? 1 : 0;
  });
  canvas.parentNode.addEventListener('pointerleave', function () { pointer.target = 0; });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resize(); draw(); }, 120);
  });

  onThemeChange(function () { readColours(); draw(); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else start();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) start(); else stop();
    }).observe(canvas);
  }
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener('change', function () {
      if (reduceMotion.matches) { stop(); draw(); } else start();
    });
  }

  // Wait for fonts so the first paint reads the final colours and layout.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup); else setup();
})();
