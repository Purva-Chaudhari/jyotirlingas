# Landing page — sources and licences

The landing's journey "Through the Third Eye" (src/landing/cosmos.ts) uses public-domain assets, plus one placeholder (below). Its hero, the Linga that holds the universe (src/landing/linga.ts), is entirely procedural — geometry, materials, the galaxy inside, the abhishek and the offerings are generated in code; it uses no model, texture or scan.

| Asset | Source | Author / holder | Licence | In the repo |
|---|---|---|---|---|
| Blue Marble Next Generation, December 2004 (topography + bathymetry), 5400 × 2700 | NASA Earth Observatory / Visible Earth — https://visibleearth.nasa.gov/images/73909 | NASA (Reto Stöckli, NASA Earth Observatory) | Public domain (NASA imagery) | `public/landing/earth/day-{4k,2k}.webp` via `scripts/fetch-landing-earth.mjs` |
| Black Marble 2016 — Earth at Night, 3 km | NASA Earth Observatory — https://earthobservatory.nasa.gov/features/NightLights | NASA Earth Observatory (Joshua Stevens, Miguel Román, NASA GSFC) | Public domain (NASA imagery) | `public/landing/earth/night-{4k,2k}.webp` via `scripts/fetch-landing-earth.mjs` |
| The hub's Shiva (placeholder) | Traced from a reference image (background removed, upscaled), turned into the glass height/detail maps `public/landing/shiva-glass.webp` by `scripts/build-shiva-glass.mjs` from a source image kept outside the repository | — | Unverified — to be replaced with an image we have rights to (same framing, same file name; re-run the script) | `public/landing/shiva-glass.webp` |
| India outline (India point of view) | Natural Earth 1:10m — https://www.naturalearthdata.com | Natural Earth | Public domain | `public/data/landing/india.json` via `scripts/build-landing-map.mjs`; the hub's glass mask `public/landing/india-glass.webp` via `scripts/build-landing-glass.mjs` |

The linga, the nebula, stars, galaxies, the third-eye flare and all sound (tanpura, ghanta, Om swell, cosmic pad) are procedural.

NASA imagery needs no attribution; the page footer credits NASA anyway.

## Statue scans considered earlier (not used)

An earlier hero used the Cleveland Museum of Art's CC0 scan of a Chola *Nataraja* (object 1930.331); it was replaced by the procedural linga and the model was removed from the repo. Other candidates found then:

- Minneapolis Institute of Art — *Shiva, late 10th C CE* (red sandstone, standing), CC0 — Sketchfab uid 010fea0fb44442bc8d0c6888b9d03f18 (also in Objaverse). A good alternative if a standing Shiva is preferred; it is a fragment of a stele, with a broken lower body.
- Minneapolis Institute of Art — *Shiva Nataraja* (bronze, c. 1100), before/after conservation, CC0 — uids 227d1524875042ce90176129ba98de6c, 5bc151d954f74b238079726bf2205c23.
- Birmingham Museum of Art — *Shiva Nataraja* (2013), CC BY (Dolphin Multimedia), 887k triangles — uid c979a955881540dd803eec412df8fe6e.
- Pixel Wave Designs — *Shiva Statue* (brass, photogrammetry), CC BY — uid dc46884200f542318bc80c1b92fc55e0.
