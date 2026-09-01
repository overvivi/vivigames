import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-stage-outer-background-master-v3.png');
const sourceDir = path.join(root, 'source/assets/championship-re/select');
const publicDir = path.join(root, 'public/assets/championship-re/select');
const width = 941;
const height = 1672;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 背景Aは門と人物より後ろで、手前の濡れた路面だけが接地点になる。
    // 低い地平線を保つため、元絵と同じ9:16比のまま規格化し、上下をトリミングしない。
    const background = await sharp(masterPath)
        .resize({ width, height, fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(background).png().toFile(path.join(sourceDir, 'summon-stage-preview-bg-v3.png')),
        sharp(background).webp({ quality: 92 }).toFile(path.join(publicDir, 'summon-stage-preview-bg-v3.webp'))
    ]);
    console.log('大型召喚ステージ確認用の背景Aを規格化: 941×1672');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
