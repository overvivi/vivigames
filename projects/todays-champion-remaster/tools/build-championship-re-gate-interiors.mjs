import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/gates/gate-interior-signal-floor-master-v4.png');
const sourceDir = path.join(root, 'source/assets/championship-re/gates/interiors');
const publicDir = path.join(root, 'public/assets/championship-re/gates/interiors');

// 背景は透明窓だけでなく枠の上下端まで敷く。枠と同じ比率なら、上端・下端に黒い抜けを作らない。
const width = 450;
const height = 3477;
// 原画の中央パネルを、完成規格とほぼ同じ比率(199:1536)で切り出す。
// coverは余る左右数pxだけを切るため、縦横を別倍率で引き伸ばさない。
const sourceCrop = { left: 413, top: 0, width: 199, height: 1536 };
const fighters = [
    { id: 'raven', color: '#55dffc' },
    { id: 'mika', color: '#ff5ca8' },
    { id: 'brick', color: '#ffb14f' },
    { id: 'noise', color: '#a776ff' },
    { id: 'kiri', color: '#b1c4f6' },
    // KIRIの冷たい銀青と近づかないよう、二面性の金具を拾った淡い琥珀に寄せる。
    { id: 'vivi', color: '#f0d59b' },
    { id: 'tomega9', color: '#ff534c' }
];

async function makeInterior({ id, color }) {
    // この原画は床が最下部に来る細長いパネルとして描いている。完成規格と同じ比率で切り、
    // リサイズ時はcoverで余る端だけを落とす。背景を縦横別倍率で伸ばさない。
    const interior = await sharp(masterPath)
        .extract(sourceCrop)
        .resize({ width, height, fit: 'cover', position: 'centre' })
        // 同じ無彩色マスターを色相だけ変える。個別生成で床・オーラ・ノイズの位置がずれるのを防ぐ。
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
