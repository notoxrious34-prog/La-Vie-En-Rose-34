import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import toIco from 'to-ico';

const root = path.resolve(process.cwd());
const inputPng = path.join(root, 'frontend', 'public', 'LVR34.png');
const outDir = path.join(root, 'electron', 'build');

if (!fs.existsSync(inputPng)) {
  console.error(`Missing logo file: ${inputPng}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const icoSizes = [16, 24, 32, 48, 64, 128, 256];
const pngSizes = [32, 64, 128, 256, 512, 1024];

// Load source once — avoid re-reading the 470KB file for every size
const sourceBuffer = fs.readFileSync(inputPng);

// Generate ICO buffers sequentially to avoid parallel sharp instances
// blowing past the Node heap when the source PNG is large.
const icoBuffers = [];
for (const size of icoSizes) {
  const buf = await sharp(sourceBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  icoBuffers.push(buf);
}

const ico = await toIco(icoBuffers);
fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);

// Generate PNG sizes sequentially for the same reason
for (const size of pngSizes) {
  const p = path.join(outDir, `icon-${size}.png`);
  await sharp(sourceBuffer)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100 })
    .toFile(p);
  console.log(`  icon-${size}.png`);
}

// Favicon for web build
const publicFaviconPng = path.join(root, 'frontend', 'public', 'favicon-32.png');
await sharp(sourceBuffer)
  .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ quality: 100 })
  .toFile(publicFaviconPng);

console.log('Icons generated:');
console.log(`- ${path.join(outDir, 'icon.ico')}`);
console.log(`- ${path.join(outDir, 'icon-*.png')}`);
console.log(`- ${publicFaviconPng}`);

