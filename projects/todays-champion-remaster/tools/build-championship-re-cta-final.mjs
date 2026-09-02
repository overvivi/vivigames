import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/championship-re-cta-master-v2.png');
const sourceDir = path.join(root, 'source/assets/championship-re/ui');
const publicDir = path.join(root, 'public/assets/championship-re/ui');
const width = 1600;
const height = 400;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 写真調の枠は素材として保ち、読みやすさが必要な操作名だけをPhaserで重ねる。
    const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = Buffer.from(data);
    const seen = new Uint8Array(info.width * info.height);
    const queue = [];
    const isOuterBlack = (x, y) => {
        const i = (y * info.width + x) * 4;
        // 外周に残った黒いマットだけを連結判定で抜く。金属プレート内の暗部は縁で隔てられる。
        return pixels[i + 3] > 0 && pixels[i] < 86 && pixels[i + 1] < 86 && pixels[i + 2] < 86;
    };
    const add = (x, y) => {
        const index = y * info.width + x;
        if (!seen[index] && isOuterBlack(x, y)) { seen[index] = 1; queue.push([x, y]); }
    };
    for (let x = 0; x < info.width; x++) { add(x, 0); add(x, info.height - 1); }
    for (let y = 1; y < info.height - 1; y++) { add(0, y); add(info.width - 1, y); }
    for (let head = 0; head < queue.length; head++) {
        const [x, y] = queue[head];
        const i = (y * info.width + x) * 4;
        pixels[i + 3] = 0;
        if (x > 0) add(x - 1, y);
        if (x + 1 < info.width) add(x + 1, y);
        if (y > 0) add(x, y - 1);
        if (y + 1 < info.height) add(x, y + 1);
    }
    const cta = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
        .resize({ width, height, fit: 'fill' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(cta).png().toFile(path.join(sourceDir, 'start-duel-final-v2.png')),
        sharp(cta).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'start-duel-final-v2.webp'))
    ]);
    console.log('新規CTA写真枠を共通原図へ規格化: 1600×400 / 表示680×170');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
