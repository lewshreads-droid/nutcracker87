# Nutcracker '87

A 1987-style arcade fighting game where the only move is a kick to the groin. Six fighters, six stages, an arcade ladder, and versus mode. First to ten kicks wins.

**Play:** open the GitHub Pages link for this repo. On Android, open it in Chrome and choose ⋮ → **Install app** to put it on your home screen; it then runs full-screen and offline.

- **Phone:** thumb controls (d-pad left; Kick and Guard right), one-player modes.
- **Keyboard:** P1 A/D move, W jump, S crouch, F kick, G guard. P2 arrows, K kick, L guard. M mute, H hitboxes, P pause, Esc title.

Everything is in `index.html` (canvas + plain JavaScript, no libraries or image assets). `sw.js` and `manifest.webmanifest` make it installable. `tools/make-icons.mjs` regenerates the icons; `tools/serve.mjs` is a local test server.
