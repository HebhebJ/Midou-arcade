# NEON ARCADE

A small arcade of browser games. Plain HTML, CSS and JavaScript — no framework,
no build step, no dependencies. Every file you deploy is a file you can read.

**Games so far:** Snake · 2048 · Word Guess · Connect Four

---

## Run it locally

The site loads its game list and word list from `/data/*.json`, and browsers
block `fetch` on `file://` URLs. So open it through a local server, not by
double-clicking `index.html`:

```bash
npx serve .
```

Then open the address it prints (usually <http://localhost:3000>).

Any static server works — `python -m http.server`, the VS Code Live Server
extension, whatever you already have.

## Deploy to Vercel

There is nothing to build, so the defaults are right:

1. Push this folder to a Git repo.
2. In Vercel, **Add New → Project** and import the repo.
3. Framework Preset: **Other**. Leave Build Command and Output Directory empty.
4. Deploy.

`vercel.json` only sets clean URLs and cache headers — no configuration needed.

---

## Adding a game

Three steps, and nothing else in the site has to change.

**1. Make the folder.** Copy the closest existing game as a starting point:

```
games/your-game/
  index.html
  game.js
```

In `index.html`, keep `data-root="../../"` on the `<html>` tag — that is how
the shared scripts find `/data` from a nested page — and keep the three shared
tags:

```html
<link rel="stylesheet" href="../../assets/css/arcade.css">
<script src="../../assets/js/core.js"></script>
<script src="../../assets/js/scores.js" defer></script>
```

**2. Register it** in `data/games.json`:

```json
{
  "id": "your-game",
  "name": "YOUR GAME",
  "emoji": "🎮",
  "tag": "Puzzle",
  "players": "1 player",
  "description": "One sentence for the card on the home page.",
  "path": "games/your-game/",
  "accent": "var(--neon-1)",
  "scored": true
}
```

`scored: true` puts the game on the home-page badges and the scores page.
Use `false` for versus games that keep a win tally instead (see Connect Four).

**3. Save scores** from your game code:

```js
Arcade.player.ensure();                        // asks for a name once, then remembers
Arcade.Scores.submit('your-game', score).then(function (result) {
  // result.rank, result.isBest, result.madeTable
});
```

That is it — the card, the best-score badge and the scores page all pick it up.

### What the shared scripts give you

`assets/js/core.js` (loaded on every page) exposes `window.Arcade`:

| Helper | What it does |
| --- | --- |
| `Arcade.store.get/set/remove` | localStorage that never throws in private mode |
| `Arcade.theme.toggle()` | dark ⇄ light, remembered across visits |
| `Arcade.player.get/set/ensure()` | the player's arcade name |
| `Arcade.toast(msg)` | brief message at the bottom of the screen |
| `Arcade.el(tag, class, text)` | shorthand element creation |
| `Arcade.randInt(max)` | random integer below `max` |
| `Arcade.loadData('file.json')` | reads `/data/file.json`, depth-independent |
| `Arcade.onSwipe(el, fn)` | touch swipes as `'up' \| 'down' \| 'left' \| 'right'` |

`assets/js/scores.js` exposes `Arcade.Scores`: `submit`, `top`, `best`,
`clear`, `render`.

### Adding words to Word Guess

Edit `data/words.json`. `answers` are words the game can pick; `extraGuesses`
are accepted as guesses but never chosen. Every entry must be exactly five
lowercase letters. No code changes needed.

---

## Where scores live

In the player's browser, under `localStorage`. That means:

- scores survive refreshes and closing the tab
- they do **not** follow a player to another device or browser
- nothing is uploaded anywhere, and the site works offline

**If you ever want a real global leaderboard**, `assets/js/scores.js` is the
only file that has to change. Every function in it already returns a Promise
for exactly this reason, so replacing the bodies with `fetch('/api/scores')`
calls needs no changes in any game. You would add a Vercel serverless function
under `/api` plus somewhere to store rows — Vercel's own filesystem is
read-only at runtime, so a plain JSON file on disk cannot work for this.

---

## Layout

```
index.html              home page, game cards
leaderboard.html        high scores, one board per game
vercel.json             clean URLs + cache headers
data/
  games.json            the game registry — the home page is built from this
  words.json            Word Guess dictionary
assets/
  css/arcade.css        every style in the site
  js/core.js            shared helpers, loaded everywhere
  js/scores.js          score storage  ← swap this for a global leaderboard
  js/hub.js             home page
  js/leaderboard.js     scores page
games/
  snake/                canvas, keyboard + swipe + on-screen d-pad
  2048/                 grid puzzle, swipe support
  word/                 five letters, six tries, run-based scoring
  connect4/             hot-seat two player, or a heuristic CPU
```

## Design notes

- Dark neon is the default theme; light is a toggle in the top bar, remembered.
- Colours come from CSS custom properties on `:root` — change the four
  `--neon-*` values in `arcade.css` to restyle the whole arcade.
- Every game works with touch: swipes plus a d-pad on Snake and 2048,
  an on-screen keyboard on Word Guess, tap-a-column on Connect Four.
- Headings use *Press Start 2P* from Google Fonts, falling back to the system
  monospace stack if it does not load.
