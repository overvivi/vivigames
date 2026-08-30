import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const lineupCutoutDir = path.join(root, 'source/assets/championship-re/gates/cutouts/v6-normal-review');
const selectedCutoutDir = path.join(root, 'source/assets/championship-re/gates/cutouts/v6-selected-review');
const sourceDir = path.join(root, 'source/assets/championship-re/gates/characters');
const publicDir = path.join(root, 'public/assets/championship-re/gates/characters');

// 現行の連続枠450×3477に対する透明窓370×3137と同寸にする。
// この比率で完成絵を作るため、ゲーム側で人物画像を縦横別に拡縮しない。
const artWidth = 370;
const artHeight = 3137;
const fighterIds = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];
// 身長差を見せるためだけの差。顔の寄りやカメラ距離で大きく見せ分けない。
// 同じ足元へ等比配置し、最小～最大でも枠外へ飛び出さない範囲に留める。
const characterHeights = { raven: 2400, mika: 2400, brick: 2250, noise: 2250, kiri: 2540, vivi: 2325, tomega9: 2250 };

async function removeBakedCheckerboard(input) {
    // 生成器がalphaではなく白灰のチェック柄を焼き込んだ場合だけ、外周から連結した
    // 無彩色の明部を透明へ戻す。白い羽など、輪郭で囲まれたキャラ本体は消さない。
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const visited = new Uint8Array(width * height);
    const queue = [];
    const isChecker = (pixel) => {
        const r = data[pixel * channels];
        const g = data[pixel * channels + 1];
        const b = data[pixel * channels + 2];
        return r >= 236 && g >= 236 && b >= 236 && Math.max(r, g, b) - Math.min(r, g, b) <= 10;
    };
    const enqueue = (x, y) => {
        const pixel = y * width + x;
        if (!visited[pixel] && isChecker(pixel)) {
            visited[pixel] = 1;
            queue.push(pixel);
        }
    };
    for (let x = 0; x < width; x += 1) { enqueue(x, 0); enqueue(x, height - 1); }
    for (let y = 1; y < height - 1; y += 1) { enqueue(0, y); enqueue(width - 1, y); }
    for (let head = 0; head < queue.length; head += 1) {
        const pixel = queue[head];
        data[pixel * channels + 3] = 0;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        if (x > 0) enqueue(x - 1, y);
        if (x + 1 < width) enqueue(x + 1, y);
        if (y > 0) enqueue(x, y - 1);
        if (y + 1 < height) enqueue(x, y + 1);
    }
    return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

async function makeGateArt(id, state) {
    const cutoutDir = state === 'lineup' ? lineupCutoutDir : selectedCutoutDir;
    const sourceState = state === 'lineup' ? 'normal' : 'selected';
    const cutoutPath = path.join(cutoutDir, `${id}-${sourceState}.png`);
    const characterHeight = characterHeights[id];
    // 原画周辺の透明余白だけを除き、高さだけで規格化する。縦横別の引き伸ばしは絶対にしない。
    const cleanCutout = await removeBakedCheckerboard(cutoutPath);
    const trimmed = await sharp(cleanCutout).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 12 }).png().toBuffer();
    const resized = await sharp(trimmed).resize({ height: characterHeight, fit: 'contain' }).png().toBuffer();
    const resizedMeta = await sharp(resized).metadata();
    // 細い通常ゲートでは腕・コートの横端だけを構図として切る。全身を縮小して遠ざけない。
    const character = (resizedMeta.width ?? 0) > artWidth
        ? await sharp(resized).extract({ left: Math.round(((resizedMeta.width ?? artWidth) - artWidth) / 2), top: 0, width: artWidth, height: resizedMeta.height ?? characterHeight }).png().toBuffer()
        : resized;
    const meta = await sharp(character).metadata();
    const baseline = 3070;
    // キャラだけを透明キャンバスへ置く。背景を含めないことで、非選択時にもゲート内空間を不透明に保てる。
    const art = await sharp({
        create: { width: artWidth, height: artHeight, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
        .composite([{ input: character, left: Math.round((artWidth - (meta.width ?? 0)) / 2), top: baseline - (meta.height ?? 0) }])
        .png()
        .toBuffer();
    const stem = `gate-character-${id}-${state}-v6`;
    await Promise.all([
        sharp(art).png().toFile(path.join(sourceDir, `${stem}.png`)),
        sharp(art).webp({ quality: 93, effort: 6 }).toFile(path.join(publicDir, `${stem}.webp`))
    ]);
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighterIds.flatMap((id) => [makeGateArt(id, 'lineup'), makeGateArt(id, 'selected')]));
    console.log('14枚の透明キャラアートを同じ足元へ等比配置した。人物の縦横比は保持している。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
