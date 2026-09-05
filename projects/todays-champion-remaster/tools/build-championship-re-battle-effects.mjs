import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const referenceDir = path.join(project, 'source/assets/championship-re/references/battle-effects');
const sourceDir = path.join(project, 'source/assets/championship-re/battle/effects');
const publicDir = path.join(project, 'public/assets/championship-re/battle/effects');

async function removeGreenChroma(sourcePath) {
    const { data, info } = await sharp(sourcePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const output = Buffer.from(data);
    for (let index = 0; index < output.length; index += 4) {
        const r = output[index];
        const g = output[index + 1];
        const b = output[index + 2];
        // 生成済みの発光は黒地／実alphaが混在する。緑キーだけを限定して抜けば、
        // 既存の黒地加算VFXを傷めず、キー原画の緑だけをゲームへ持ち込まない。
        if (g > 90 && g > r * 1.08 && g > b * 1.08 && g - Math.max(r, b) > 48) {
            output[index + 3] = 0;
        }
    }
    return sharp(output, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const masters = (await readdir(referenceDir)).filter((name) => /-master-v\d+\.png$/.test(name));
    if (!masters.length) throw new Error('battle-effects に原本がありません');
    await Promise.all(masters.map(async (master) => {
        const [, id, version] = master.match(/^(.*)-master-v(\d+)\.png$/) ?? [];
        if (id === undefined || version === undefined) throw new Error(`原本名を解釈できません: ${master}`);
        const sourcePath = path.join(referenceDir, master);
        // 緑背景で届いたKIRIの半月斬りだけをキー抜きする。既存VFXは黒地を加算合成で
        // 透明に見せる前提なので、同じ加工をかけると発光の見え方まで変わってしまう。
        if (id === 'kiri-attack-crescent') {
            const effect = await removeGreenChroma(sourcePath);
            await Promise.all([
                sharp(effect).png().toFile(path.join(sourceDir, `${id}-v${version}.png`)),
                sharp(effect).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(path.join(publicDir, `${id}-v${version}.webp`))
            ]);
        } else {
            await Promise.all([
                sharp(sourcePath).png().toFile(path.join(sourceDir, `${id}-v${version}.png`)),
                sharp(sourcePath).webp({ quality: 96, alphaQuality: 100, effort: 6 }).toFile(path.join(publicDir, `${id}-v${version}.webp`))
            ]);
        }
        // 加算合成の黒は透明として扱える。発光の縁を傷めるalpha抜きは行わない。
        console.log(`加算合成用VFX OK: ${id}`);
    }));
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
