import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const referenceDir = path.join(project, 'source/assets/championship-re/references/battle-characters');
const sourceDir = path.join(project, 'source/assets/championship-re/battle/characters');
const publicDir = path.join(project, 'public/assets/championship-re/battle/characters');

async function removeChroma(sourcePath) {
    const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const output = Buffer.from(data);
    let left = info.width;
    let top = info.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const index = (y * info.width + x) * 4;
            const r = output[index];
            const g = output[index + 1];
            const b = output[index + 2];
            const greenLead = g - Math.max(r, b);
            const greenDominant = g > 90 && g > r * 1.08 && g > b * 1.08;
            // 人物に緑は使わない共通規約にして、髪先や翼の薄い縁までalphaへ逃がす。
            if (greenDominant && greenLead > 48) {
                output[index + 3] = 0;
            } else if (greenDominant && greenLead > 12) {
                // 明るい髪の縁は緑との混色になりやすい。残った緑だけを先に落とすと、
                // 背景へ置いた時の蛍光色のフリンジを防げる。
                const edgeAlpha = (48 - greenLead) / 36;
                output[index + 3] = Math.min(output[index + 3], Math.round(255 * edgeAlpha * edgeAlpha));
                output[index + 1] = Math.min(g, Math.max(r, b));
            }
            if (output[index + 3] > 16) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
            }
        }
    }
    if (right < left || bottom < top) throw new Error(`クロマキー抽出に失敗: ${sourcePath}`);
    const pad = 8;
    const crop = {
        left: Math.max(0, left - pad),
        top: Math.max(0, top - pad),
        width: Math.min(info.width, right + pad + 1) - Math.max(0, left - pad),
        height: Math.min(info.height, bottom + pad + 1) - Math.max(0, top - pad)
    };
    return sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).extract(crop).png().toBuffer();
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const masters = (await readdir(referenceDir)).filter((name) => name.endsWith('-chromakey-master-v1.png'));
    if (!masters.length) throw new Error('battle-characters にクロマキー原本がありません');
    await Promise.all(masters.map(async (master) => {
        const id = master.replace('-chromakey-master-v1.png', '');
        const character = await removeChroma(path.join(referenceDir, master));
        await Promise.all([
            sharp(character).png().toFile(path.join(sourceDir, `${id}-v1.png`)),
            sharp(character).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(path.join(publicDir, `${id}-v1.webp`))
        ]);
        const alpha = await sharp(character).metadata();
        if (!alpha.hasAlpha) throw new Error(`${id} のalpha出力を確認できません`);
        console.log(`透過確認OK: ${id}`);
    }));
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
