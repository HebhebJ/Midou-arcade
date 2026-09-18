/* ==========================================================================
   NEON ARCADE - Snake
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var GAME_ID = 'snake';
  var GRID = 20;                 // cells per side
  var CELL = 480 / GRID;         // canvas is 480x480
  var START_SPEED = 7;           // moves per second
  var MAX_SPEED = 15;
  var SPEED_STEP = 0.3;          // added per pellet eaten

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');

  var ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    length: document.getElementById('length'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    overBtn: document.getElementById('over-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    restartBtn: document.getElementById('restart-btn'),
    scores: document.getElementById('scores')
  };

  var DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1  },
    left:  { x: -1, y: 0  },
    right: { x: 1,  y: 0  }
  };

  var state = null;       // null until the first game starts
  var running = false;
  var lastFrame = 0;
  var accumulator = 0;

  /* ---------- game state --------------------------------------------------- */

  function newGame() {
    var mid = Math.floor(GRID / 2);
    state = {
      snake: [{ x: mid - 1, y: mid }, { x: mid - 2, y: mid }, { x: mid - 3, y: mid }],
      dir: DIRS.right,
      queued: [],          // buffered turns, so fast double-taps are not lost
      food: null,
      score: 0,
      speed: START_SPEED,
      over: false
    };
    placeFood();
    render();
    updateStats();
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        if (!occupied(x, y)) free.push({ x: x, y: y });
      }
    }
    state.food = free.length ? free[Arcade.randInt(free.length)] : null;
  }

  function occupied(x, y) {
    return state.snake.some(function (seg) { return seg.x === x && seg.y === y; });
  }

  function turn(name) {
    if (!state || state.over) return;
    var next = DIRS[name];
    if (!next) return;
    // Compare against the last queued turn, not the current heading, so two
    // quick taps (e.g. right then down) both register.
    var from = state.queued.length ? state.queued[state.queued.length - 1] : state.dir;
    if (from.x + next.x === 0 && from.y + next.y === 0) return;  // no 180s
    if (from.x === next.x && from.y === next.y) return;           // already going there
    if (state.queued.length < 2) state.queued.push(next);
  }

  function step() {
    if (state.queued.length) state.dir = state.queued.shift();

    var head = state.snake[0];
    var next = { x: head.x + state.dir.x, y: head.y + state.dir.y };

    if (next.x < 0 || next.y < 0 || next.x >= GRID || next.y >= GRID) return gameOver();

    // The tail tip moves away this tick, so running into it is legal.
    var hitSelf = state.snake.some(function (seg, i) {
      if (i === state.snake.length - 1) return false;
      return seg.x === next.x && seg.y === next.y;
    });
    if (hitSelf) return gameOver();

    state.snake.unshift(next);

    if (state.food && next.x === state.food.x && next.y === state.food.y) {
      state.score += 10;
      state.speed = Math.min(MAX_SPEED, state.speed + SPEED_STEP);
      placeFood();
    } else {
      state.snake.pop();
    }

    updateStats();
  }

  function gameOver() {
    state.over = true;
    running = false;
    ui.pauseBtn.textContent = 'Pause';

    Arcade.player.ensure();
    Arcade.Scores.submit(GAME_ID, state.score).then(function (result) {
      var line = 'You scored ' + state.score + '.';
      if (result.isBest) line = 'NEW BEST - ' + state.score + ' points!';
      else if (result.madeTable) line = state.score + ' points, rank #' + result.rank + '.';
      showOverlay('GAME OVER', line, 'Play again');
      refreshScores();
      updateStats();
    });
  }

  /* ---------- rendering ---------------------------------------------------- */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function render() {
    var bg = cssVar('--bg') || '#07070f';
    var line = cssVar('--line') || '#2c2c5c';
    var snakeColor = cssVar('--neon-4') || '#39ff14';
    var foodColor = cssVar('--neon-2') || '#ff2d95';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = line;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (var i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (!state) return;

    if (state.food) {
      ctx.fillStyle = foodColor;
      ctx.shadowColor = foodColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2, CELL * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    state.snake.forEach(function (seg, i) {
      ctx.fillStyle = snakeColor;
      ctx.globalAlpha = i === 0 ? 1 : Math.max(0.35, 1 - i / (state.snake.length + 6));
      var pad = i === 0 ? 1 : 2;
      ctx.fillRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2);
    });
    ctx.globalAlpha = 1;
  }

  function updateStats() {
    ui.score.textContent = state ? state.score : 0;
    ui.length.textContent = state ? state.snake.length : 3;
    var best = Arcade.Scores.best(GAME_ID);
    ui.best.textContent = best === null ? 0 : best;
  }

  function refreshScores() {
    Arcade.Scores.top(GAME_ID, 5).then(function (rows) {
      Arcade.Scores.render(ui.scores, rows);
    });
  }

  /* ---------- loop --------------------------------------------------------- */

  function frame(time) {
    if (!running) return;
    if (!lastFrame) lastFrame = time;
    var delta = (time - lastFrame) / 1000;
    lastFrame = time;
    accumulator += delta;

    var interval = 1 / state.speed;
    while (accumulator >= interval && running) {
      accumulator -= interval;
      step();
      interval = 1 / state.speed;
    }

    render();
    requestAnimationFrame(frame);
  }

  function start() {
    if (!state || state.over) newGame();
    hideOverlay();
    running = true;
    lastFrame = 0;
    accumulator = 0;
    ui.pauseBtn.textContent = 'Pause';
    requestAnimationFrame(frame);
  }

  function pause() {
    if (!running) return;
    running = false;
    ui.pauseBtn.textContent = 'Resume';
    showOverlay('PAUSED', 'Take your time.', 'Resume');
  }

  function togglePause() {
    if (!state || state.over) return start();
    if (running) pause(); else start();
  }

  function showOverlay(title, text, button) {
    ui.overTitle.textContent = title;
    ui.overText.textContent = text;
    ui.overBtn.textContent = button;
    ui.overlay.hidden = false;
  }

  function hideOverlay() {
    ui.overlay.hidden = true;
  }

  /* ---------- input -------------------------------------------------------- */

  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      togglePause();
      return;
    }
    var dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    if (!running && state && !state.over) return;   // stay paused
    turn(dir);
  });

  Arcade.onSwipe(canvas, function (dir) {
    if (!running) start();
    turn(dir);
  });

  document.querySelectorAll('.dpad button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!running) start();
      turn(btn.getAttribute('data-dir'));
    });
  });

  ui.overBtn.addEventListener('click', start);
  ui.pauseBtn.addEventListener('click', togglePause);
  ui.restartBtn.addEventListener('click', function () {
    newGame();
    start();
  });

  window.addEventListener('blur', function () { if (running) pause(); });

  /* Theme switch changes the palette, so repaint. */
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () { setTimeout(render, 0); });

  /* ---------- boot --------------------------------------------------------- */

  newGame();
  state.over = true;          // first click on the overlay starts a fresh game
  showOverlay('READY?', 'Eat the glowing pellets. Hitting a wall or yourself ends the run.', 'Start');
  refreshScores();
  updateStats();
})(window.Arcade);
