// Downloads every CC0 asset the temple sites use (Poly Haven) into public/assets.
// Usage: npm run assets   (idempotent: existing files are skipped)
import { mkdirSync, existsSync, writeFileSync, copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import sharp from 'sharp';

const OUT = join('public', 'assets');

// scanned materials: id -> resolution. Full = diffuse + OpenGL normal + packed AO/rough/metal.
const TEXTURES = {
  sandstone_blocks_08: '2k', // Mahakal spire, Somnath stone
  large_sandstone_blocks_01: '2k', // Mahakal lower storeys, Kashi
  red_sandstone_pavement: '2k', // Mahakal courtyard
  marble_01: '1k',
  painted_plaster_wall: '1k',
  bark_brown_02: '1k',
  large_grey_tiles: '2k', // Kedarnath granite
  aerial_rocks_02: '2k', // Kedarnath boulders / Bhim Shila
  stone_tile_wall: '2k', // Kashi
  beige_wall_002: '2k', // Kashi
  large_floor_tiles_02: '2k', // Kashi
  rectangular_paving: '2k', // Somnath promenade
  concrete_wall_006: '2k', // Grishneshwar
  clay_plaster: '2k', // Grishneshwar compound wall
  granite_tile_04: '2k', // Trimbakeshwar
  stone_wall_04: '2k', // Trimbakeshwar
  dark_rock_02: '2k', // Trimbakeshwar basalt
  dry_ground_01: '2k', // Nageshwar
  asphalt_02: '2k', // Nageshwar
  dirty_concrete: '2k', // Nageshwar
  white_stucco: '1k', // Vaidyanath
  white_sandstone_bricks: '1k', // Vaidyanath
  plastered_wall_02: '1k', // Vaidyanath
  red_laterite_soil_stones: '2k', // Bhimashankar
  terracotta_floor_tiles: '2k', // Bhimashankar
  rusty_corrugated_iron: '2k', // Bhimashankar
  mossy_stone_wall: '2k', // Bhimashankar
  clay_roof_tiles: '2k', // Bhimashankar
  forest_leaves_02: '2k', // Bhimashankar
  granite_wall: '2k', // Rameshwaram
  pavement_01: '2k', // Rameshwaram
  aerial_beach_01: '2k', // Rameshwaram
  brick_pavement_03: '2k', // Rameshwaram
};
// terrain textures used for diffuse only (Kedarnath valley)
const DIFFUSE_ONLY = { rocky_terrain_02: '2k', gray_rocks: '2k', snow_02: '2k' };
// sky HDRIs: id -> [resolution, file name the site loads]
const HDRIS = {
  qwantani_sunset_puresky: ['2k', 'qwantani_sunset_puresky.hdr'], // default (Mahakaleshwar)
  kloofendal_48d_partly_cloudy_puresky: ['2k', 'kloofendal_48d_partly_cloudy_puresky_2k.hdr'], // Kedarnath
  kloofendal_38d_partly_cloudy_puresky: ['2k', 'kloofendal_38d_partly_cloudy_puresky_2k.hdr'], // Kashi
  syferfontein_18d_clear_puresky: ['2k', 'syferfontein_18d_clear_puresky.hdr'], // Somnath
  kloofendal_overcast_puresky: ['2k', 'kloofendal_overcast_puresky_2k.hdr'], // Bhimashankar
  overcast_soil_puresky: ['2k', 'overcast_soil_puresky_2k.hdr'], // Rameshwaram
};

async function get(url, dest) {
  if (existsSync(dest)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('  ', dest);
}

/**
 * Textures ship as WebP (~3.5× smaller than Poly Haven's JPGs, no visible loss at these settings):
 * download the JPG, convert, delete the JPG. Colour maps at q82; normal/ARM data maps a little higher.
 */
async function getWebp(url, dest) {
  if (existsSync(dest)) return;
  const jpg = dest.replace(/\.webp$/, '.jpg');
  await get(url, jpg);
  await sharp(jpg).webp({ quality: dest.endsWith('_diff.webp') ? 82 : 85, effort: 5 }).toFile(dest);
  rmSync(jpg);
}

async function files(id) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!res.ok) throw new Error(`${res.status} files/${id}`);
  return res.json();
}

for (const dir of ['tex', 'hdri', 'models']) mkdirSync(join(OUT, dir), { recursive: true });

for (const [id, res] of Object.entries(TEXTURES)) {
  const f = await files(id);
  console.log(id);
  await getWebp(f.Diffuse[res].jpg.url, join(OUT, 'tex', `${id}_diff.webp`));
  await getWebp(f.nor_gl[res].jpg.url, join(OUT, 'tex', `${id}_nor.webp`));
  await getWebp(f.arm[res].jpg.url, join(OUT, 'tex', `${id}_arm.webp`));
}
for (const [id, res] of Object.entries(DIFFUSE_ONLY)) {
  const f = await files(id);
  console.log(id);
  await getWebp(f.Diffuse[res].jpg.url, join(OUT, 'tex', `${id}_diff.webp`));
}
for (const [id, [res, name]] of Object.entries(HDRIS)) {
  const f = await files(id);
  console.log(id);
  await get(f.hdri[res].hdr.url, join(OUT, 'hdri', name));
}

// neem-like tree: Poly Haven tree_small_02 (~100 MB) decimated to ~5 MB with glTF-Transform
const tree = join(OUT, 'models', 'neem.glb');
if (!existsSync(tree)) {
  console.log('tree_small_02 (download + decimate, takes a minute)');
  const work = join(tmpdir(), 'divya-tree');
  mkdirSync(join(work, 'textures'), { recursive: true });
  const g = (await files('tree_small_02')).gltf['1k'].gltf;
  await get(g.url, join(work, 'tree.gltf'));
  for (const [rel, info] of Object.entries(g.include)) await get(info.url, join(work, rel));
  execSync(`npx -y @gltf-transform/cli optimize "${join(work, 'tree.gltf')}" "${join(work, 'neem.glb')}" `
    + '--simplify true --simplify-ratio 0.16 --simplify-error 0.01 --compress meshopt --texture-compress webp --texture-size 1024',
  { stdio: 'inherit' });
  copyFileSync(join(work, 'neem.glb'), tree);
}
// distant-tree LOD: the same tree simplified a further ~8x
const treeLod = join(OUT, 'models', 'neem_lod.glb');
if (!existsSync(treeLod)) {
  const tmp = join(tmpdir(), 'neem_s.glb');
  execSync(`npx -y @gltf-transform/cli simplify "${tree}" "${tmp}" --ratio 0.12 --error 0.03`, { stdio: 'inherit' });
  execSync(`npx -y @gltf-transform/cli meshopt "${tmp}" "${treeLod}"`, { stdio: 'inherit' });
}
console.log('done — all assets CC0 from polyhaven.com');
