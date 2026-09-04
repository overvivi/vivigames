import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references/battle-ui');
const sourceDir = path.join(root, 'source/assets/championship-re/battle');
const publicDir = path.join(root, 'public/assets/championship-re/battle');
const assets = [
    { id: 'arena-background', trim: false },
    { id: 'hud-frame', trim: true },
    { id: 'action-attack', trim: true },
    { id: 'action-guard', trim: true },
    { id: 'action-break', trim: true },
    { id: 'ultimate-crystal', trim: true },
    { id: 'ultimate-socket-crystal', trim: true },
    { id: 'ultimate-ready-ring', trim: true },
    { id: 'ultimate-swipe-trail', trim: true },
    { id: 'choose-move', trim: true }
];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(assets.map(async ({ id, trim }) => {
        // 背景だけは安全域込みの構図を保持する。UIは透明余白を除いて、実装側の
        // 座標と発光アニメーションを素材本体へ安定して合わせられるようにする。
        let image = sharp(path.join(referenceDir, `battle-${id}-master-v1.png`)).ensureAlpha();
        if (trim) image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
        const art = await image.png().toBuffer();
        await Promise.all([
            sharp(art).png().toFile(path.join(sourceDir, `battle-${id}-v1.png`)),
            sharp(art).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `battle-${id}-v1.webp`))
        ]);
    }));
    console.log('決闘画面用の背景・HUD・操作素材をWebPへ変換しました。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
