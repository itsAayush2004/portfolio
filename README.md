# portfolio

> A scroll-driven 3D gallery that doubles as my CV.
> **Live → [itsaayush2004.github.io/portfolio](https://itsaayush2004.github.io/portfolio/)**

You walk in through a gate. Scrolling moves the camera forward through nine toon-shaded rooms. Every
room has a piece on its back wall, two more on the left and right walls, a museum caption card, a
sculpture rotating on a pedestal, and a built gate ahead of it — columns, beam, brass threshold and
a logo medallion naming whatever is next door. The camera turns to face whichever wall the main
piece hangs on. The copy rides over the top on a frosted glass card that pops in as you arrive.

Built as a single self-contained `index.html` — no build step, no bundler, no dependencies to
install. Three.js and Chart.js load from CDN; every other asset is drawn procedurally at runtime.

---

## Contents

| Room | Section |
|---|---|
| 00 | Intro |
| 01 | Practice — what I actually build |
| 02 | **Arthis.Space** — social gaming platform (live) |
| 03 | **Arthis.Land** — procedural metaverse (live) |
| 04 | **HexaBed** — Unity hex terrain engine |
| 05 | **Blender Add-on Suite** — 28 pipeline tools |
| 06 | **AI Systems** — RAG, FastAPI, GPT-2 from scratch |
| 07 | Evidence — charts and counts |
| 08 | Contact |

---

## How it works

**Scroll → camera.** Body is `900vh` tall. Scroll normalises to `0…1` and maps linearly to camera
`z`. Camera travel is locked to room spacing (`END_Z = START_Z - (N-1) * SPACING`) so the camera
always comes to rest exactly at a room's centre — no drift. The value is damped each frame
(`current += (target - current) * 0.075`) so it glides rather than snaps.

**The camera turns.** Each room hangs its artwork on one half of its back wall. As you enter a room
the look-at target eases sideways toward that wall and returns to dead-ahead in the gates between
rooms, weighted by `smoothstep(1 - |p - i| / 0.5)`.

**Toon shading.** Everything uses `MeshToonMaterial` with a 4-step `DataTexture` ramp on
`NearestFilter`, lit by low ambient + one strong key so the bands actually read. Black
`EdgesGeometry` outlines on every solid give it the drawn, cel-shaded edge.

**Text lives in the DOM, not the canvas.** WebGL renders the room; every readable word is real HTML
on a `backdrop-filter` glass card over the top. That keeps the site selectable, searchable,
screen-reader friendly, and legible even if WebGL fails entirely. The card lands with a spring
transform, a light sweep across the glass, an accent rail wiping down the leading edge, and its
children staggered 60 ms apart.

**Everything is drawn, not downloaded.** Gate signs, artworks, caption cards, floor numerals and all
nine section icons are painted with the Canvas 2D API into `CanvasTexture`s at runtime. Sculptures,
pedestals, benches and plants are built from primitives. The only network images are the two live
product screenshots pulled from the Arthis repos.

**Graceful degradation.**

- No WebGL → canvas hides itself, the DOM content stands alone and stays fully readable
- Screenshot fails to load → the hand-drawn canvas artwork underneath is already there
- `prefers-reduced-motion` → camera drift, turning, dust and easing all switch off
- Mobile → pixel ratio capped at 1.5, particles disabled, side nav hidden, scrim flips to vertical
- Keyboard → arrow keys and PageUp/PageDown walk room to room

---

## Stack

| | |
|---|---|
| 3D | Three.js r128 |
| Charts | Chart.js 4.4 |
| Everything else | Vanilla HTML / CSS / JS |
| Hosting | GitHub Pages |

---

## Run locally

```bash
git clone https://github.com/itsAayush2004/portfolio.git
cd portfolio
python -m http.server 8000
```

Then open `http://localhost:8000`.

Opening `index.html` directly with `file://` also works — there are no fetches or module imports.

---

## About

**Aayush Kumar** — Game Developer · AI & Backend Engineer
B.Tech Electronics & Communication, NIT Jaipur (2026)

- [arthis.space](https://arthis.space) — social gaming platform
- [arthis.land](https://arthis.land) — procedural metaverse
- [youtube.com/@AKverseOfficial](https://www.youtube.com/@AKverseOfficial)
- akversebusiness@gmail.com

---

## License

MIT — see [LICENSE](LICENSE).

The code is free to reuse. The written content, project descriptions and personal details are mine;
please swap them for your own.
