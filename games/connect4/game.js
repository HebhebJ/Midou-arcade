/* ==========================================================================
   NEON ARCADE - Connect Four
   Hot-seat two player, or against a small heuristic CPU.
   No leaderboard: a versus game keeps a win tally instead.
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var COLS = 7;
  var ROWS = 6;
  var EMPTY = 0;
  var P1 = 1;          // pink, always the human
  var P2 = 2;          // yellow, human or CPU

  var boardEl = document.getElementById('board');
  var ui = {
    turnText: document.getElementById('turn-text'),
    turnChip: document.querySelector('.turn .chip'),
    winsP1: document.getElementById('wins-p1'),
    winsP2: document.getElementById('wins-p2'),
    draws: document.getElementById('draws'),
    labelP2: document.getElementById('label-p2'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    overBtn: document.getElementById('over-btn'),
    restartBtn: document.getElementById('restart-btn'),
    resetBtn: document.getElementById('reset-btn'),
    mode2p: document.getElementById('mode-2p'),
    modeCpu: document.getElementById('mode-cpu')
  };

  var slots = [];        // ROWS * COLS elements, row-major from the top
  var grid = [];         // [row][col]
  var turn = P1;
  var over = false;
  var vsCpu = Arcade.store.get('connect4.vsCpu', false);
  var tally = Arcade.store.get('connect4.tally', { p1: 0, p2: 0, draws: 0 });

  /* ---------- board -------------------------------------------------------- */

  function build() {
    boardEl.innerHTML = '';
    slots = [];
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var slot = Arcade.el('div', 'slot');
        slot.setAttribute('data-col', String(c));
        slot.addEventListener('click', onColumnClick);
        boardEl.appendChild(slot);
        slots.push(slot);
      }
    }
  }

  function slotAt(r, c) {
    return slots[r * COLS + c];
  }

  function reset() {
    grid = [];
    for (var r = 0; r < ROWS; r++) {
      grid.push([]);
      for (var c = 0; c < COLS; c++) grid[r].push(EMPTY);
    }
    turn = P1;
    over = false;
    slots.forEach(function (slot) { slot.className = 'slot'; });
    ui.overlay.hidden = true;
    renderTurn();
  }

  /* Lowest free row in a column, or -1 when it is full. */
  function landingRow(board, col) {
    for (var r = ROWS - 1; r >= 0; r--) {
      if (board[r][col] === EMPTY) return r;
    }
    return -1;
  }

  function drop(col, who) {
    var row = landingRow(grid, col);
    if (row < 0) return null;
    grid[row][col] = who;

    var slot = slotAt(row, col);
    slot.className = 'slot drop ' + (who === P1 ? 'p1' : 'p2');
    if (landingRow(grid, col) < 0) markColumnFull(col);

    return { r: row, c: col };
  }

  function markColumnFull(col) {
    for (var r = 0; r < ROWS; r++) slotAt(r, col).classList.add('full');
  }

  /* ---------- win detection ------------------------------------------------ */

  var LINES = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function winningLine(board, r, c) {
    var who = board[r][c];
    if (who === EMPTY) return null;

    for (var i = 0; i < LINES.length; i++) {
      var dr = LINES[i][0], dc = LINES[i][1];
      var cells = [{ r: r, c: c }];

      for (var sign = -1; sign <= 1; sign += 2) {
        var rr = r + dr * sign, cc = c + dc * sign;
        while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && board[rr][cc] === who) {
          cells.push({ r: rr, c: cc });
          rr += dr * sign;
          cc += dc * sign;
        }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  }

  function isFull(board) {
    return board[0].every(function (v) { return v !== EMPTY; });
  }

  /* ---------- turns -------------------------------------------------------- */

  function onColumnClick(e) {
    if (over) return;
    if (vsCpu && turn === P2) return;       // CPU is thinking
    play(Number(e.currentTarget.getAttribute('data-col')));
  }

  function play(col) {
    var placed = drop(col, turn);
    if (!placed) return;                     // column was full

    var line = winningLine(grid, placed.r, placed.c);
    if (line) return finish(turn, line);
    if (isFull(grid)) return finish(null, null);

    turn = turn === P1 ? P2 : P1;
    renderTurn();

    if (vsCpu && turn === P2) {
      setTimeout(cpuMove, 380);
    }
  }

  function finish(winner, line) {
    over = true;
    if (line) line.forEach(function (cell) { slotAt(cell.r, cell.c).classList.add('win'); });

    if (winner === P1) tally.p1++;
    else if (winner === P2) tally.p2++;
    else tally.draws++;
    Arcade.store.set('connect4.tally', tally);
    renderTally();

    ui.overTitle.textContent = winner ? (winner === P1 ? 'PINK WINS' : (vsCpu ? 'CPU WINS' : 'YELLOW WINS')) : 'DRAW';
    ui.overText.textContent = winner
      ? 'Four in a row. Tally is now ' + tally.p1 + ' - ' + tally.p2 + '.'
      : 'Board full with nobody connected. Tally is now ' + tally.p1 + ' - ' + tally.p2 + '.';
    ui.overlay.hidden = false;
  }

  function renderTurn() {
    var pink = turn === P1;
    ui.turnChip.className = 'chip ' + (pink ? 'p1' : 'p2');
    ui.turnText.textContent = pink ? 'Pink to play' : (vsCpu ? 'CPU thinking...' : 'Yellow to play');
  }

  function renderTally() {
    ui.winsP1.textContent = tally.p1;
    ui.winsP2.textContent = tally.p2;
    ui.draws.textContent = tally.draws;
    ui.labelP2.textContent = vsCpu ? 'CPU' : 'Yellow';
  }

  /* ---------- CPU ---------------------------------------------------------- */

  /* Take the win, else block theirs, else avoid handing them a win on the
     reply, else lean towards the middle where more lines run through. */
  function cpuMove() {
    if (over) return;

    var playable = [];
    for (var c = 0; c < COLS; c++) {
      if (landingRow(grid, c) >= 0) playable.push(c);
    }
    if (!playable.length) return;

    var winning = playable.filter(function (c) { return wouldWin(c, P2); });
    if (winning.length) return play(winning[0]);

    var blocking = playable.filter(function (c) { return wouldWin(c, P1); });
    if (blocking.length) return play(blocking[0]);

    var safe = playable.filter(function (c) { return !givesAwayWin(c); });
    var pool = safe.length ? safe : playable;

    var centerFirst = pool.slice().sort(function (a, b) {
      return Math.abs(a - 3) - Math.abs(b - 3);
    });
    // Pick from the two most central safe columns so it is not fully predictable.
    var choice = centerFirst[Arcade.randInt(Math.min(2, centerFirst.length))];
    play(choice);
  }

  function wouldWin(col, who) {
    var row = landingRow(grid, col);
    if (row < 0) return false;
    grid[row][col] = who;
    var win = !!winningLine(grid, row, col);
    grid[row][col] = EMPTY;
    return win;
  }

  /* Does dropping here open a winning square for P1 directly above? */
  function givesAwayWin(col) {
    var row = landingRow(grid, col);
    if (row <= 0) return false;
    grid[row][col] = P2;
    var above = row - 1;
    grid[above][col] = P1;
    var loses = !!winningLine(grid, above, col);
    grid[above][col] = EMPTY;
    grid[row][col] = EMPTY;
    return loses;
  }

  /* ---------- controls ----------------------------------------------------- */

  function setMode(useCpu) {
    vsCpu = useCpu;
    Arcade.store.set('connect4.vsCpu', vsCpu);
    ui.mode2p.setAttribute('aria-pressed', String(!vsCpu));
    ui.modeCpu.setAttribute('aria-pressed', String(vsCpu));
    renderTally();
    reset();
  }

  ui.mode2p.addEventListener('click', function () { setMode(false); });
  ui.modeCpu.addEventListener('click', function () { setMode(true); });

  ui.overBtn.addEventListener('click', reset);
  ui.restartBtn.addEventListener('click', reset);

  ui.resetBtn.addEventListener('click', function () {
    if (!window.confirm('Reset the win tally?')) return;
    tally = { p1: 0, p2: 0, draws: 0 };
    Arcade.store.set('connect4.tally', tally);
    renderTally();
    Arcade.toast('Tally reset');
  });

  /* ---------- boot --------------------------------------------------------- */

  build();
  setMode(vsCpu);
  renderTally();
})(window.Arcade);
