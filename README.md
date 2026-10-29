# portfolio

> Two halves scroll past each other, then fold into one room.

**Live → [itsaayush2004.github.io/portfolio](https://itsaayush2004.github.io/portfolio/)** ·
the earlier walk-through lives on at [`classic.html`](classic.html).

![Two halves, one room](art/og.jpg)

This merges my two earlier portfolios, the walk-through gallery (this repo) and the
[corkboard](https://github.com/itsAayush2004/Board-repo), into one page you only have to scroll.

## How it reads

| Act | What scrolling does |
|---|---|
| **I · Two halves** | Two lanes of real HTML run in opposite directions: **Engineer** on black, **Creator** on vermilion. The room shows through the seam between them. |
| **II · The merge** | The lanes swing open on their outer edges like doors and settle on the side walls. The camera lifts out to show the whole room as a cut-away model, then drops in. |
| **III · The room** | The camera walks nine stations, zig-zagging between the black engineer wall and the red creator wall to the exit at the back. Each station's card opens by itself as you arrive, with the key facts. |

Stations: ARTHIS.space + ARTHIS.land · Blender add-on suite · HexaBed · AKverse · Systems & Inference ·
the Board (CV Forge and the side projects) · the Arcade (four playable games) · the numbers · contact.

Clicking is optional: arrows or `← →` step between stations, `1–9` jump, `E` opens the full write-up,
`M` opens the station list. Scrolling stops on the nearest station by itself.

## Design

- **Palette:** black `#0C0C0D`, paper `#F3F1EC`, vermilion `#F23A1D`. Nothing else.
- **Type:** Archivo at its condensed black width for poster type; Geist for text; Geist Mono for labels and data.
- **Pictures are set in type.** Every project's image is a poster drawn in code (`POSTERS` in `app.js`): a cropped
  numeral, a halftone count, stacked words. The same definitions render as HTML in the lanes and as canvas
  textures on the room's walls. The only photos are the game covers and logos.

## How it works

- **One camera, two renderers.** The lanes are `CSS3DObject`s; the room is WebGL. Both draw from the same
  camera, so the HTML lanes become real walls. The WebGL canvas sits on top and cuts a transparent hole where each
  lane is, so anything standing in front of a lane still hides it.
- **The doors.** Each lane starts at exactly one screen-pixel per CSS pixel (its scale comes from the camera's
  field of view), and is hinged on its outer edge; scroll turns it 90° and scales it onto its wall.
- **Words live in the DOM.** Every word is in `#codex` as plain HTML. The station cards and the full write-ups are
  read from there, screen readers get one document, and the simple view shows it as a normal page.
- **Falls back cleanly.** No WebGL, or a click on *Simple view*, gives a flat two-column page with every word and
  link. `prefers-reduced-motion` drops the easing and ambient motion.

`index.html` (markup and content) · `style.css` · `app.js` · `vendor/` holds Three.js r128 and its CSS3DRenderer,
so nothing loads from a script CDN. No build step.

## Run locally

```bash
git clone https://github.com/itsAayush2004/portfolio.git
cd portfolio
python -m http.server 8000
```

Then open `http://localhost:8000`.

---

## About

**Aayush Kumar** — Game Developer · AI & Backend Engineer
B.Tech Electronics & Communication, NIT Jaipur (2026)

- [arthis.space](https://arthis.space) — browser mini-games platform
- [arthis.land](https://arthis.land) — procedural browser city
- [youtube.com/@AKverseOfficial](https://www.youtube.com/@AKverseOfficial)
- akversebusiness@gmail.com

---

## License

MIT — see [LICENSE](LICENSE).

The code is free to reuse. The written content, the posters in `art/`, the trailer and the personal
details are mine; please swap them for your own (the scenes in `art/src/poster.html` are a good
place to start).
