import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const lineupCutoutDir = path.join(root, 'source/assets/championship-re/gates/cutouts/v7-batch-normal');
const selectedCutoutDir = path.join(root, 'source/assets/championship-re/gates/cutouts/v7-batch-selected');
const sourceDir = path.join(root, 'source/assets/championship-re/gates/characters');
const publicDir = path.join(root, 'public/assets/championship-re/gates/characters');

const fighterIds = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

async function makeGateArt(id, state) {
    const cutoutDir = state === 'lineup' ? lineupCutoutDir : selectedCutoutDir;
    const sourceState = state === 'lineup' ? 'normal' : 'selected';
    const cutoutPath = path.join(cutoutDir, `${id}-${sourceState}.png`);
    // 枠幅で事前に切り出すと、デバッグで位置を動かした時点で腕・翼・武器の画素が失われる。
    // 原画のalphaを保った全身をそのまま渡し、ゲーム側のゲート開口だけで一度だけ切る。
    const art = await sharp(cutoutPath).ensureAlpha().png().toBuffer();
    const stem = `gate-character-${id}-${state}-v8`;
    await Promise.all([
        sharp(art).png().toFile(path.join(sourceDir, `${stem}.png`)),
        sharp(art).webp({ quality: 93, effort: 6 }).toFile(path.join(publicDir, `${stem}.webp`))
    ]);
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighterIds.flatMap((id) => [makeGateArt(id, 'lineup'), makeGateArt(id, 'selected')]));
    console.log('14枚の透明キャラ原画を余計に切らず出力した。表示時はゲート開口だけでマスクする。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
