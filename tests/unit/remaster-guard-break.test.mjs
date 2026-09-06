import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const context = { exports: {}, require: () => ({ Scene: class {}, Math: { Clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)) } }) };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const prototype = context.exports.Game.prototype;

test('全16組合せでBREAK対GUARDだけ、崩された側と決着フラグを渡す', () => {
    for (const p of ['attack', 'guard', 'break', 'ultimate']) for (const n of ['attack', 'guard', 'break', 'ultimate']) for (const lethal of [false, true]) {
        const calls = [];
        const scene = Object.assign(Object.create(prototype), {
            playerFighter: {}, npcFighter: {}, mindDuelPlayerHp: lethal ? 100 : 1000, mindDuelNpcHp: lethal ? 100 : 1000,
            mindDuelPlayerGauge: 0, mindDuelNpcGauge: 0, mindDuelRound: 1,
            updateMindDuelUi() {}, playMindDuelMoveAnimation() {}, playMindDuelMoveEffect() {}, playMindDuelUltimateEffect() {},
            stopMindDuelMoveSfx() {}, playMindDuelMoveSfx: () => true, playMindDuelSfx() {}, flashArena() {},
            playMindDuelGuardCharge() {}, playMindDuelFinisher() {}, playMindDuelGuardBreak: (...args) => calls.push(args),
            cameras: { main: { shake() {} } }, time: { delayedCall() {} }
        });
        scene.resolveMindDuelRound(p, n);
        const broken = (p === 'break' && n === 'guard') || (p === 'guard' && n === 'break');
        assert.deepEqual(calls, broken ? [[p === 'guard', lethal]] : []);
    }
});

function fixture(player = true, finishing = false, texture = true) {
    let now = 0;
    const timers = [], images = [], animations = [], events = [];
    const motion = { timeScale: 0.8, paused: false, destroyed: false, isPlaying() { return !this.paused; }, isDestroyed() { return this.destroyed; }, pause() { this.paused = true; }, resume() { this.paused = false; } };
    const scene = {
        state: 'mind-duel', mindDuelLayer: { list: [], add(image) { this.list.push(image); } },
        mindDuelPlayerArt: { x: 270, y: 1190, displayWidth: 400, displayHeight: 640 },
        mindDuelNpcArt: { x: 674, y: 1190, displayWidth: 400, displayHeight: 640 },
        time: { delayedCall: (delay, callback) => timers.push({ at: now + delay, callback }) },
        textures: { exists: () => texture }, cameras: { main: { shake: () => events.push('shake') } },
        tweens: { getTweensOf: () => [motion], add(config) { animations.push(config); return { stop() { events.push('stop'); } }; } },
        add: { image: () => {
            const image = { setPosition(x, y) { this.x = x; this.y = y; return this; }, setDisplaySize(w, h) { this.w = w; this.h = h; return this; }, setFlipX(v) { this.flip = v; return this; }, setBlendMode(v) { this.blend = v; return this; }, destroy() { this.destroyed = true; } };
            images.push(image); return image;
        } }
    };
    const advance = at => { while (true) { timers.sort((a, b) => a.at - b.at); if (!timers.length || timers[0].at > at) break; const t = timers.shift(); now = t.at; t.callback(); } now = at; };
    prototype.playMindDuelGuardBreak.call(scene, player, finishing);
    return { scene, advance, motion, images, animations, events };
}

test('左右の胸元で100ms停止、盾は最前面で拡散し、のけぞりへ追従', () => {
    for (const player of [true, false]) {
        const f = fixture(player);
        f.advance(259); assert.equal(f.motion.paused, false); assert.equal(f.images.length, 0);
        f.advance(260); assert.equal(f.motion.paused, true);
        const shield = f.images[0], burst = f.animations[0];
        assert.equal(shield.x, player ? 334 : 610); assert.equal(shield.y, 870);
        assert.equal(shield.flip, !player); assert.equal(shield.blend, 'ADD'); assert.equal(f.scene.mindDuelLayer.list.at(-1), shield);
        assert.equal(shield.w, 320);
        assert.equal(burst.displayWidth.duration, 260); assert.equal(burst.displayHeight.duration, 260);
        assert.equal(burst.alpha.value, 0); assert.equal(burst.alpha.delay, 360); assert.equal(burst.alpha.duration, 280);
        assert.equal(burst.alpha.ease, 'Quad.easeIn'); assert.ok(burst.displayWidth.value > shield.w);
        assert.ok(burst.alpha.delay > burst.displayWidth.duration);
        assert.ok(260 + burst.alpha.delay + burst.alpha.duration < 1320);
        const art = player ? f.scene.mindDuelPlayerArt : f.scene.mindDuelNpcArt;
        art.x += 22; art.y += 18; burst.onUpdate(); assert.equal(shield.x, player ? 356 : 632); assert.equal(shield.y, 888);
        f.advance(359); assert.equal(f.motion.paused, true);
        f.advance(360); assert.equal(f.motion.paused, false); assert.equal(f.motion.timeScale, 0.8);
        burst.onComplete(); assert.equal(shield.destroyed, true);
    }
});

test('決着では停止・揺れを重ねず破砕だけ、素材欠落でも停止後に復帰', () => {
    const lethal = fixture(false, true); lethal.advance(260);
    assert.equal(lethal.motion.paused, false); assert.equal(lethal.images.length, 1); assert.deepEqual(lethal.events, []);
    const missing = fixture(true, false, false); missing.advance(260); assert.equal(missing.motion.paused, true); assert.equal(missing.images.length, 0);
    missing.advance(360); assert.equal(missing.motion.paused, false);
});

test('画面離脱・レイヤー交換で発火せず、途中離脱でも静止を持ち越さない', () => {
    for (const replace of [false, true]) {
        const early = fixture(); if (replace) early.scene.mindDuelLayer = {}; else early.scene.state = 'title';
        early.advance(1000); assert.equal(early.images.length, 0); assert.equal(early.motion.paused, false);
    }
    const late = fixture(); late.advance(260); late.scene.state = 'title'; late.animations[0].onUpdate(); late.advance(360);
    assert.equal(late.images[0].destroyed, true); assert.equal(late.motion.paused, false);
    const destroyed = fixture(); destroyed.advance(260); destroyed.motion.destroyed = true; assert.doesNotThrow(() => destroyed.advance(360));
});

test('破砕素材は軽量512px、Bootでロードする', async () => {
    const sharp = require('sharp');
    const meta = await sharp(readFileSync(new URL('../../projects/todays-champion-remaster/public/assets/championship-re/battle/effects/guard-shatter-v1.webp', import.meta.url))).metadata();
    assert.equal(meta.width, 512); assert.equal(meta.height, 512);
    assert.match(readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Boot.ts', import.meta.url), 'utf8'), /battle-guard-shatter.*guard-shatter-v1.webp/);
});
