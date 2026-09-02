import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references/summon-characters');
const sourceDir = path.join(root, 'source/assets/championship-re/summon/characters');
const publicDir = path.join(root, 'public/assets/championship-re/summon/characters');
const fighterIds = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

function removeBakedCheckerboard(data, width, height) {
    // 生成器がalphaを返さず、市松だけを絵へ焼き込む場合がある。白い翼・衣装を
    // 色だけで消さないよう、端から連結する無彩色の市松候補だけを背景として扱う。
    const pixelCount = width * height;
    const isChecker = new Uint8Array(pixelCount);
    const transparent = new Uint8Array(pixelCount);
    for (let index = 0; index < pixelCount; index += 1) {
        const offset = index * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const brightness = Math.min(red, green, blue);
        const chroma = Math.max(red, green, blue) - brightness;
        if (brightness >= 220 && chroma <= 14) isChecker[index] = 1;
    }
    const queue = [];
    const add = (index) => {
        if (isChecker[index] && !transparent[index]) {
            transparent[index] = 1;
            queue.push(index);
        }
    };
    for (let x = 0; x < width; x += 1) {
        add(x);
        add((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y += 1) {
        add(y * width);
        add(y * width + width - 1);
    }
    for (let pointer = 0; pointer < queue.length; pointer += 1) {
        const index = queue[pointer];
        const x = index % width;
        const y = Math.floor(index / width);
        if (x > 0) add(index - 1);
        if (x + 1 < width) add(index + 1);
        if (y > 0) add(index - width);
        if (y + 1 < height) add(index + width);
    }
    for (let index = 0; index < pixelCount; index += 1) {
        if (transparent[index]) data[index * 4 + 3] = 0;
    }
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighterIds.map(async (id) => {
        // 透明余白まで原点にすると着地点がずれる。alphaの実体だけを残し、
        // Phaserのbottom originをFOOT BASELINEへそのまま合わせられる形にする。
        const master = sharp(path.join(referenceDir, `summon-character-${id}-master-v1.png`)).ensureAlpha();
        const metadata = await master.metadata();
        const { data, info } = await master.raw().toBuffer({ resolveWithObject: true });
        if (!metadata.hasAlpha) removeBakedCheckerboard(data, info.width, info.height);
        const art = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        await Promise.all([
            sharp(art).png().toFile(path.join(sourceDir, `summon-character-${id}-v1.png`)),
            sharp(art).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `summon-character-${id}-v1.webp`))
        ]);
    }));
    console.log('召喚ステージ用の7キャラを、共通FOOT BASELINEへ揃えられる透過素材に変換しました。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
