import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/summon-gate-common-master-v12.png');
const sourceDir = path.join(root, 'source/assets/championship-re/summon');
const publicDir = path.join(root, 'public/assets/championship-re/summon');
const width = 772;
const height = 790;
const safeInset = 10;

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // 門の外周が画像端に接すると、画面で柱や土台が途中で切れたように見える。
    // 上下左右へ同じ安全余白を残し、接地そのものは背面の濡れた路面で成立させる。
    // 骨格を生成で作り直すと柱の太さや装飾量まで変わる。ユーザーが採用したv5を
    // そのまま使い、暗い雨景に馴染む露出と彩度だけを落として同一シルエットを守る。
    const resizedGate = await sharp(masterPath)
        .modulate({ brightness: 0.58, saturation: 0.78 })
        .resize({ width: width - safeInset * 2, height: height - safeInset * 2, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .extend({ top: safeInset, bottom: safeInset, left: safeInset, right: safeInset, background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer();
    const gate = resizedGate;
    await Promise.all([
        sharp(gate).png().toFile(path.join(sourceDir, 'summon-gate-common-final-v12.png')),
        sharp(gate).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'summon-gate-common-final-v12.webp'))
    ]);
    console.log('共通大型召喚ゲートを規格化: 772×790 / alpha維持');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
