import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/select-bg-groundline-master-v2.png');
const sourceDir = path.join(root, 'source/assets/championship-re/select');
const publicDir = path.join(root, 'public/assets/championship-re/select');
const width = 941;
const height = 1672;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // ゲート下端と同じ道路境界を原画に固定し、色だまりも背景側で完結させる。
    const background = await sharp(masterPath)
        .resize({ width, height, fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(background).png().toFile(path.join(sourceDir, 'select-bg-final-v2.png')),
        sharp(background).webp({ quality: 92 }).toFile(path.join(publicDir, 'select-bg-final-v2.webp'))
    ]);
    console.log('路面境界と7色の色だまりを含む背景を規格化: 941×1672');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
