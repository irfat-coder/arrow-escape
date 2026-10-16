# Arrow Escape

A 3D arrow puzzle for [start.ng](https://start.ng), built with three.js.

Tap an arrow to slide it off the board. It only escapes if nothing is in its way. A blocked arrow costs a heart (3 per level). Clear the board to move to a bigger level.

## start.ng features

- **Your character:** a 3D mascot built from your start.ng `style` (body, top and bottom colours, skin, hair, hat, accessory) stands by the board and reacts to your moves. The arrow blocks also wear your top colour.
- **Profile card:** face, character name and @account at the top left, with a Sign in button for guests.
- **Leaderboard:** best run per player, ranked by levels cleared, then score (see `startng.json`).

## Files

| File | What it does |
|---|---|
| `index.html`, `style.css` | Page and UI |
| `js/main.js` | three.js scene, game loop and input |
| `js/character.js` | Builds the character from the start.ng style |
| `js/levels.js` | Level generator (every board can be cleared) |
| `js/startng.js` | Talks to start.ng's connect page (who's playing, scores, leaderboard) |
| `vendor/three.module.min.js` | three.js r170 (MIT) |
| `startng.json` | Leaderboard columns |
| `cover.png` | Card picture on start.ng |

No build step: it's plain static files. To play locally, run `npx serve .` (or any static server) and open the address it prints. Sign-in and scores only work once the game is live on start.ng.
