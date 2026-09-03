import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const project = path.join(root, 'projects/todays-champion-remaster');
const masters = path.join(project, 'source/assets/championship-re/references/gates');
const cutoutDir = path.join(project, 'source/assets/championship-re/gates/cutouts');
const publicCutoutDir = path.join(project, 'public/assets/championship-re/gates/cutouts');
const checkPath = path.join(masters, 'gate-character-scale-check-v1.png');

const fighters = [
    { id: 'raven', name: 'RAVEN', scale: 1 },
    { id: 'mika', name: 'MIKA', scale: 1 },
    { id: 'brick', name: 'BRICK', scale: 1.08 },
    { id: 'noise', name: 'NOISE', scale: 1 },
    { id: 'kiri', name: 'KIRI', scale: 1 },
    { id: 'vivi', name: 'VIVI', scale: 0.94 },
    { id: 'tomega9', name: 'TΩ9', scale: 1.16 }
];

const tileWidth = 620;
const canvasWidth = tileWidth * fighters.length;
const canvasHeight = 1800;
const normalBaseline = 790;
const selectedBaseline = 1720;

function label(text, x, y, size = 28, color = '#d7e9f4') {
    return Buffer.from(`<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg"><text x="${x}" y="${y}" fill="${color}" font-family="Arial, sans-serif" font-size="${size}" font-weight="700" letter-spacing="3">${text}</text></svg>`);
}

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
            // 緑スクリーンだけを抜き、人物のシアン／紫／白は残す。境界の緑かぶりもalphaへ回す。
            if (greenDominant && greenLead > 82) {
                output[index + 3] = 0;
            } else if (greenDominant && greenLead > 28) {
                output[index + 3] = Math.min(output[index + 3], Math.round(255 * (82 - greenLead) / 54));
                output[index + 1] = Math.min(g, Math.max(r, b) + 16);
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
    await Promise.all([mkdir(cutoutDir, { recursive: true }), mkdir(publicCutoutDir, { recursive: true })]);
    const base = await sharp({
        create: { width: canvasWidth, height: canvasHeight, channels: 4, background: { r: 7, g: 14, b: 24, alpha: 1 } }
    }).png().toBuffer();
    const composites = [
        { input: Buffer.from(`<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg"><path d="M0 ${normalBaseline}H${canvasWidth} M0 ${selectedBaseline}H${canvasWidth}" stroke="#e7b95d" stroke-width="4" opacity=".85"/><path d="M0 900H${canvasWidth}" stroke="#365063" stroke-width="2" opacity=".8"/></svg>`), left: 0, top: 0 },
        { input: label('NORMAL / 3-4 VIEW — SAME GROUND LINE', 30, 52, 26, '#83dfff'), left: 0, top: 0 },
        { input: label('SELECTED / FRONT VIEW — SAME GROUND LINE', 30, 956, 26, '#ffe29d'), left: 0, top: 0 }
    ];

    for (let index = 0; index < fighters.length; index++) {
        const fighter = fighters[index];
        const xCenter = index * tileWidth + tileWidth / 2;
        for (const state of ['lineup', 'selected']) {
            const master = path.join(masters, `${fighter.id}-${state}-chromakey-master-v1.png`);
            const cutout = await removeChroma(master);
            await Promise.all([
                sharp(cutout).png().toFile(path.join(cutoutDir, `${fighter.id}-${state}-cutout-v1.png`)),
                sharp(cutout).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(path.join(publicCutoutDir, `${fighter.id}-${state}-cutout-v1.webp`))
            ]);
            const targetHeight = Math.round((state === 'lineup' ? 600 : 670) * fighter.scale);
            const normalized = await sharp(cutout).resize({ height: targetHeight, fit: 'contain', withoutEnlargement: false }).png().toBuffer();
            const meta = await sharp(normalized).metadata();
            const baseline = state === 'lineup' ? normalBaseline : selectedBaseline;
            composites.push({ input: normalized, left: Math.round(xCenter - (meta.width ?? 0) / 2), top: baseline - (meta.height ?? 0) });
        }
        composites.push({ input: label(`${String(index + 1).padStart(2, '0')}  ${fighter.name}`, index * tileWidth + 30, 876, 24), left: 0, top: 0 });
    }
    await sharp(base).composite(composites).png().toFile(checkPath);
    console.log(`原画14枚をクロマキー透明化し、共通接地線の比較シートを作成: ${checkPath}`);
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
