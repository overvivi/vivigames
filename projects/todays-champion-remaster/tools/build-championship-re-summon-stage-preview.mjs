import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-stage-outer-background-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/select');
const publicDir = path.join(root, 'public/assets/championship-re/select');
const width = 941;
const height = 1672;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 確認画面は実機の基準キャンバスへ先に固定する。大型門の敷居とキャラ足元のY=1390を、
    // 外側の濡れた路面へ重ねたときだけ接地感を評価できるため、ここで余白を増やさない。
    const background = await sharp(masterPath)
        .resize({ width, height, fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(background).png().toFile(path.join(sourceDir, 'summon-stage-preview-bg-v1.png')),
        sharp(background).webp({ quality: 92 }).toFile(path.join(publicDir, 'summon-stage-preview-bg-v1.webp'))
    ]);
    console.log('大型召喚ステージ確認用の外側背景を規格化: 941×1672');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
