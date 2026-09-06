import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const source = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8');
const context = { exports: {}, require: () => ({ Scene: class {} }) };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const prototype = context.exports.Game.prototype;

test('通常・ブレイク・必殺の決着は左右とも一度だけ、通常ラウンドの判定は維持', () => {
    for (const enemy of [false, true]) for (const [hit, target, damage] of [['attack', 'break', 160], ['break', 'guard', 220], ['ultimate', 'attack', 380]]) {
        for (const lethal of [false, true]) {
            let finish = 0, ui = 0;
            const timers = [];
            const scene = Object.assign(Object.create(prototype), {
                playerFighter: { id: 'raven' }, npcFighter: { id: 'mika' },
                mindDuelPlayerHp: enemy ? (lethal ? damage : 1000) : 1000,
                mindDuelNpcHp: enemy ? 1000 : (lethal ? damage : 1000),
                mindDuelPlayerGauge: 2, mindDuelNpcGauge: 2, mindDuelRound: 1,
                updateMindDuelUi() { ui++; }, playMindDuelMoveAnimation() {}, playMindDuelMoveEffect() {}, playMindDuelUltimateEffect() {},
                stopMindDuelMoveSfx() {}, playMindDuelMoveSfx: () => true, playMindDuelSfx() {}, flashArena() {},
                cameras: { main: { shake() {} } }, time: { delayedCall: ms => timers.push(ms) },
                playMindDuelGuardBreak() {}, playMindDuelFinisher() { finish++; this.mindDuelFinishing = true; }
            });
            scene.resolveMindDuelRound(enemy ? target : hit, enemy ? hit : target);
            assert.equal(enemy ? scene.mindDuelPlayerHp : scene.mindDuelNpcHp, lethal ? 0 : 1000 - damage);
            assert.equal(finish, lethal ? 1 : 0); assert.equal(ui, lethal ? 0 : 1);
            assert.equal(scene.mindDuelRound, lethal ? 1 : 2);
            assert.deepEqual(timers, lethal ? [] : [1320]);
            if (lethal) { scene.resolveMindDuelRound('ultimate', 'ultimate'); assert.equal(finish, 1); }
        }
    }
});

function fixture() {
    let now = 0;
    const timers = [], events = [];
    const tween = { timeScale: 0.8, paused: false, destroyed: false, isPlaying() { return !this.paused; }, isDestroyed() { return this.destroyed; }, pause() { this.paused = true; }, resume() { this.paused = false; } };
    const layer = { list: ['character', 'effect'] };
    const scene = {
        state: 'mind-duel', mindDuelLayer: layer, mindDuelNpcHp: 0,
        time: { delayedCall: (delay, callback) => timers.push({ at: now + delay, callback }) },
        updateMindDuelUi: () => events.push('hp'),
        tweens: { getTweensOf: targets => { assert.equal(targets, layer.list); return [tween]; }, add: () => events.push('flash') },
        add: { rectangle: () => ({ setDepth() { return this; }, destroy() {} }) },
        cameras: { main: { shake: () => events.push('shake') } },
        playMindDuelSfx: kind => events.push(kind), showMindDuelResult: () => events.push('result')
    };
    const advance = at => { while (true) { timers.sort((a, b) => a.at - b.at); if (!timers.length || timers[0].at > at) break; const timer = timers.shift(); now = timer.at; timer.callback(); } now = at; };
    prototype.playMindDuelFinisher.call(scene);
    return { scene, tween, advance, events };
}

test('260msでHP更新・一度の光と揺れ、140ms静止→620msスロー→復元→1800msで結果', () => {
    const { scene, tween, advance, events } = fixture();
    assert.equal(scene.mindDuelLocked, true); assert.equal(scene.mindDuelFinishing, true);
    advance(259); assert.deepEqual(events, []);
    advance(260); assert.equal(tween.paused, true); assert.deepEqual(events, ['hp', 'flash', 'shake']);
    advance(399); assert.equal(tween.paused, true);
    advance(400); assert.equal(tween.paused, false); assert.equal(tween.timeScale, 0.8 * 0.45);
    advance(1020); assert.equal(tween.timeScale, 0.8);
    advance(1799); assert.equal(events.includes('result'), false);
    advance(1800); assert.deepEqual(events.slice(-2), ['victory', 'result']);
});

test('画面を離れた時は遅延演出を出さず、開始済みTweenは元の速度へ戻す', () => {
    const early = fixture(); early.scene.state = 'title'; early.advance(2000); assert.deepEqual(early.events, []);
    const late = fixture(); late.advance(260); late.scene.state = 'title'; late.advance(2000);
    assert.equal(late.tween.paused, false); assert.equal(late.tween.timeScale, 0.8); assert.equal(late.events.includes('result'), false);
    const destroyed = fixture(); destroyed.advance(260); destroyed.tween.destroyed = true;
    assert.doesNotThrow(() => destroyed.advance(2000));
});

test('敗北でも同じ演出のあと敗北音・結果へ進む', () => {
    const { scene, advance, events } = fixture(); scene.mindDuelNpcHp = 1000; advance(1800);
    assert.deepEqual(events.slice(-2), ['defeat', 'result']);
});
