/* ==========================================================================
   NEON ARCADE - core helpers
   Loaded on every page (in <head>, before render, so the theme never flashes).
   Plain script, no modules, no build step.
   ========================================================================== */

window.Arcade = (function () {
  'use strict';

  var PREFIX = 'arcade.';

  /* ---------- storage (never throws: private mode / blocked cookies) ------- */

  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },
    remove: function (key) {
      try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    }
  };

  /* ---------- theme -------------------------------------------------------- */

  var theme = {
    get: function () {
      return store.get('theme', 'dark') === 'light' ? 'light' : 'dark';
    },
    apply: function (value) {
      document.documentElement.setAttribute('data-theme', value);
      store.set('theme', value);
      var btn = document.getElementById('theme-toggle');
      if (btn) {
        btn.textContent = value === 'light' ? '☾' : '☀';
        btn.setAttribute('aria-label', value === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
      }
    },
    toggle: function () {
      theme.apply(theme.get() === 'light' ? 'dark' : 'light');
    },
    init: function () {
      theme.apply(theme.get());
    }
  };

  // Applied immediately so the first paint is already the right theme.
  theme.apply(theme.get());

  /* ---------- player name -------------------------------------------------- */

  var player = {
    get: function () {
      return store.get('player', '') || '';
    },
    set: function (name) {
      var clean = String(name || '').trim().slice(0, 14);
      if (clean) store.set('player', clean);
      return clean;
    },
    /* Asks once, then remembers. Returns the name (or "PLAYER" if skipped). */
    ensure: function () {
      var current = player.get();
      if (current) return current;
      var answer = null;
      try { answer = window.prompt('Enter your arcade name (max 14 chars):', 'PLAYER'); } catch (e) {}
      return player.set(answer) || player.set('PLAYER');
    }
  };

  /* ---------- toast -------------------------------------------------------- */

  var toastTimer = null;
  function toast(message) {
    var el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- misc helpers ------------------------------------------------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function randInt(max) {
    return Math.floor(Math.random() * max);
  }

  /* Fetches a JSON file from /data. Works on Vercel and any local server. */
  function loadData(name) {
    return fetch(dataUrl(name)).then(function (res) {
      if (!res.ok) throw new Error('Could not load ' + name + ' (' + res.status + ')');
      return res.json();
    });
  }

  /* Pages live at different depths (/index.html vs /games/snake/index.html),
     so resolve /data relative to the site root recorded on <html>. */
  function dataUrl(name) {
    var root = document.documentElement.getAttribute('data-root') || '';
    return root + 'data/' + name;
  }

  /* Swipe detection shared by Snake and 2048. */
  function onSwipe(target, handler, minDistance) {
    var min = minDistance || 28;
    var startX = 0, startY = 0, tracking = false;

    target.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      tracking = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    target.addEventListener('touchmove', function (e) {
      if (tracking) e.preventDefault();
    }, { passive: false });

    target.addEventListener('touchend', function (e) {
      if (!tracking) return;
      tracking = false;
      var touch = e.changedTouches[0];
      var dx = touch.clientX - startX;
      var dy = touch.clientY - startY;
      if (Math.abs(dx) < min && Math.abs(dy) < min) return;
      if (Math.abs(dx) > Math.abs(dy)) handler(dx > 0 ? 'right' : 'left');
      else handler(dy > 0 ? 'down' : 'up');
    }, { passive: true });
  }

  /* Wires up the shared topbar controls present on every page. */
  function initChrome() {
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', theme.toggle);
    theme.apply(theme.get());

    var nameBtn = document.getElementById('player-name');
    if (nameBtn) {
      var render = function () { nameBtn.textContent = player.get() || 'Set name'; };
      render();
      nameBtn.addEventListener('click', function () {
        var answer = null;
        try { answer = window.prompt('Arcade name (max 14 chars):', player.get() || 'PLAYER'); } catch (e) {}
        if (answer !== null) { player.set(answer); render(); }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', initChrome);

  return {
    store: store,
    theme: theme,
    player: player,
    toast: toast,
    el: el,
    randInt: randInt,
    loadData: loadData,
    dataUrl: dataUrl,
    onSwipe: onSwipe
  };
})();
