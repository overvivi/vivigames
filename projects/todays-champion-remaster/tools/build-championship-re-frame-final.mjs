import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const sheetPath = path.join(root, 'source/assets/championship-re/references/championship-re-frame-layout-master-v2.png');
const sourceDir = path.join(root, 'source/assets/championship-re/frames');
const publicDir = path.join(root, 'public/assets/championship-re/frames');
// モバイルGPUの4096px上限を越えない原画寸法にする。表示時の100×640規格は変えない。
const width = 450;
const height = 3477;
// 原画中心列の金属が終わる位置（50〜1440px）まで窓を広げる。
// 旧170〜3307は黒い内張りを上下に残しており、背景が10〜90%に見えていた。
const normalWindowRect = { left: 40, top: 120, width: 370, height: 3300 };
const variants = {
    // 下端を路面へ溶かすため、余白や旧ブラケットを含めず新規原画の枠本体だけを切り出す。
    normal: { left: 48, top: 18, width: 414, height: 1464, windowRect: normalWindowRect },
    // 選択枠だけ中央装飾が内側へ深く張り出す。下端と同様に内側を抜き、背景を途中で止めない。
    select: { left: 562, top: 18, width: 414, height: 1464, windowRect: { left: 40, top: 48, width: 370, height: 3372 } }
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
            const inWindow = x >= crop.windowRect.left && x < crop.windowRect.left + crop.windowRect.width
                && y >= crop.windowRect.top && y < crop.windowRect.top + crop.windowRect.height;
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
        sharp(normal).png().toFile(path.join(sourceDir, 'championship-re-frame-normal-final-v2.png')),
        sharp(normal).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-frame-normal-final-v2.webp')),
        sharp(select).png().toFile(path.join(sourceDir, 'championship-re-frame-select-final-v2.png')),
        sharp(select).webp({ quality: 92, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-frame-select-final-v2.webp'))
    ]);
    console.log('新規枠を連続したGPU安全原図へ規格化: 450×3477 / 表示110×850');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
