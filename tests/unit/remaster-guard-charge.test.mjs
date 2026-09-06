import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const context = { exports: {}, require: () => ({ Scene: class {} }) };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const prototype = context.exports.Game.prototype;

function fixture(player = true, gauge = 1, texture = true) {
    let now = 0;
    const timers = [], images = [], events = [], animations = [];
    const image = (x, y) => ({ x, y, alpha: 1, setPosition(x, y) { this.x = x; this.y = y; return this; }, setDisplaySize(w, h) { this.w = w; this.h = h; return this; }, setBlendMode(mode) { this.blend = mode; return this; }, setAlpha(a) { this.alpha = a; return this; }, destroy() { this.destroyed = true; } });
    const scene = {
        state: 'mind-duel', mindDuelLayer: { add() {} },
        mindDuelPlayerArt: { x: 270, y: 1190, displayWidth: 400, displayHeight: 640 },
        mindDuelNpcArt: { x: 674, y: 1190, displayWidth: 400, displayHeight: 640 },
        mindDuelPlayerGems: [image(210, 230), image(262, 230)], mindDuelNpcGems: [image(700, 230), image(752, 230)],
        time: { delayedCall: (ms, callback) => timers.push({ at: now + ms, callback }) }, textures: { exists: () => texture },
        add: { image: (x, y) => { const sprite = image(x, y); images.push(sprite); return sprite; } },
        tweens: { add(config) { animations.push(config); return { stop() { events.push('stop'); } }; } },
        updateMindDuelUi: () => events.push('ui'), playMindDuelSfx: kind => events.push(kind), announceMindDuelUltimateReady: side => events.push(side ? 'player-ready' : 'enemy-ready')
    };
    const advance = at => { while (true) { timers.sort((a, b) => a.at - b.at); if (!timers.length || timers[0].at > at) break; const timer = timers.shift(); now = timer.at; timer.callback(); } now = at; };
    prototype.playMindDuelGuardCharge.call(scene, player, gauge);
    return { scene, images, events, animations, advance };
}

test('左右のガード位置から、その側の新しい宝石へ曲線移動して吸収する', () => {
    for (const player of [true, false]) for (const gauge of [1, 2]) {
        const f = fixture(player, gauge);
        f.advance(259); assert.equal(f.images.length, 0); assert.deepEqual(f.events, []);
        f.advance(260); assert.equal(f.images.length, 5);
        const orb = f.images[0], flight = f.animations[0];
        const start = { x: orb.x, y: orb.y };
        assert.equal(orb.x, player ? 342 : 602); assert.equal(orb.blend, 'ADD');
        assert.equal(flight.duration, 480);
        flight.targets.t = 0.5; flight.onUpdate(); assert.ok(orb.y < start.y); assert.ok(orb.y > 230);
        flight.targets.t = 1; flight.onUpdate();
        const gem = (player ? f.scene.mindDuelPlayerGems : f.scene.mindDuelNpcGems)[gauge - 1];
        assert.equal(orb.x, gem.x); assert.equal(orb.y, gem.y); assert.ok(orb.w < 25);
        assert.deepEqual(f.events, []);
        flight.onComplete();
        assert.deepEqual(f.events, gauge === 1 ? ['ui', 'charge'] : ['ui', 'ready', player ? 'player-ready' : 'enemy-ready']);
        assert.ok(f.images.slice(0, 5).every(i => i.destroyed));
        assert.equal(f.images.at(-1).x, gem.x); assert.equal(f.images.at(-1).y, gem.y);
    }
});

test('素材がなくても740msで宝石点灯・チャージ音、画面離脱後は発火しない', () => {
    const f = fixture(true, 1, false); f.advance(739); assert.deepEqual(f.events, []);
    f.advance(740); assert.deepEqual(f.events, ['ui', 'charge']);
    const early = fixture(); early.scene.state = 'title'; early.advance(1000); assert.equal(early.images.length, 0);
    const late = fixture(); late.advance(260); late.scene.mindDuelLayer = { add() {} };
    late.animations[0].onUpdate(); late.animations[0].onComplete();
    assert.deepEqual(late.events, ['stop']); assert.ok(late.images.every(i => i.destroyed));
});

test('光の移動中は判定ゲージを変えずに宝石と必殺ボタンの見た目だけ待たせる', () => {
    const gems = [0, 0]; let texture;
    const scene = { mindDuelPlayerHp: 1000, mindDuelNpcHp: 1000, mindDuelPlayerGauge: 2, mindDuelNpcGauge: 0,
        mindDuelPlayerGems: [0, 1].map(i => ({ setAlpha: alpha => gems[i] = alpha })), mindDuelNpcGems: [],
        mindDuelUiLayout: { actions: { attack: { size: 200 } } }, mindDuelActionArts: new Map([['attack', { setTexture(key) { texture = key; return this; }, setDisplaySize() {} }]]) };
    prototype.updateMindDuelUi.call(scene, 1, 0); assert.equal(scene.mindDuelPlayerGauge, 2); assert.deepEqual(gems, [1, 0.18]); assert.equal(texture, 'battle-action-attack');
    prototype.updateMindDuelUi.call(scene); assert.deepEqual(gems, [1, 1]); assert.equal(texture, 'battle-action-ultimate');
});

test('発光素材は配布先に保存されBootで事前ロードする', async () => {
    const file = new URL('../../projects/todays-champion-remaster/public/assets/championship-re/battle/effects/guard-charge-orb-v1.webp', import.meta.url);
    const metadata = await require('sharp')(readFileSync(file)).metadata(); assert.equal(metadata.width, 256); assert.equal(metadata.height, 256);
    assert.match(readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Boot.ts', import.meta.url), 'utf8'), /load.image\('battle-guard-charge-orb'/);
});
