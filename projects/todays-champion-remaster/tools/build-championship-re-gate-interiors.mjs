import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/gates/gate-interior-aura-well-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/gates/interiors');
const publicDir = path.join(root, 'public/assets/championship-re/gates/interiors');

// 枠の透明窓と同寸で書き出す。ゲーム側で縦横別に伸ばす余地をなくし、全員で床位置を揃える。
const width = 370;
const height = 3137;
const sourceCrop = { left: 280, top: 0, width: 234, height: 1983 };
const fighters = [
    { id: 'raven', color: '#55dffc' },
    { id: 'mika', color: '#ff5ca8' },
    { id: 'brick', color: '#ffb14f' },
    { id: 'noise', color: '#a776ff' },
    { id: 'kiri', color: '#b1c4f6' },
    { id: 'vivi', color: '#e8f2ff' },
    { id: 'tomega9', color: '#ff534c' }
];

async function makeInterior({ id, color }) {
    // 同じ無彩色マスターを色相だけ変える。個別生成で床・オーラ・ノイズの位置がずれるのを防ぐ。
    const interior = await sharp(masterPath)
        .extract(sourceCrop)
        .resize({ width, height, fit: 'fill' })
        .tint(color)
        .png()
        .toBuffer();
    await Promise.all([
        sharp(interior).png().toFile(path.join(sourceDir, `gate-interior-${id}-v1.png`)),
        sharp(interior).webp({ quality: 93, effort: 6 }).toFile(path.join(publicDir, `gate-interior-${id}-v1.webp`))
    ]);
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighters.map(makeInterior));
    console.log('共通オーラ空間を同一構図の7色ゲート内背景へ展開した。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
