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

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(fighterIds.map(async (id) => {
        // 透明余白まで原点にすると着地点がずれる。alphaの実体だけを残し、
        // Phaserのbottom originをFOOT BASELINEへそのまま合わせられる形にする。
        // 背景は無料のローカル処理で先に実alphaへ変換済み。色だけで抜き直すと
        // 髪・発光・半透明の衣装まで壊れるため、ここではalphaをそのまま保つ。
        const art = await sharp(path.join(referenceDir, `summon-character-${id}-master-v2.png`)).ensureAlpha()
            .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png()
            .toBuffer();
        await Promise.all([
            sharp(art).png().toFile(path.join(sourceDir, `summon-character-${id}-v2.png`)),
            sharp(art).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `summon-character-${id}-v2.webp`))
        ]);
    }));
    console.log('召喚ステージ用の7キャラを、共通FOOT BASELINEへ揃えられる透過素材に変換しました。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
