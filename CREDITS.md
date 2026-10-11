# Credits

Copyright © 2026 Purva Chaudhari. This project is licensed under the GNU Affero General Public License v3.0
(AGPL-3.0, see `LICENSE`): you may use, change and share it, and anyone who shares it, or runs a changed
version as a website, must publish their source under the same licence. The third-party material below keeps
its own licence.

Everything on this site that comes from someone else, and its licence. Anything not listed here (the temples'
3D models, the Shiva linga on the landing page, the cosmos, all synthesized sound) is made in code in this
repository.

## Code libraries

| Library | Licence | Used for |
|---|---|---|
| [three.js](https://threejs.org) | MIT | All 3D rendering |
| [CesiumJS](https://cesium.com/platform/cesiumjs/) | Apache 2.0 | The optional flight in over the globe; its imagery credits show on the globe itself |
| [Vite](https://vite.dev) | MIT | Build and dev server |

## Fonts

From [Google Fonts](https://fonts.google.com), all under the SIL Open Font License 1.1: Cinzel, Cormorant
Garamond, Mukta, Martel, Inter and Tiro Devanagari Hindi.

## Maps and geographic data

- **Temple surroundings** (roads, buildings, water round each temple): © [OpenStreetMap](https://www.openstreetmap.org/copyright)
  contributors, under the [ODbL 1.0](https://opendatacommons.org/licenses/odbl/). Fetched by `scripts/fetch-osm.mjs`
  into `public/data/osm/`. Credited on every temple page (the ⓘ in the corner).
- **India outline** on the landing page: [Natural Earth](https://www.naturalearthdata.com) 1:10m, India point of
  view, public domain. Built by `scripts/build-landing-map.mjs` into `public/data/landing/india.json`, and the
  glass mask `public/landing/india-glass.webp` by `scripts/build-landing-glass.mjs`.

## Images and textures

- **Earth** on the landing page (`public/landing/earth/`), by `scripts/fetch-landing-earth.mjs`, public domain
  (NASA imagery):
  - Day: [Blue Marble Next Generation](https://visibleearth.nasa.gov/images/73909), December 2004, by NASA
    Earth Observatory (Reto Stöckli).
  - Night: [Black Marble 2016](https://earthobservatory.nasa.gov/features/NightLights), by NASA Earth
    Observatory (Joshua Stevens, Miguel Román, NASA GSFC).
- **Stone, plaster, ground and roof textures, sky HDRIs and the neem tree** in the temples: from
  [Poly Haven](https://polyhaven.com), CC0. Downloaded by `npm run assets` (`scripts/fetch-assets.mjs`) into
  `public/assets/`, which is not kept in the repository.
- **The glass Shiva** on the landing map (`public/landing/shiva-glass.webp`, built by
  `scripts/build-shiva-glass.mjs`): a placeholder traced from a reference image whose rights are not
  verified. To be replaced with an image we have rights to.
- **Mahakaleshwar's picture** on its landing card (`public/landing/mahakaleshwar.webp`): captured from this
  site's own 3D temple.

## Audio

### Story narration — `public/audio/stories/<temple>/<stop>.<lang>.m4a`

Generated with Microsoft Edge neural text-to-speech through [edge-tts](https://github.com/rany2/edge-tts)
(`npm run narrate`, script `scripts/narrate.py`):

- English: `en-IN-NeerjaExpressiveNeural`, rate +4%
- Hindi: `hi-IN-SwaraNeural`, rate +4% (Neerja does not speak Hindi)

The texts are the story stops in `src/temples/stories/<temple>.json`; each stop's `sources` list where the
facts come from. The `.json` next to each clip holds the word timings used for the highlighted captions.

### Aarti at the Jyotirlinga

#### Mahakaleshwar — `public/audio/aarti/mahakaleshwar-bhasma-aarti.mp3`

"[Shiva Bhasma Aarti – ॐ केवडेश्वर महाकाल आरती | Bhasma Aarti Mahakaleshwar Ujjain | Shiv Aarti](https://www.youtube.com/watch?v=-CsFmf25DxY)"
by **Nova Spiritual India** ([youtube.com/@SpiritualIndia](https://www.youtube.com/@SpiritualIndia)) on YouTube.
Not openly licensed; used at the site owner's choice. It plays at Mahakal's darshan spot in place of the
embedded YouTube aarti, and while it plays the aarti panel credits it with a link to the video
(`aarti.audio` in `src/temples/stories/mahakaleshwar.json`). Unchanged copy of the audio (MP3, 9:50).

#### The other temples

Where a temple trust publishes its aarti on its own YouTube channel (Somnath, Mallikarjuna, Omkareshwar,
Vaidyanath, Kashi Vishwanath), the darshan spot plays it through YouTube's official embedded player: never
downloaded or rehosted, with the channel named on screen. The videos and channels are listed under
`aarti.youtube` in each story file.

The temples' own aarti recordings have no reusable licence (each is "all rights reserved" by its temple
trust; see `aarti.audio` in the story files), so none is copied. Elsewhere, or when YouTube can't play, the
darshan spot plays an aarti ambience synthesized in the browser with the Web Audio API
(`src/temples/stories/aarti.ts`): hand-rung ghanti, the big temple ghanta, shankh blasts, damaru rolls,
nagara/dhol beats and jhanj. No recorded samples, so nothing to attribute.

A recording is played instead only when a story file lists one under a CC0, CC-BY or public-domain licence,
or one the site owner chose to use (`permission`, like Mahakal's above); either way it must be credited here
(title, author, licence, link) and is credited on screen while it plays.

The aarti words shown on screen are traditional public-domain texts, as recorded in each story file's
`aarti.lyrics.source`.

### Landing music

The mridangam and damaru on the landing page are synthesized in the browser with the Web Audio API
(`src/landing/music.ts`). No recordings, so nothing to attribute.
