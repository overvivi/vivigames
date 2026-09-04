import sharp from 'sharp';
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '..');
const referenceDir = path.join(project, 'source/assets/championship-re/references/battle-effects');
const sourceDir = path.join(project, 'source/assets/championship-re/battle/effects');
const publicDir = path.join(project, 'public/assets/championship-re/battle/effects');

async function build() {
    await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
    const masters = (await readdir(referenceDir)).filter((name) => /-master-v\d+\.png$/.test(name));
    if (!masters.length) throw new Error('battle-effects に原本がありません');
    await Promise.all(masters.map(async (master) => {
        const [, id, version] = master.match(/^(.*)-master-v(\d+)\.png$/) ?? [];
        if (id === undefined || version === undefined) throw new Error(`原本名を解釈できません: ${master}`);
        const sourcePath = path.join(referenceDir, master);
        await Promise.all([
            sharp(sourcePath).png().toFile(path.join(sourceDir, `${id}-v${version}.png`)),
            sharp(sourcePath).webp({ quality: 96, effort: 6 }).toFile(path.join(publicDir, `${id}-v${version}.webp`))
        ]);
        // 加算合成の黒は透明として扱える。発光の縁を傷めるalpha抜きは行わない。
        console.log(`加算合成用VFX OK: ${id}`);
    }));
}

build().catch((error) => {
    console.error(error);
    process.exit(1);
});
