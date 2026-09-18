/* ==========================================================================
   NEON ARCADE - Word Guess
   Six tries per word. Solving one keeps the run alive and adds points;
   missing one ends the run and banks the total.
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var GAME_ID = 'word';
  var LENGTH = 5;
  var TRIES = 6;
  var POINTS_PER_TRY_LEFT = 100;   // solved on guess 1 -> 600, on guess 6 -> 100

  var gridEl = document.getElementById('grid');
  var keyboardEl = document.getElementById('keyboard');
  var ui = {
    score: document.getElementById('score'),
    best: document.getElementById('best'),
    streak: document.getElementById('streak'),
    overlay: document.getElementById('overlay'),
    overTitle: document.getElementById('over-title'),
    overText: document.getElementById('over-text'),
    overBtn: document.getElementById('over-btn'),
    giveUpBtn: document.getElementById('giveup-btn'),
    scores: document.getElementById('scores')
  };

  var ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

  var answers = [];
  var valid = null;        // Set of every accepted guess
  var rows = [];           // arrays of box elements
  var keyEls = {};         // letter -> button

  var answer = '';
  var current = '';        // letters typed on the active row
  var rowIndex = 0;
  var locked = true;       // true until the word list has loaded
  var runScore = 0;
  var streak = 0;

  /* ---------- build the DOM once ------------------------------------------- */

  function buildGrid() {
    gridEl.innerHTML = '';
    rows = [];
    for (var r = 0; r < TRIES; r++) {
      var row = Arcade.el('div', 'row');
      var boxes = [];
      for (var c = 0; c < LENGTH; c++) {
        var box = Arcade.el('div', 'box');
        row.appendChild(box);
        boxes.push(box);
      }
      gridEl.appendChild(row);
      rows.push({ el: row, boxes: boxes });
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = '';
    keyEls = {};
    ROWS.forEach(function (letters, i) {
      var row = Arcade.el('div', 'krow');

      if (i === 2) row.appendChild(key('ENTER', 'enter', true));
      letters.split('').forEach(function (letter) {
        var btn = key(letter, letter);
        keyEls[letter] = btn;
        row.appendChild(btn);
      });
      if (i === 2) row.appendChild(key('DEL', 'back', true));

      keyboardEl.appendChild(row);
    });
  }

  function key(label, action, wide) {
    var btn = Arcade.el('button', 'key' + (wide ? ' wide' : ''), label);
    btn.type = 'button';
    btn.addEventListener('click', function () { input(action); });
    return btn;
  }

  /* ---------- game flow ---------------------------------------------------- */

  function nextWord() {
    answer = answers[Arcade.randInt(answers.length)];
    current = '';
    rowIndex = 0;
    locked = false;

    rows.forEach(function (row) {
      row.boxes.forEach(function (box) {
        box.textContent = '';
        box.className = 'box';
      });
    });
    Object.keys(keyEls).forEach(function (letter) {
      keyEls[letter].className = 'key';
    });

    ui.overlay.hidden = true;
    updateStats();
  }

  function input(action) {
    if (locked) return;

    if (action === 'enter') return submit();
    if (action === 'back') {
      current = current.slice(0, -1);
      return paint();
    }
    if (/^[a-z]$/.test(action) && current.length < LENGTH) {
      current += action;
      paint();
    }
  }

  function paint() {
    var boxes = rows[rowIndex].boxes;
    for (var i = 0; i < LENGTH; i++) {
      var letter = current[i] || '';
      if (boxes[i].textContent !== letter) {
        boxes[i].textContent = letter;
        boxes[i].className = 'box' + (letter ? ' filled' : '');
      }
    }
  }

  function reject(message) {
    Arcade.toast(message);
    var row = rows[rowIndex].el;
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function submit() {
    if (current.length < LENGTH) return reject('Not enough letters');
    if (!valid.has(current)) return reject('Not in the word list');

    var marks = score(current, answer);
    var boxes = rows[rowIndex].boxes;

    marks.forEach(function (mark, i) {
      boxes[i].className = 'box ' + mark;
      upgradeKey(current[i], mark);
    });

    if (current === answer) return solved();

    rowIndex++;
    current = '';
    if (rowIndex >= TRIES) return failed();
  }

  /* Two passes so repeated letters mark correctly: exact hits first, then
     the leftovers are matched against what is actually still unaccounted for. */
  function score(guess, target) {
    var marks = new Array(LENGTH).fill('absent');
    var pool = {};

    for (var i = 0; i < LENGTH; i++) {
      if (guess[i] === target[i]) {
        marks[i] = 'correct';
      } else {
        pool[target[i]] = (pool[target[i]] || 0) + 1;
      }
    }
    for (var j = 0; j < LENGTH; j++) {
      if (marks[j] === 'correct') continue;
      var letter = guess[j];
      if (pool[letter] > 0) {
        marks[j] = 'present';
        pool[letter]--;
      }
    }
    return marks;
  }

  /* Keyboard hints only ever get better, never worse. */
  function upgradeKey(letter, mark) {
    var btn = keyEls[letter];
    if (!btn) return;
    var rank = { absent: 1, present: 2, correct: 3 };
    var currentMark = btn.classList.contains('correct') ? 'correct'
      : btn.classList.contains('present') ? 'present'
      : btn.classList.contains('absent') ? 'absent' : null;
    if (currentMark && rank[currentMark] >= rank[mark]) return;
    btn.className = 'key ' + mark;
  }

  function solved() {
    locked = true;
    var gained = (TRIES - rowIndex) * POINTS_PER_TRY_LEFT;
    runScore += gained;
    streak++;
    updateStats();

    ui.overTitle.textContent = rowIndex === 0 ? 'FIRST TRY!' : 'SOLVED';
    ui.overText.textContent = answer.toUpperCase() + ' in ' + (rowIndex + 1) +
      (rowIndex === 0 ? ' guess. ' : ' guesses. ') + '+' + gained + ' points. Run total: ' + runScore + '.';
    ui.overBtn.textContent = 'Next word';
    ui.overlay.hidden = false;
  }

  function failed() {
    locked = true;
    var banked = runScore;
    var finalStreak = streak;

    Arcade.player.ensure();
    Arcade.Scores.submit(GAME_ID, banked).then(function (result) {
      var line = 'The word was ' + answer.toUpperCase() + '. ';
      line += finalStreak ? 'Run ended after ' + finalStreak + ' solved, ' + banked + ' points.'
        : 'Run ended with no words solved.';
      if (result.isBest && banked > 0) line += ' New best!';

      ui.overTitle.textContent = 'OUT OF TRIES';
      ui.overText.textContent = line;
      ui.overBtn.textContent = 'New run';
      ui.overlay.hidden = false;

      runScore = 0;
      streak = 0;
      updateStats();
      refreshScores();
    });
  }

  function updateStats() {
    ui.score.textContent = runScore;
    ui.streak.textContent = streak;
    var best = Arcade.Scores.best(GAME_ID);
    ui.best.textContent = best === null ? 0 : best;
  }

  function refreshScores() {
    Arcade.Scores.top(GAME_ID, 5).then(function (entries) {
      Arcade.Scores.render(ui.scores, entries);
    });
  }

  /* ---------- input -------------------------------------------------------- */

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter') { e.preventDefault(); return input('enter'); }
    if (e.key === 'Backspace') { e.preventDefault(); return input('back'); }
    var letter = e.key.toLowerCase();
    if (/^[a-z]$/.test(letter)) { e.preventDefault(); input(letter); }
  });

  ui.overBtn.addEventListener('click', nextWord);

  ui.giveUpBtn.addEventListener('click', function () {
    if (locked) return;
    if (!window.confirm('Give up on this word? It ends your run.')) return;
    rowIndex = TRIES;
    failed();
  });

  /* ---------- boot --------------------------------------------------------- */

  buildGrid();
  buildKeyboard();
  updateStats();
  refreshScores();

  Arcade.loadData('words.json')
    .then(function (data) {
      answers = data.answers.filter(function (w) { return w.length === LENGTH; });
      valid = new Set(answers.concat(data.extraGuesses || []));
      if (!answers.length) throw new Error('word list is empty');
      nextWord();
    })
    .catch(function (err) {
      ui.overTitle.textContent = 'NO WORDS';
      ui.overText.textContent = 'Could not load the word list. ' + err.message;
      ui.overBtn.hidden = true;
      ui.overlay.hidden = false;
    });
})(window.Arcade);
