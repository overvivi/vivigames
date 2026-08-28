import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sheetPath = path.join(root, 'source/assets/championship-re/references/championship-re-frame-layout-master-v1.png');
const sourceDir = path.join(root, 'source/assets/championship-re/frames');
const publicDir = path.join(root, 'public/assets/championship-re/frames');
// モバイルGPUの4096px上限を越えない原画寸法にする。表示時の100×640規格は変えない。
const width = 450;
const height = 3477;
const windowRect = { left: 40, top: 170, width: 370, height: 3137 };
const variants = {
    normal: { left: 34, top: 0, width: 458, height: 1536 },
    select: { left: 532, top: 0, width: 458, height: 1536 }
};

async function makeFrame(crop) {
    // 上下・左右を別パーツに分けると縮尺境界に隙間が出るため、原画を一枚のまま規格化する。
    const combined = await sharp(sheetPath).extract(crop).resize({ width, height, fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const output = Buffer.from(combined.data);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const inWindow = x >= windowRect.left && x < windowRect.left + windowRect.width
                && y >= windowRect.top && y < windowRect.top + windowRect.height;
            const inCorner = (x < 18 || x >= width - 18) && (y < 18 || y >= height - 18);
            if (inWindow || inCorner) output[index + 3] = 0;
        }
    }
    return sharp(output, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const [normal, select] = await Promise.all([makeFrame(variants.normal), makeFrame(variants.select)]);
    await Promise.all([
        sharp(normal).png().toFile(path.join(sourceDir, 'championship-re-frame-normal-final-v1.png')),
        sharp(normal).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-frame-normal-final-v1.webp')),
        sharp(select).png().toFile(path.join(sourceDir, 'championship-re-frame-select-final-v1.png')),
        sharp(select).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-frame-select-final-v1.webp'))
    ]);
    console.log('新規枠を連続したGPU安全原図へ規格化: 450×3477 / 表示110×850');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
