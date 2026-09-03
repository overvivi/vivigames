import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const referenceDir = path.join(root, 'source/assets/championship-re/references/title');
const referenceUiDir = path.join(root, 'source/assets/championship-re/references/title-ui');
const sourceDir = path.join(root, 'source/assets/championship-re/title');
const publicDir = path.join(root, 'public/assets/championship-re/title');
const assets = [
    { input: path.join(referenceDir, 'title-orb-seven-fighters-master-v1.png'), id: 'title-orb-seven-fighters', trim: false },
    { input: path.join(referenceUiDir, 'title-cpu-battle-master-v1.png'), id: 'title-cpu-battle', trim: true },
    { input: path.join(referenceUiDir, 'title-friend-battle-master-v1.png'), id: 'title-friend-battle', trim: true },
    { input: path.join(referenceUiDir, 'title-online-battle-master-v1.png'), id: 'title-online-battle', trim: true }
];

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    await Promise.all(assets.map(async ({ input, id, trim }) => {
        let image = sharp(input).ensureAlpha();
        if (trim) image = image.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } });
        const art = await image.png().toBuffer();
        await Promise.all([
            sharp(art).png().toFile(path.join(sourceDir, `${id}-v1.png`)),
            sharp(art).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, `${id}-v1.webp`))
        ]);
    }));
    console.log('モード選択タイトル用の背景・ボタン素材をWebPへ変換しました。');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
