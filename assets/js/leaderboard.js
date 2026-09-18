/* ==========================================================================
   NEON ARCADE - scores page
   One board per scored game, read straight out of local storage.
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var host = document.getElementById('boards');
  var clearBtn = document.getElementById('clear-all');
  if (!host) return;

  var loaded = [];

  function board(game) {
    var block = Arcade.el('section', 'board-block');
    block.style.setProperty('--accent', game.accent || 'var(--neon-1)');

    var head = Arcade.el('h2', null, game.emoji + '  ' + game.name);
    block.appendChild(head);

    var list = Arcade.el('ol', 'scorelist');
    block.appendChild(list);

    Arcade.Scores.top(game.id, 5).then(function (rows) {
      Arcade.Scores.render(list, rows);
    });

    return block;
  }

  Arcade.loadData('games.json')
    .then(function (games) {
      loaded = games;
      var scored = games.filter(function (g) { return g.scored; });
      if (!scored.length) {
        host.appendChild(Arcade.el('p', null, 'No scored games yet.'));
        return;
      }
      scored.forEach(function (game) { host.appendChild(board(game)); });
    })
    .catch(function (err) {
      var msg = Arcade.el('p', null, 'Could not load the game list. ' + err.message);
      msg.style.color = 'var(--muted)';
      host.appendChild(msg);
    });

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (!window.confirm('Delete every saved score on this device?')) return;
      loaded.forEach(function (game) { Arcade.Scores.clear(game.id); });
      Arcade.toast('All scores cleared');
      setTimeout(function () { window.location.reload(); }, 600);
    });
  }
})(window.Arcade);
