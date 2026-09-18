/* ==========================================================================
   NEON ARCADE - score storage
   --------------------------------------------------------------------------
   Scores live in the browser (localStorage). Nothing is sent anywhere, and
   the site works offline and on a read-only host like Vercel.

   >>> THIS IS THE ONE FILE TO CHANGE IF YOU EVER WANT A GLOBAL LEADERBOARD.
   Every function below returns a Promise on purpose, so swapping the bodies
   for `fetch('/api/scores')` calls needs no changes anywhere else in the site.
   ========================================================================== */

window.Arcade.Scores = (function (Arcade) {
  'use strict';

  var KEEP_PER_GAME = 10;

  function key(gameId) {
    return 'scores.' + gameId;
  }

  function read(gameId) {
    var rows = Arcade.store.get(key(gameId), []);
    return Array.isArray(rows) ? rows : [];
  }

  /* Higher is better for every game we ship so far. If a future game scores
     the other way (fewest moves, fastest time), give it lowerIsBetter: true
     in data/games.json and branch here. */
  function sort(rows, lowerIsBetter) {
    return rows.slice().sort(function (a, b) {
      return lowerIsBetter ? a.score - b.score : b.score - a.score;
    });
  }

  return {
    /* Saves a score and reports back where it landed.
       -> { rank: 1-based place, isBest: true if it is the new #1 } */
    submit: function (gameId, score, options) {
      var opts = options || {};
      var rows = read(gameId);
      var entry = {
        name: Arcade.player.get() || 'PLAYER',
        score: Math.round(score),
        date: Date.now()
      };

      rows.push(entry);
      rows = sort(rows, opts.lowerIsBetter).slice(0, KEEP_PER_GAME);
      Arcade.store.set(key(gameId), rows);

      var rank = rows.indexOf(entry) + 1; // 0 -> did not make the table
      return Promise.resolve({
        rank: rank || null,
        isBest: rank === 1,
        madeTable: rank > 0
      });
    },

    /* Top N scores, best first. */
    top: function (gameId, limit, options) {
      var opts = options || {};
      return Promise.resolve(sort(read(gameId), opts.lowerIsBetter).slice(0, limit || 5));
    },

    /* Best score as a plain number, or null if the game was never played.
       Synchronous because the hub renders badges before first paint. */
    best: function (gameId, options) {
      var rows = sort(read(gameId), (options || {}).lowerIsBetter);
      return rows.length ? rows[0].score : null;
    },

    clear: function (gameId) {
      Arcade.store.remove(key(gameId));
      return Promise.resolve();
    },

    /* Renders a <ol>/<ul> of scores into a container element. */
    render: function (listEl, rows) {
      listEl.innerHTML = '';
      if (!rows.length) {
        var empty = Arcade.el('li', 'empty', 'No scores yet - be the first.');
        listEl.appendChild(empty);
        return;
      }
      rows.forEach(function (row, i) {
        var li = Arcade.el('li');
        li.appendChild(Arcade.el('span', 'rank', String(i + 1)));
        li.appendChild(Arcade.el('span', 'who', row.name || 'PLAYER'));
        li.appendChild(Arcade.el('span', 'when', new Date(row.date).toLocaleDateString()));
        li.appendChild(Arcade.el('span', 'pts', String(row.score)));
        listEl.appendChild(li);
      });
    }
  };
})(window.Arcade);
