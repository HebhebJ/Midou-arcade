/* ==========================================================================
   NEON ARCADE - 2048
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var GAME_ID = '2048';
  var SIZE = 4;
  var TARGET = 2048;

  var board = document.getElementById('board');
  var ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    topTile: document.getElementById('top-tile'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    overBtn: document.getElementById('over-btn'),
    restartBtn: document.getElementById('restart-btn'),
    scores: document.getElementById('scores')
  };

  var cells = [];        // 16 tile elements, row-major
  var grid = [];         // 4x4 of numbers, 0 = empty
  var score = 0;
  var fresh = [];        // indexes to pop-animate after a move
  var finished = false;
  var reachedTarget = false;

  /* ---------- board helpers ------------------------------------------------ */

  function buildCells() {
    board.innerHTML = '';
    cells = [];
    for (var i = 0; i < SIZE * SIZE; i++) {
      var tile = Arcade.el('div', 'tile empty');
      board.appendChild(tile);
      cells.push(tile);
    }
  }

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      g.push([]);
      for (var c = 0; c < SIZE; c++) g[r].push(0);
    }
    return g;
  }

  function freeCells() {
    var out = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (grid[r][c] === 0) out.push({ r: r, c: c });
      }
    }
    return out;
  }

  function addTile() {
    var free = freeCells();
    if (!free.length) return;
    var spot = free[Arcade.randInt(free.length)];
    grid[spot.r][spot.c] = Math.random() < 0.9 ? 2 : 4;
    fresh.push(spot.r * SIZE + spot.c);
  }

  /* ---------- movement ----------------------------------------------------- */

  /* Collapses one row to the left and reports what happened. */
  function slideRow(row) {
    var values = row.filter(function (v) { return v !== 0; });
    var merged = [];
    var gained = 0;

    for (var i = 0; i < values.length; i++) {
      if (values[i] === values[i + 1]) {
        var sum = values[i] * 2;
        merged.push(sum);
        gained += sum;
        if (sum >= TARGET) reachedTarget = true;
        i++;   // skip the tile we just absorbed
      } else {
        merged.push(values[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0);

    var changed = merged.some(function (v, i) { return v !== row[i]; });
    return { row: merged, gained: gained, changed: changed };
  }

  /* Reads the grid as rows pointing in `dir`, so one slideRow covers all four
     directions. Returns the coordinate lists to write back through. */
  function lines(dir) {
    var out = [];
    for (var i = 0; i < SIZE; i++) {
      var line = [];
      for (var j = 0; j < SIZE; j++) {
        if (dir === 'left')  line.push({ r: i, c: j });
        if (dir === 'right') line.push({ r: i, c: SIZE - 1 - j });
        if (dir === 'up')    line.push({ r: j, c: i });
        if (dir === 'down')  line.push({ r: SIZE - 1 - j, c: i });
      }
      out.push(line);
    }
    return out;
  }

  function move(dir) {
    if (finished) return;

    var moved = false;
    fresh = [];

    lines(dir).forEach(function (coords) {
      var values = coords.map(function (p) { return grid[p.r][p.c]; });
      var result = slideRow(values);
      if (!result.changed) return;
      moved = true;
      score += result.gained;
      coords.forEach(function (p, i) { grid[p.r][p.c] = result.row[i]; });
    });

    if (!moved) return;

    addTile();
    render();

    if (reachedTarget && !finished) {
      reachedTarget = false;        // re-arms, so 4096 gets its own shout-out
      Arcade.toast('2048 reached! Keep going for a bigger score.');
    }
    if (!hasMoves()) end();
  }

  function hasMoves() {
    if (freeCells().length) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c];
        if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
        if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
      }
    }
    return false;
  }

  /* ---------- render ------------------------------------------------------- */

  function render() {
    var top = 0;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var index = r * SIZE + c;
        var value = grid[r][c];
        var tile = cells[index];

        tile.textContent = value ? String(value) : '';
        tile.className = 'tile' + (value ? '' : ' empty');
        if (value) tile.setAttribute('data-v', String(value));
        else tile.removeAttribute('data-v');

        if (fresh.indexOf(index) !== -1) {
          // restart the animation even if the class is already there
          void tile.offsetWidth;
          tile.classList.add('pop');
        }
        if (value > top) top = value;
      }
    }

    ui.score.textContent = score;
    ui.topTile.textContent = top || 2;
    var best = Arcade.Scores.best(GAME_ID);
    ui.best.textContent = best === null ? 0 : best;
  }

  function end() {
    finished = true;
    Arcade.player.ensure();
    Arcade.Scores.submit(GAME_ID, score).then(function (result) {
      var line = 'No moves left. You scored ' + score + '.';
      if (result.isBest) line = 'NEW BEST - ' + score + ' points!';
      else if (result.madeTable) line = score + ' points, rank #' + result.rank + '.';
      ui.overTitle.textContent = 'GAME OVER';
      ui.overText.textContent = line;
      ui.overlay.hidden = false;
      refreshScores();
      render();
    });
  }

  function refreshScores() {
    Arcade.Scores.top(GAME_ID, 5).then(function (rows) {
      Arcade.Scores.render(ui.scores, rows);
    });
  }

  function newGame() {
    grid = emptyGrid();
    score = 0;
    fresh = [];
    finished = false;
    reachedTarget = false;
    ui.overlay.hidden = true;
    addTile();
    addTile();
    render();
  }

  /* ---------- input -------------------------------------------------------- */

  var KEYS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right'
  };

  document.addEventListener('keydown', function (e) {
    var dir = KEYS[e.key];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  });

  Arcade.onSwipe(board, move);

  document.querySelectorAll('.dpad button').forEach(function (btn) {
    btn.addEventListener('click', function () { move(btn.getAttribute('data-dir')); });
  });

  ui.overBtn.addEventListener('click', newGame);
  ui.restartBtn.addEventListener('click', function () {
    if (!finished && score > 0 && !window.confirm('Start over? The current game is lost.')) return;
    newGame();
  });

  /* ---------- boot --------------------------------------------------------- */

  buildCells();
  newGame();
  refreshScores();
})(window.Arcade);
