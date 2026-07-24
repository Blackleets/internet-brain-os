// Build a loadable Chrome MV3 extension package from apps/extension.
// Copies production files (excluding *.test.js) into apps/extension/dist and
// zips them into efesto-extension.zip (portable, no external deps).
import { mkdir, rm, cp, readFile, writeFile, access, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const extDir = join(root, 'apps/extension');
const srcDir = join(extDir, 'src');
const manifestPath = join(extDir, 'manifest.json');
const distDir = join(extDir, 'dist');
const outZip = join(root, 'efesto-extension.zip');
const rootIcon = join(root, 'efesto-icon.png');
const rootIco = join(root, 'efesto-icon.ico');

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile()) yield p;
  }
}

async function zipDir(dir, outZip) {
  const files = [];
  for await (const f of walk(dir)) files.push(f);
  const central = [];
  let offset = 0;
  const out = createWriteStream(outZip);
  const write = (buf) => new Promise((res) => out.write(buf, () => res()));

  for (const file of files) {
    const data = await readFile(file);
    const rel = relative(dir, file).split('\\').join('/');
    const compressed = deflateRawSync(data);
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(Buffer.byteLength(rel), 26);
    local.writeUInt16LE(0, 28);
    await write(local);
    await write(Buffer.from(rel, 'utf8'));
    await write(compressed);
    const size = local.length + Buffer.byteLength(rel) + compressed.length;
    central.push({ rel, crc, compressed: compressed.length, uncompressed: data.length, offset });
    offset += size;
  }

  const centralStart = offset;
  for (const c of central) {
    const buf = Buffer.alloc(46);
    buf.writeUInt32LE(0x02014b50, 0);
    buf.writeUInt16LE(20, 4);
    buf.writeUInt16LE(20, 6);
    buf.writeUInt16LE(0x0800, 8);
    buf.writeUInt16LE(8, 10);
    buf.writeUInt16LE(0, 12);
    buf.writeUInt16LE(0, 14);
    buf.writeUInt32LE(c.crc, 16);
    buf.writeUInt32LE(c.compressed, 20);
    buf.writeUInt32LE(c.uncompressed, 24);
    buf.writeUInt16LE(Buffer.byteLength(c.rel), 28);
    buf.writeUInt16LE(0, 30);
    buf.writeUInt16LE(0, 32);
    buf.writeUInt16LE(0, 34);
    buf.writeUInt16LE(0, 36);
    buf.writeUInt32LE(0, 38);
    buf.writeUInt32LE(c.offset, 42);
    await write(buf);
    await write(Buffer.from(c.rel, 'utf8'));
    offset += buf.length + Buffer.byteLength(c.rel);
  }

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(offset - centralStart, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  await write(end);
  await new Promise((res) => out.end(res));
}

async function main() {
  console.log('[build-extension] cleaning dist...');
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  const distSrc = join(distDir, 'src');
  await mkdir(distSrc, { recursive: true });

  console.log('[build-extension] copying production files...');
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.endsWith('.test.js')) continue;
    await cp(join(srcDir, entry.name), join(distSrc, entry.name));
  }

  console.log('[build-extension] writing manifest with icons...');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (await exists(rootIcon)) {
    const iconDir = join(distDir, 'icons');
    await mkdir(iconDir, { recursive: true });
    for (const size of [16, 48, 128]) {
      await cp(rootIcon, join(iconDir, `icon${size}.png`));
    }
    if (await exists(rootIco)) await cp(rootIco, join(iconDir, 'icon.ico'));
    manifest.icons = { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
    manifest.action = {
      ...(manifest.action || {}),
      default_icon: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
    };
  }
  await writeFile(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log('[build-extension] zipping...');
  await rm(outZip, { force: true });
  await zipDir(distDir, outZip);
  console.log(`[build-extension] done -> ${outZip}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
