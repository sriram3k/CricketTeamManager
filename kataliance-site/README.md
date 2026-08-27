# Kataliance Partners LLP — website

Source material: `Kataliance_Partners_LLP_Profile.pdf` (firm profile deck).
All copy, brand colours, logo and partner photographs on these pages come from that deck.

## Contents

| Path | What it is |
|---|---|
| `concepts.src.html` | Authoring source for the three design directions. Image references are the tokens `__LOGO__`, `__LOGOLIGHT__`, `__MONO__`, `__MONOLIGHT__`, `__AHONA__`, `__MUDIT__`. |
| `concepts.html` | Built, self-contained version — every asset inlined as a data URI. This is what gets published. |
| `build.py` | Inlines `assets/` into the source and writes `concepts.html`. |
| `assets/` | Brand assets extracted from the PDF. |

## Build

```bash
python3 build.py
```

## Assets

`logo.png` / `monogram.png` are for light backgrounds; `logo-light.png` / `monogram-light.png`
are the same marks with the navy knocked out to parchment, for use on the navy and near-black
grounds. All four have transparent backgrounds.

## The three directions

- **A — The Register.** Classic institutional. Navy `#0C1730`, gold `#B08D3F`, parchment
  `#F4F1E8`; Cormorant Garamond / Lato. Practice areas set as a printed register.
- **B — The Filing Desk.** Modern professional services. Navy `#132443`, gold `#9C7A28`, cool
  paper `#EEF1F5`; Source Serif 4 / IBM Plex Sans / IBM Plex Mono. Hero built around the
  statutory filing calendar.
- **C — Counsel.** Dark editorial. Near-black `#070C18`, gold `#D4A94F`, bone `#E9E5DB`;
  Bodoni Moda / Archivo. Oversized display type, hover-revealed practice list.

## Still to do once a direction is chosen

The concepts are homepages only. A full site needs interior pages (firm, each practice area,
partner profiles, contact), a real contact form endpoint, favicon and OG images, `sitemap.xml`
and `robots.txt`, and a hosting target for `kataliance.in`.
