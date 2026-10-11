import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const src = join('node_modules', 'cesium', 'Build', 'Cesium');
const dest = join('public', 'cesium');
if (!existsSync(src)) {
  console.warn('[copy-cesium] cesium not installed yet, skipping');
  process.exit(0);
}
rmSync(dest, { recursive: true, force: true });
for (const dir of ['Assets', 'ThirdParty', 'Workers', 'Widgets']) {
  cpSync(join(src, dir), join(dest, dir), { recursive: true });
}
console.log('[copy-cesium] copied to', dest);
