// Downloads NASA's Blue Marble (day) and Black Marble (night lights) — public domain, NASA Earth Observatory —
// and writes WebP versions for the landing's journey into public/landing/earth/:
//   day-4k.webp / night-4k.webp (desktop) and day-2k.webp / night-2k.webp (phones).
//
//   node scripts/fetch-landing-earth.mjs
// Sources:
//   Blue Marble Next Generation, December 2004 (topography + bathymetry), NASA Earth Observatory / Reto Stöckli
//     https://visibleearth.nasa.gov/images/73909
//   Black Marble 2016 (Earth at Night), NASA Earth Observatory / Joshua Stevens, Miguel Román
//     https://earthobservatory.nasa.gov/features/NightLights
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const SRC = {
  day: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
  night: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg',
};
const out = 'public/landing/earth';
const cache = join(tmpdir(), 'landing-earth');
mkdirSync(out, { recursive: true });
mkdirSync(cache, { recursive: true });


for (const [name, url] of Object.entries(SRC)) {
  const file = join(cache, `${name}.jpg`);
  if (!existsSync(file)) {
    console.log('downloading', url);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  for (const [tag, w, q] of [['4k', 4096, name === 'day' ? 72 : 70], ['2k', 2048, 72]]) {
    let img = sharp(file, { limitInputPixels: false }).resize(w, w / 2, { fit: 'fill' });
    // the night map: lift the city lights a touch, keep the oceans black
    if (name === 'night') img = img.linear(1.15, -6);
    const info = await img.webp({ quality: q, effort: 6 }).toFile(join(out, `${name}-${tag}.webp`));
    console.log(`${name}-${tag}.webp`, (info.size / 1024).toFixed(0), 'KB');
  }
}
