import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references');
const sourceDir = path.join(root, 'source/assets/championship-re/ui/mini-gates');
const publicDir = path.join(root, 'public/assets/championship-re/ui/mini-gates');
const frameSource = path.join(root, 'source/assets/championship-re/ui/summon-mini-gate-frame-v1.png');
const fighters = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

// ミニ門の写真素材は枠と同じ縦横比へ中央トリミングする。
// 歪ませると細い窓で模様の密度だけがキャラごとに変わって見えるため、coverを固定する。
const width = 753;
const height = 2089;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await sharp(frameSource).webp({ quality: 94, alphaQuality: 100, effort: 6 })
        .toFile(path.join(publicDir, 'summon-mini-gate-frame-v1.webp'));
    await Promise.all(fighters.map(async (id) => {
        const interior = await sharp(path.join(referenceDir, `mini-gate-interior-${id}-master-v1.png`))
            .resize({ width, height, fit: 'cover', position: 'centre' })
            .png()
            .toBuffer();
        await Promise.all([
            sharp(interior).png().toFile(path.join(sourceDir, `summon-mini-gate-interior-${id}-v1.png`)),
            sharp(interior).webp({ quality: 92, effort: 6 }).toFile(path.join(publicDir, `summon-mini-gate-interior-${id}-v1.webp`))
        ]);
    }));
    console.log('共通枠と7種のミニゲート内側背景を配信用WebPへ規格化した。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
