import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/championship-re-cta-master-v3.png');
const sourceDir = path.join(root, 'source/assets/championship-re/ui');
const publicDir = path.join(root, 'public/assets/championship-re/ui');
const width = 1600;
const height = 400;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 文字も金属面へ彫り込んだ写真素材として一体化し、CTAの質感を最後まで保つ。
    const { data, info } = await sharp(masterPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = Buffer.from(data);
    // 黒色だけを手掛かりにすると、濡れた黒鉄の中央面まで外側扱いになってしまう。
    // 写真素材の輪郭に合わせた角丸プレート形状だけを残し、内部は色を問わず不透明にする。
    const left = Math.round(info.width * 0.018);
    const right = Math.round(info.width * 0.982);
    const top = Math.round(info.height * 0.16);
    const bottom = Math.round(info.height * 0.84);
    const radius = Math.round((bottom - top) * 0.34);
    const isInsidePlate = (x, y) => {
        const nearestX = Math.max(left + radius, Math.min(x, right - radius));
        const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
        return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
    };
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            if (!isInsidePlate(x, y)) pixels[(y * info.width + x) * 4 + 3] = 0;
        }
    }
    const cta = await sharp(pixels, { raw: { width: info.width, height: info.height, channels: 4 } })
        .resize({ width, height, fit: 'fill' })
        .png()
        .toBuffer();
    await Promise.all([
        sharp(cta).png().toFile(path.join(sourceDir, 'start-duel-final-v4.png')),
        sharp(cta).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'start-duel-final-v4.webp'))
    ]);
    console.log('新規CTA写真枠を共通原図へ規格化: 1600×400 / 表示680×170');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
