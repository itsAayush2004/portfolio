# portfolio

> A scroll-driven 3D gallery that doubles as my CV.
> **Live → [itsaayush2004.github.io/portfolio](https://itsaayush2004.github.io/portfolio/)**

You walk in through a doorway. Scrolling moves the camera down a white gallery corridor; each
artwork on the wall is a project, and the text panel beside it is the write-up. One room near the
end holds the numbers.

Built as a single self-contained `index.html` — no build step, no bundler, no dependencies to
install. Three.js and Chart.js load from CDN.

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

**Scroll → camera.** Body is `900vh` tall. Scroll position normalises to `0…1`, which maps linearly
to camera `z` along the corridor. The value is damped each frame (`current += (target - current) * 0.075`)
so the camera glides rather than snaps.

**Text lives in the DOM, not the canvas.** WebGL renders the room shell — floor, walls, framed
canvases, spotlights, dust. Every readable word is real HTML positioned over the top. That keeps the
site selectable, searchable, screen-reader friendly, and legible if WebGL fails.

**Artworks are canvas textures.** Each framed piece on the wall is drawn with the Canvas 2D API at
1024×1280, then wrapped in a `CanvasTexture`. No image files, no network requests.

**Graceful degradation.**

- No WebGL → canvas hides itself, the DOM content stands alone and stays fully readable
- `prefers-reduced-motion` → camera drift, dust and easing all switch off
- Mobile → pixel ratio capped at 1.5, shadows and particles disabled, side nav hidden

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
