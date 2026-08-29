import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const cutoutDir = path.join(root, 'source/assets/championship-re/gates/cutouts');
const sourceDir = path.join(root, 'source/assets/championship-re/gates/characters');
const publicDir = path.join(root, 'public/assets/championship-re/gates/characters');

// 現行の連続枠450×3477に対する透明窓370×3137と同寸にする。
// この比率で完成絵を作るため、ゲーム側で人物画像を縦横別に拡縮しない。
const artWidth = 370;
const artHeight = 3137;
const fighterIds = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];
const scales = { raven: 1, mika: 1, brick: 1.08, noise: 1, kiri: 1, vivi: 0.94, tomega9: 1.16 };

async function makeGateArt(id, state) {
    const cutoutPath = path.join(cutoutDir, `${id}-${state}-cutout-v1.png`);
    const characterHeight = Math.round((state === 'lineup' ? 2500 : 2700) * scales[id]);
    // resizeは高さだけを指定し、アスペクト比を保持する。横幅は縦長ゲートの構図として中央で自然に切る。
    const resized = await sharp(cutoutPath).resize({ height: characterHeight, fit: 'contain' }).png().toBuffer();
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
    const stem = `gate-character-${id}-${state}-v1`;
    await Promise.all([
        sharp(art).png().toFile(path.join(sourceDir, `${stem}.png`)),
        sharp(art).webp({ quality: 93, effort: 6 }).toFile(path.join(publicDir, `${stem}.webp`))
    ]);
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighterIds.flatMap((id) => [makeGateArt(id, 'lineup'), makeGateArt(id, 'selected')]));
    console.log('14枚の透明キャラアートを枠の透明窓370×3137と同じ比率で出力した。人物の縦横比は保持している。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
