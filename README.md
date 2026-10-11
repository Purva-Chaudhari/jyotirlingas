# The Twelve Jyotirlingas 🔱

Walk through the twelve Jyotirlingas of Shiva, right in your browser.

This is a 3D web experience where you can explore each mandir on foot, take darshan at the Jyotirlinga, and
hear the legends and history of the place, in English and Hindi, at the spots where they happened. It's for
the devotee far from home, the traveller dreaming of a first visit, and anyone curious about these sacred
places.

**Shri Mahakaleshwar (Ujjain) is open now.** The other eleven are being built and will open one by one.

> **Made with respect.** This project is made with devotion and care. It is not meant to hurt any religious or
> cultural sentiment; its purpose is to share these sacred places, their traditions and their stories with
> everyone, wherever they are. If anything here feels inaccurate or disrespectful, please
> [tell us](https://github.com/Purva-Chaudhari/jyotirlingas/issues) and we'll set it right.

## What you can do

- **Walk the temple** with the keyboard and mouse, or the on-screen joystick on your phone.
- **Jump to any part of the temple** with *Places*: pick a spot and you're walked there.
- **Hear the stories:** a story starts as you reach each spot, with captions you can follow along.
- **Stand before the Jyotirlinga** and hear the aarti in the garbhagriha.
- **Keep track of your journey:** the temples you've visited and the stories you've heard are remembered in
  your browser.

## Help us get it right 🙏

**This project is open to contributions, and it needs you.**

Photography isn't allowed inside many of these temples, so much of the inside (the garbhagriha, the halls,
the shrines, the paths the queue takes) is built from descriptions, plans and memory. Some of it is surely
not quite right. If you have been there, you know things we don't.

You can help by:

- **Correcting what you see:** a wall in the wrong place, a shrine on the wrong side, a missing step or
  doorway, the wrong colour of the stone. [Open an issue](https://github.com/Purva-Chaudhari/jyotirlingas/issues)
  and describe what's different. A rough sketch helps a lot too.
- **Sharing pictures:** wherever photos *are* allowed (outside the mandir, the courtyards, the approach), your
  own pictures help make each place truer. Please share only photos you took yourself, and say in the
  issue that we may use them under an open licence.
- **Improving the stories:** know a legend, a local tradition, or a better source for a fact? Each temple's
  stories live in [`src/temples/stories/`](src/temples/stories/), with the sources they come from. Suggest a
  change in an issue or a pull request.
- **Writing code:** fix a bug, make it run better on phones, help build the next temple. Pull requests are
  very welcome.

## Share your story 🪔

Have you visited a Jyotirlinga? We'd love to hear about it: your darshan, a moment you remember, how the
visit helped you or changed something for you, or anything else you'd like to share.
[Open an issue](https://github.com/Purva-Chaudhari/jyotirlingas/issues) with your story (and the temple's
name). With your permission, stories will be added to the experience in a coming version, so other visitors
can hear them too.

Not sure where to start? Just open an issue and say hello. Small corrections are as valuable as big
features.

### Making a pull request

1. Fork the repository and create a branch for your change.
2. Make your change and try it locally (see below).
3. Open a pull request describing what you changed and why. For corrections to a temple, mention how you
   know (a visit, a book, a source), so we can check it.

## Run it locally

You'll need [Node.js](https://nodejs.org) 20.19 or newer (22 recommended).

```sh
npm install
npm run assets   # downloads the free (CC0) textures and skies from Poly Haven, once
npm run dev      # then open the address it prints, e.g. http://localhost:5173
```

The landing page is at `/`, and each temple has its own address, e.g. `/mahakaleshwar`. Temples that aren't
open yet lead back to the landing page; add `?preview=1` (e.g. `/somnath?preview=1`) to look at one while
working on it.

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Type-checks and builds the site into `dist/` |
| `npm run preview` | Serves the built site |
| `npm run typecheck` | Type-checks only |
| `npm run narrate -- <temple-id>` | Re-records a temple's story narration after its text changes (needs Python with `edge-tts`, and `ffmpeg`) |

## How it's organised

| Where | What |
|---|---|
| `index.html`, `src/landing/` | The landing page: the Shiva linga, the journey through the cosmos, and the glass map of India |
| `temples.html`, `src/temples/` | The temple experience |
| `src/temples/sites/<temple>/` | Each temple's 3D model, built in code |
| `src/temples/stories/<temple>.json` | Each temple's stories, aarti and sources |
| `src/temples/engine/` | Walking, touch controls, Places and the rest of the shared engine |
| `public/audio/stories/` | The recorded story narration |
| `docs/content/` | Research notes behind each temple's stories |
| `scripts/` | Tools to fetch assets and map data, build the landing map and record narration |

## Credits and licence

Built by [Purva Chaudhari](https://github.com/Purva-Chaudhari), with thanks to everyone who contributes.

Everything we use from others (map data, NASA imagery, textures, fonts, libraries, recordings) is listed with
its licence in [CREDITS.md](CREDITS.md).

This project is licensed under the [GNU Affero General Public License v3.0](LICENSE). You're free to use, study,
change and share it; if you share a changed version, or run one as a website, you must publish its source
under the same licence. Contributions are accepted under the same licence.

ॐ नमः शिवाय
