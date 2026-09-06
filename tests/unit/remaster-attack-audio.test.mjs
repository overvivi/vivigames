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

test('全7人×3技の採用MP3が存在し、キャラ・技別キーで再生される', () => {
    for (const id of fighters) for (const move of ['attack', 'break', 'ultimate']) {
        const path = new URL(`../../projects/todays-champion-remaster/public/assets/championship-re/audio/${id}-${move}-v1.mp3`, import.meta.url);
        assert.ok(existsSync(path), id);
        assert.ok(readFileSync(path).length > 1000, id);
        let played;
        const scene = { cache: { audio: { exists: key => key === `battle-audio-${id}-${move}` } }, sound: { play: (key, config) => { played = [key, config.volume]; return true; } } };
        assert.equal(prototype.playMindDuelMoveSfx.call(scene, { id }, move), true);
        assert.deepEqual(played, [`battle-audio-${id}-${move}`, move === 'ultimate' ? 0.8 : 0.65]);
    }
});

test('読込失敗時は再生せず、仮ヒット音へ戻せる', () => {
    const scene = { cache: { audio: { exists: () => false } }, sound: { play: () => assert.fail('missing audio') } };
    for (const move of ['attack', 'break', 'ultimate', 'guard']) assert.equal(prototype.playMindDuelMoveSfx.call(scene, { id: 'raven' }, move), false);
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
    assert.deepEqual(queued, ['attack', 'break', 'ultimate'].map(move => [`battle-audio-vivi-${move}`, `assets/championship-re/audio/vivi-${move}-v1.mp3`]));
    assert.equal(completed, true);
});

test('16通りの手で両者の技を再生し、同時発動は減音・仮ヒットを重ねない', () => {
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
                sound: { stopByKey() {}, play: (key, config) => { played.push([key, config.volume]); return true; } },
                cameras: { main: { shake() {} } }, time: { delayedCall() {} }
            });
            scene.resolveMindDuelRound(own, opponent);
            const simultaneous = own !== 'guard' && opponent !== 'guard';
            const volume = move => move === 'ultimate' ? (simultaneous ? 0.55 : 0.8) : (simultaneous ? 0.45 : 0.65);
            const expected = [];
            if (own !== 'guard') expected.push([`battle-audio-kiri-${own}`, volume(own)]);
            if (opponent !== 'guard') expected.push([`battle-audio-vivi-${opponent}`, volume(opponent)]);
            assert.deepEqual(played, expected, `${own}/${opponent}`);
            if (expected.length) assert.ok(!synthetic.includes('impact'));
            assert.ok(!synthetic.includes('break'));
            assert.ok(!synthetic.includes('ultimate'));
        }
    }
});

test('指定された共用音を無加工で共有し、Ω本人のBREAKは別候補を使う', () => {
    const bytes = name => readFileSync(new URL(`../../projects/todays-champion-remaster/public/assets/championship-re/audio/${name}-v1.mp3`, import.meta.url));
    assert.deepEqual(bytes('raven-break'), bytes('kiri-break'));
    assert.notDeepEqual(bytes('raven-break'), bytes('tomega9-break'));
    assert.deepEqual(bytes('raven-ultimate'), bytes('vivi-ultimate'));
});

test('次のラウンド／タイトル復帰時に両者の技の余韻を停止する', () => {
    const stopped = [];
    prototype.stopMindDuelMoveSfx.call({ playerFighter: { id: 'kiri' }, npcFighter: { id: 'vivi' }, sound: { stopByKey: key => stopped.push(key) } });
    assert.deepEqual(stopped, ['battle-audio-gauge-charge', ...['kiri', 'vivi'].flatMap(id => ['attack', 'break', 'ultimate'].map(move => `battle-audio-${id}-${move}`))]);
});

test('ゲージ獲得は両側とも0→1でcharge、1→2でreadyだけ、満タン維持・消費では鳴らない', () => {
    for (const enemy of [false, true]) for (const [before, own, other, expected] of [
        [0, 'guard', 'attack', 'charge'], [1, 'guard', 'attack', 'ready'],
        [2, 'guard', 'attack', undefined], [1, 'guard', 'guard', undefined],
        [1, 'guard', 'break', undefined], [2, 'ultimate', 'guard', undefined]
    ]) {
        const played = []; const announced = [];
        const scene = Object.assign(Object.create(prototype), {
            playerFighter: { id: 'kiri' }, npcFighter: { id: 'vivi' },
            mindDuelPlayerHp: 1000, mindDuelNpcHp: 1000,
            mindDuelPlayerGauge: enemy ? 0 : before, mindDuelNpcGauge: enemy ? before : 0, mindDuelRound: 1,
            updateMindDuelUi() {}, playMindDuelMoveAnimation() {}, playMindDuelMoveEffect() {},
            playMindDuelUltimateEffect() {}, flashArena() {}, stopMindDuelMoveSfx() {},
            playMindDuelMoveSfx: () => true, playMindDuelSfx: kind => played.push(kind),
            announceMindDuelUltimateReady: player => announced.push(player),
            cameras: { main: { shake() {} } }, time: { delayedCall() {} }
        });
        scene.resolveMindDuelRound(enemy ? other : own, enemy ? own : other);
        assert.deepEqual(played.filter(kind => ['charge', 'ready'].includes(kind)), expected ? [expected] : []);
        assert.deepEqual(announced, expected === 'ready' ? [!enemy] : []);
    }
});

test('1個目用#2を両ゲージに共用し、SE音量・ミュートに追従して仮音を重ねない', () => {
    const boot = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Boot.ts', import.meta.url), 'utf8');
    assert.ok(!boot.includes('battle-audio-gauge-max'));
    for (const [kind, suffix, file, base] of [['charge', 'charge', 'charge', 0.65], ['ready', 'charge', 'charge', 0.65]]) {
        const key = `battle-audio-gauge-${suffix}`;
        const asset = `assets/championship-re/audio/gauge-${file}-v1.mp3`;
        assert.ok(boot.includes(`this.load.audio('${key}', '${asset}')`));
        assert.ok(readFileSync(new URL(`../../projects/todays-champion-remaster/public/${asset}`, import.meta.url)).length > 1000);
        for (const settings of [{ sfx: 50 }, { sfx: 0 }, { sfx: 100, sfxMuted: true }]) {
            const played = [];
            const scene = { audioControls: { settings }, cache: { audio: { exists: k => k === key } },
                sound: { play: (k, config) => { played.push([k, config.volume]); return true; } } };
            prototype.playMindDuelSfx.call(scene, kind);
            assert.deepEqual(played, settings.sfx && !settings.sfxMuted ? [[key, base * settings.sfx / 100]] : []);
        }
    }
});
