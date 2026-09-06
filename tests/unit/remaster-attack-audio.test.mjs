import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const source = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8');
const context = { exports: {}, require: () => ({ Scene: class {} }) };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const prototype = context.exports.Game.prototype;
const fighters = ['raven', 'mika', 'brick', 'noise', 'kiri', 'vivi', 'tomega9'];

test('全7人の採用MP3が存在し、キャラ別キー・指定音量で再生される', () => {
    for (const id of fighters) {
        const path = new URL(`../../projects/todays-champion-remaster/public/assets/championship-re/audio/${id}-attack-v1.mp3`, import.meta.url);
        assert.ok(existsSync(path), id);
        assert.ok(readFileSync(path).length > 1000, id);
        let played;
        const scene = { cache: { audio: { exists: key => key === `battle-audio-${id}-attack` } }, sound: { play: (key, config) => { played = [key, config.volume]; return true; } } };
        assert.equal(prototype.playMindDuelAttackSfx.call(scene, { id }, 0.65), true);
        assert.deepEqual(played, [`battle-audio-${id}-attack`, 0.65]);
    }
});

test('読込失敗時は再生せず、仮ヒット音へ戻せる', () => {
    const scene = { cache: { audio: { exists: () => false } }, sound: { play: () => assert.fail('missing audio') } };
    assert.equal(prototype.playMindDuelAttackSfx.call(scene, { id: 'raven' }, 0.65), false);
});

test('画像がキャッシュ済みでも音を読み、同キャラ対戦は重複ロードしない', () => {
    const queued = [];
    let completed = false;
    const scene = {
        hasMindDuelCharacter: () => true,
        mindDuelCharacterKey: () => 'cached', mindDuelUltimateEffectKey: () => undefined,
        mindDuelUltimateEffectPath: () => undefined, mindDuelMoveEffect: () => undefined,
        textures: { exists: () => true }, cache: { audio: { exists: () => false } },
        load: { image: () => assert.fail('cached image'), audio: (key, path) => queued.push([key, path]), once: (_event, fn) => { scene.done = fn; }, start: () => scene.done() }
    };
    prototype.loadMindDuelBattleAssets.call(scene, [{ id: 'vivi' }, { id: 'vivi' }], () => { completed = true; });
    assert.deepEqual(queued, [['battle-audio-vivi-attack', 'assets/championship-re/audio/vivi-attack-v1.mp3']]);
    assert.equal(completed, true);
});

test('両者の手から通常アタックだけ再生し、同時攻撃は減音・共通ヒットを重ねない', () => {
    for (const own of ['attack', 'guard', 'break', 'ultimate']) {
        for (const opponent of ['attack', 'guard', 'break', 'ultimate']) {
            const played = []; const synthetic = [];
            const scene = Object.assign(Object.create(prototype), {
                playerFighter: { id: 'kiri' }, npcFighter: { id: 'vivi' },
                mindDuelPlayerHp: 1000, mindDuelNpcHp: 1000,
                mindDuelPlayerGauge: 0, mindDuelNpcGauge: 0, mindDuelRound: 1,
                updateMindDuelUi() {}, playMindDuelMoveAnimation() {}, playMindDuelMoveEffect() {},
                playMindDuelUltimateEffect() {}, flashArena() {},
                playMindDuelSfx: kind => synthetic.push(kind),
                cache: { audio: { exists: () => true } },
                sound: { play: (key, config) => { played.push([key, config.volume]); return true; } },
                cameras: { main: { shake() {} } }, time: { delayedCall() {} }
            });
            scene.resolveMindDuelRound(own, opponent);
            const volume = own === 'attack' && opponent === 'attack' ? 0.45 : 0.65;
            const expected = [];
            if (own === 'attack') expected.push(['battle-audio-kiri-attack', volume]);
            if (opponent === 'attack') expected.push(['battle-audio-vivi-attack', volume]);
            assert.deepEqual(played, expected, `${own}/${opponent}`);
            if (expected.length) assert.ok(!synthetic.includes('impact'));
        }
    }
});
