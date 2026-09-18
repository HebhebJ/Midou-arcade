/* ==========================================================================
   NEON ARCADE - home page
   Builds the game cards from data/games.json, so adding a game to the arcade
   is a JSON edit plus a folder under /games.
   ========================================================================== */

(function (Arcade) {
  'use strict';

  var grid = document.getElementById('game-grid');
  if (!grid) return;

  function card(game) {
    var a = Arcade.el('a', 'card');
    a.href = game.path;
    a.style.setProperty('--accent', game.accent || 'var(--neon-1)');

    a.appendChild(Arcade.el('div', 'emoji', game.emoji || '🎮'));
    a.appendChild(Arcade.el('h3', null, game.name));
    a.appendChild(Arcade.el('p', null, game.description));

    var badges = Arcade.el('div', 'badges');
    badges.appendChild(Arcade.el('span', 'badge', game.tag));
    badges.appendChild(Arcade.el('span', 'badge', game.players));

    if (game.scored) {
      var best = Arcade.Scores.best(game.id);
      if (best !== null) badges.appendChild(Arcade.el('span', 'badge best', 'Best ' + best));
    }

    a.appendChild(badges);
    return a;
  }

  Arcade.loadData('games.json')
    .then(function (games) {
      grid.innerHTML = '';
      games.forEach(function (game) { grid.appendChild(card(game)); });
    })
    .catch(function (err) {
      grid.innerHTML = '';
      var msg = Arcade.el('p', null, 'Could not load the game list. ' + err.message);
      msg.style.color = 'var(--muted)';
      grid.appendChild(msg);
    });
})(window.Arcade);
