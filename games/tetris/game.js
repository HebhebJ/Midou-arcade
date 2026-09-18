/* ==========================================================================
   NEON ARCADE - Tetris
   Seven-bag randomiser, ghost piece, hold slot, and a short lock delay so
   last-moment slides feel right.
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var GAME_ID = 'tetris';
  var COLS = 10;
  var ROWS = 20;
  var CELL = 24;                 // board canvas is 240x480
  var PREVIEW_CELL = 18;         // side canvases are 72x72

  var LINE_SCORES = [0, 100, 300, 500, 800];
  var LOCK_DELAY = 500;          // ms a grounded piece can still be nudged
  var MAX_LOCK_RESETS = 15;      // stops infinite spinning

  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };

  var COLORS = {
    I: '#00e5ff', O: '#ffd60a', T: '#ff2d95',
    S: '#39ff14', Z: '#ff3b5c', J: '#3b6cff', L: '#ff9d1f'
  };

  /* Tried in order when a rotation is blocked - lets pieces kick off walls
     and off the stack instead of simply refusing to turn. */
  var KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]];

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var nextCanvas = document.getElementById('next');
  var nextCtx = nextCanvas.getContext('2d');
  var holdCanvas = document.getElementById('hold');
  var holdCtx = holdCanvas.getContext('2d');

  var ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    level: document.getElementById('level'),
    lines: document.getElementById('lines'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    overBtn: document.getElementById('over-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    restartBtn: document.getElementById('restart-btn'),
    scores: document.getElementById('scores')
  };

  var board = [];
  var piece = null;
  var nextType = null;
  var holdType = null;
  var holdUsed = false;
  var bag = [];

  var score = 0;
  var lines = 0;
  var level = 1;
  var over = false;
  var running = false;

  var lastFrame = 0;
  var dropTimer = 0;
  var lockTimer = 0;
  var lockResets = 0;

  /* ---------- board -------------------------------------------------------- */

  function emptyBoard() {
    var rows = [];
    for (var r = 0; r < ROWS; r++) {
      var row = [];
      for (var c = 0; c < COLS; c++) row.push(0);
      rows.push(row);
    }
    return rows;
  }

  function dropInterval() {
    return Math.max(70, 800 - (level - 1) * 65);
  }

  /* ---------- pieces ------------------------------------------------------- */

  /* Seven-bag: every piece appears once before any repeats. */
  function nextFromBag() {
    if (!bag.length) {
      bag = Object.keys(SHAPES);
      for (var i = bag.length - 1; i > 0; i--) {
        var j = Arcade.randInt(i + 1);
        var tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
      }
    }
    return bag.pop();
  }

  function makePiece(type) {
    var matrix = SHAPES[type].map(function (row) { return row.slice(); });
    return {
      type: type,
      matrix: matrix,
      x: Math.floor((COLS - matrix[0].length) / 2),
      y: type === 'I' ? -1 : 0
    };
  }

  function spawn(type) {
    piece = makePiece(type);
    holdUsed = false;
    lockTimer = 0;
    lockResets = 0;

    if (collides(piece.matrix, piece.x, piece.y)) gameOver();
  }

  function pullNext() {
    var type = nextType;
    nextType = nextFromBag();
    spawn(type);
  }

  function rotateMatrix(m) {
    var n = m.length;
    var out = [];
    for (var r = 0; r < n; r++) {
      out.push([]);
      for (var c = 0; c < n; c++) out[r].push(m[n - 1 - c][r]);
    }
    return out;
  }

  function collides(matrix, px, py) {
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        var x = px + c;
        var y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && board[y][x]) return true;   // above the ceiling is free
      }
    }
    return false;
  }

  /* ---------- actions ------------------------------------------------------ */

  function touchLock() {
    // A successful move while grounded buys a little more time, up to a cap.
    if (lockTimer > 0 && lockResets < MAX_LOCK_RESETS) {
      lockTimer = 0;
      lockResets++;
    }
  }

  function move(dx) {
    if (!piece || !running) return false;
    if (collides(piece.matrix, piece.x + dx, piece.y)) return false;
    piece.x += dx;
    touchLock();
    return true;
  }

  function rotate() {
    if (!piece || !running) return false;
    var turned = rotateMatrix(piece.matrix);
    for (var i = 0; i < KICKS.length; i++) {
      var nx = piece.x + KICKS[i][0];
      var ny = piece.y + KICKS[i][1];
      if (!collides(turned, nx, ny)) {
        piece.matrix = turned;
        piece.x = nx;
        piece.y = ny;
        touchLock();
        return true;
      }
    }
    return false;
  }

  function softDrop() {
    if (!piece || !running) return;
    if (collides(piece.matrix, piece.x, piece.y + 1)) return;
    piece.y++;
    score += 1;
    dropTimer = 0;
    updateStats();
  }

  function hardDrop() {
    if (!piece || !running) return;
    var cells = 0;
    while (!collides(piece.matrix, piece.x, piece.y + 1)) {
      piece.y++;
      cells++;
    }
    score += cells * 2;
    lock();
  }

  function hold() {
    if (!piece || !running || holdUsed) return;
    var stored = holdType;
    holdType = piece.type;
    holdUsed = true;

    if (stored) {
      piece = makePiece(stored);
      lockTimer = 0;
      lockResets = 0;
      if (collides(piece.matrix, piece.x, piece.y)) gameOver();
    } else {
      pullNext();
      holdUsed = true;     // pullNext resets it, but the hold was still spent
    }
    drawPreviews();
  }

  function lock() {
    for (var r = 0; r < piece.matrix.length; r++) {
      for (var c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        var y = piece.y + r;
        var x = piece.x + c;
        if (y < 0) return gameOver();        // locked out above the ceiling
        board[y][x] = piece.type;
      }
    }

    clearLines();
    pullNext();
    drawPreviews();
    updateStats();
  }

  function clearLines() {
    var kept = board.filter(function (row) {
      return row.some(function (cell) { return !cell; });
    });
    var cleared = ROWS - kept.length;
    if (!cleared) return;

    while (kept.length < ROWS) {
      var blank = [];
      for (var c = 0; c < COLS; c++) blank.push(0);
      kept.unshift(blank);
    }
    board = kept;

    // Scored at the level the lines were cleared on, before the level bumps.
    var gained = LINE_SCORES[cleared] * level;
    lines += cleared;
    score += gained;
    level = Math.floor(lines / 10) + 1;

    if (cleared === 4) Arcade.toast('TETRIS! +' + gained);
  }

  function gameOver() {
    over = true;
    running = false;
    piece = null;
    ui.pauseBtn.textContent = 'Pause';

    Arcade.player.ensure();
    Arcade.Scores.submit(GAME_ID, score).then(function (result) {
      var line = 'You scored ' + score + ' over ' + lines + ' lines.';
      if (result.isBest) line = 'NEW BEST - ' + score + ' points, ' + lines + ' lines!';
      else if (result.madeTable) line = score + ' points, rank #' + result.rank + '.';
      showOverlay('GAME OVER', line, 'Play again');
      refreshScores();
      updateStats();
    });
  }

  /* ---------- drawing ------------------------------------------------------ */

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function drawCell(target, x, y, color, size, alpha) {
    target.globalAlpha = alpha === undefined ? 1 : alpha;
    target.fillStyle = color;
    target.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);

    // A lighter top-left edge gives the blocks a bit of depth.
    target.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.55;
    target.fillStyle = '#ffffff';
    target.fillRect(x * size + 1, y * size + 1, size - 2, 2);
    target.fillRect(x * size + 1, y * size + 1, 2, size - 2);
    target.globalAlpha = 1;
  }

  function render() {
    ctx.fillStyle = cssVar('--bg', '#07070f');
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = cssVar('--line', '#2c2c5c');
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 1;
    for (var i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.stroke();
    }
    for (var j = 1; j < ROWS; j++) {
      ctx.beginPath();
      ctx.moveTo(0, j * CELL);
      ctx.lineTo(canvas.width, j * CELL);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        if (board[r][c]) drawCell(ctx, c, r, COLORS[board[r][c]], CELL);
      }
    }

    if (!piece) return;

    // Ghost: where a hard drop would land.
    var ghostY = piece.y;
    while (!collides(piece.matrix, piece.x, ghostY + 1)) ghostY++;
    forEachCell(piece.matrix, function (r, c) {
      if (piece.y + r >= 0) drawCell(ctx, piece.x + c, ghostY + r, COLORS[piece.type], CELL, 0.18);
    });

    forEachCell(piece.matrix, function (r, c) {
      if (piece.y + r >= 0) drawCell(ctx, piece.x + c, piece.y + r, COLORS[piece.type], CELL);
    });
  }

  function forEachCell(matrix, fn) {
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) fn(r, c);
      }
    }
  }

  function drawPreview(target, canvasEl, type) {
    target.fillStyle = cssVar('--bg', '#07070f');
    target.fillRect(0, 0, canvasEl.width, canvasEl.height);
    if (!type) return;

    var matrix = SHAPES[type];
    // Centre the shape on its filled cells, not on the matrix padding.
    var minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
    forEachCell(matrix, function (r, c) {
      minR = Math.min(minR, r); maxR = Math.max(maxR, r);
      minC = Math.min(minC, c); maxC = Math.max(maxC, c);
    });

    var w = (maxC - minC + 1) * PREVIEW_CELL;
    var h = (maxR - minR + 1) * PREVIEW_CELL;
    var offX = (canvasEl.width - w) / 2;
    var offY = (canvasEl.height - h) / 2;

    target.save();
    target.translate(offX, offY);
    forEachCell(matrix, function (r, c) {
      drawCell(target, c - minC, r - minR, COLORS[type], PREVIEW_CELL);
    });
    target.restore();
  }

  function drawPreviews() {
    drawPreview(nextCtx, nextCanvas, nextType);
    drawPreview(holdCtx, holdCanvas, holdType);
  }

  function updateStats() {
    ui.score.textContent = score;
    ui.level.textContent = level;
    ui.lines.textContent = lines;
    var best = Arcade.Scores.best(GAME_ID);
    ui.best.textContent = best === null ? 0 : best;
  }

  function refreshScores() {
    Arcade.Scores.top(GAME_ID, 5).then(function (entries) {
      Arcade.Scores.render(ui.scores, entries);
    });
  }

  /* ---------- loop --------------------------------------------------------- */

  function frame(time) {
    if (!running) return;
    if (!lastFrame) lastFrame = time;
    var delta = time - lastFrame;
    lastFrame = time;

    if (piece) {
      var grounded = collides(piece.matrix, piece.x, piece.y + 1);

      if (grounded) {
        lockTimer += delta;
        if (lockTimer >= LOCK_DELAY) lock();
      } else {
        lockTimer = 0;
        dropTimer += delta;
        if (dropTimer >= dropInterval()) {
          dropTimer = 0;
          piece.y++;
        }
      }
    }

    render();
    if (running) requestAnimationFrame(frame);
  }

  function newGame() {
    board = emptyBoard();
    score = 0;
    lines = 0;
    level = 1;
    over = false;
    holdType = null;
    bag = [];
    nextType = nextFromBag();
    pullNext();
    dropTimer = 0;
    lockTimer = 0;
    drawPreviews();
    render();
    updateStats();
  }

  function start() {
    if (!piece || over) newGame();
    if (over) return;              // newGame can end instantly on a full board
    hideOverlay();
    running = true;
    lastFrame = 0;
    ui.pauseBtn.textContent = 'Pause';
    requestAnimationFrame(frame);
  }

  function pause() {
    if (!running) return;
    running = false;
    ui.pauseBtn.textContent = 'Resume';
    showOverlay('PAUSED', 'Board is waiting.', 'Resume');
  }

  function togglePause() {
    if (over) return start();
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

  var ACTIONS = {
    left: function () { move(-1); },
    right: function () { move(1); },
    rotate: rotate,
    down: softDrop,
    drop: hardDrop,
    hold: hold
  };

  var KEYS = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'rotate', w: 'rotate', W: 'rotate', x: 'rotate', X: 'rotate',
    ArrowDown: 'down', s: 'down', S: 'down',
    c: 'hold', C: 'hold', Shift: 'hold'
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (!running) return start();
      return hardDrop();
    }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      return togglePause();
    }

    var action = KEYS[e.key];
    if (!action) return;
    e.preventDefault();
    if (!running) return;
    ACTIONS[action]();
  });

  document.querySelectorAll('.dpad button, .pad-extra button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (!running) return start();
      ACTIONS[btn.getAttribute('data-act')]();
    });
  });

  // Tapping the board rotates - the most common move on a phone.
  canvas.addEventListener('click', function () {
    if (!running) return start();
    rotate();
  });

  ui.overBtn.addEventListener('click', start);
  ui.pauseBtn.addEventListener('click', togglePause);
  ui.restartBtn.addEventListener('click', function () {
    if (running && score > 0 && !window.confirm('Restart? The current game is lost.')) return;
    running = false;
    newGame();
    start();
  });

  window.addEventListener('blur', function () { if (running) pause(); });

  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    setTimeout(function () { render(); drawPreviews(); }, 0);
  });

  /* ---------- boot --------------------------------------------------------- */

  newGame();
  over = true;                  // first click on the overlay deals a fresh board
  showOverlay('READY?', 'Clear lines to score. Four at once is a Tetris.', 'Start');
  refreshScores();
  updateStats();
})(window.Arcade);
