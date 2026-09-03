import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const masterPath = path.join(root, 'source/assets/championship-re/references/championship-re-title-master-v2.png');
const sourceDir = path.join(root, 'source/assets/championship-re/ui');
const publicDir = path.join(root, 'public/assets/championship-re/ui');

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    // レイアウト枠は最大安全領域であって、ロゴを引き伸ばすための寸法ではない。
    // 原画の縦横比をそのまま出力し、ゲーム側で枠内へ等比配置する。
    const finalLogo = await sharp(masterPath).png().toBuffer();
    await Promise.all([
        sharp(finalLogo).png().toFile(path.join(sourceDir, 'championship-re-title-final-v3.png')),
        sharp(finalLogo).webp({ quality: 94, alphaQuality: 100 }).toFile(path.join(publicDir, 'championship-re-title-final-v3.webp'))
    ]);
    console.log('新規タイトルを等比のまま出力: ゲーム側で安全領域へcontain配置');
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
