import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-interior-test-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 585;
const height = 692;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const metadata = await sharp(masterPath).metadata();
    const cropWidth = Math.round(metadata.height * width / height);
    const left = Math.round((metadata.width - cropWidth) / 2);
    // 地面と消失点の遠近感を変えないよう、正方形原画は横だけを中心トリミングして等比縮小する。
    const interior = await sharp(masterPath)
        .extract({ left, top: 0, width: cropWidth, height: metadata.height })
        .resize({ width, height, fit: 'contain' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(interior).png().toFile(path.join(sourceDir, 'summon-interior-test-final-v1.png')),
        sharp(interior).webp({ quality: 94 }).toFile(path.join(publicDir, 'summon-interior-test-final-v1.webp'))
    ]);
    console.log('大型召喚ゲート内のテスト背景を規格化: 585×692 / 等比・横のみ中心トリミング');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
