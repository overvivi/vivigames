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

async function makeOpeningMask() {
    const { data, info } = await sharp(frameSource).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    const seen = new Uint8Array(pixels);
    const queue = new Int32Array(pixels);
    const mask = Buffer.alloc(pixels * 4, 0);
    let read = 0;
    let write = 0;
    const centre = Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2);
    queue[write++] = centre;
    seen[centre] = 1;
    // 外側の透明とは接続させず、中央の開口だけを背景の表示領域にする。
    // 枠画像の透明な外周まで残すと、内側背景が枠の外へはみ出してしまうため。
    while (read < write) {
        const current = queue[read++];
        if (data[current * 4 + 3] !== 0) continue;
        const x = current % info.width;
        const y = Math.floor(current / info.width);
        mask[current * 4] = 255;
        mask[current * 4 + 1] = 255;
        mask[current * 4 + 2] = 255;
        mask[current * 4 + 3] = 255;
        const neighbours = [current - 1, current + 1, current - info.width, current + info.width];
        for (const next of neighbours) {
            if (next < 0 || next >= pixels || seen[next]) continue;
            const nextX = next % info.width;
            const nextY = Math.floor(next / info.width);
            if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
            seen[next] = 1;
            queue[write++] = next;
        }
    }
    return sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await sharp(frameSource).webp({ quality: 94, alphaQuality: 100, effort: 6 })
        .toFile(path.join(publicDir, 'summon-mini-gate-frame-v1.webp'));
    const openingMask = await makeOpeningMask();
    await Promise.all(fighters.map(async (id) => {
        const interior = await sharp(path.join(referenceDir, `mini-gate-interior-${id}-master-v1.png`))
            .resize({ width, height, fit: 'cover', position: 'centre' })
            .ensureAlpha()
            .composite([{ input: openingMask, blend: 'dest-in' }])
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
