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
const proto = context.exports.Game.prototype;
function fixture(gauge, move = 'attack', friend = false) {
    const events = new Map(), chosen = [];
    const art = { setDisplaySize(w, h) { this.width = w; this.height = h; return this; }, setAlpha() { return this; }, setTexture(key) { this.key = key; return this; } };
    const hit = { setInteractive() { return this; }, on(type, fn) { events.set(type, [...events.get(type) || [], fn]); return this; } };
    const scene = {
        state: 'mind-duel', mindDuelLocked: false, mindDuelPlayerGauge: gauge,
        mindDuelUiLayout: { actions: { [move]: { x: 768, y: 1435, size: 230 } } },
        add: { image: () => art, zone: () => hit }, mindDuelActionArts: new Map(), mindDuelActionHitAreas: new Map(),
        chooseMindDuelMove: proto.chooseMindDuelMove, chooseMindDuelCpuMove: () => 'guard', playMindDuelSfx() {},
        time: { delayedCall: (_delay, fn) => fn() }, resolveMindDuelRound: playerMove => chosen.push(playerMove)
    };
    if (friend) { scene.friendRoom = {}; scene.chooseFriendMindDuelMove = value => { scene.mindDuelLocked = true; chosen.push(value); }; }
    proto.createMindDuelButton.call(scene, { add() {} }, `battle-action-${move}`, move);
    return { scene, art, chosen, emit: type => events.get(type)?.forEach(fn => fn()) };
}

test('PCもタッチも押した瞬間に確定し、ゲージ満タンだけ必殺技になる', () => {
    for (const friend of [false, true]) for (const gauge of [0, 1, 2]) {
        const f = fixture(gauge, 'attack', friend);
        f.emit('pointerdown');
        assert.deepEqual(f.chosen, [gauge === 2 ? 'ultimate' : 'attack']);
        f.emit('pointerup'); f.emit('pointerdown'); f.emit('pointerup');
        assert.equal(f.chosen.length, 1, '離す・連打で二重送信しない');
    }
});
test('満タンでもGUARD/BREAKは維持し、画面外・解決中の入力は拒否する', () => {
    for (const move of ['guard', 'break']) { const f = fixture(2, move); f.emit('pointerdown'); assert.deepEqual(f.chosen, [move]); }
    for (const state of ['title', 'select', 'result']) { const f = fixture(2); f.scene.state = state; f.emit('pointerdown'); assert.deepEqual(f.chosen, []); }
    const f = fixture(2); f.scene.mindDuelLocked = true; f.emit('pointerdown'); assert.deepEqual(f.chosen, []);
});
test('0→1→2→消費0で画像を切替え、調整したサイズは変えない', () => {
    const f = fixture(0);
    Object.assign(f.scene, { mindDuelPlayerHp: 1000, mindDuelNpcHp: 1000, mindDuelPlayerGems: [], mindDuelNpcGems: [] });
    f.scene.mindDuelUiLayout.actions.attack.size = 270;
    for (const gauge of [0, 1, 2, 2, 0]) {
        f.scene.mindDuelPlayerGauge = gauge; proto.updateMindDuelUi.call(f.scene);
        assert.equal(f.art.key, gauge === 2 ? 'battle-action-ultimate' : 'battle-action-attack');
        assert.equal(f.art.width, 270); assert.equal(f.art.height, 270);
    }
    assert.doesNotMatch(source, /finishMindDuelAttackGesture|startMindDuelAttackGesture|battle-ultimate-swipe-trail|battle-ultimate-ready-ring/);
});
test('虹色ボタンは実alphaを持つ透明素材でロードされる', async () => {
    const sharp = require('sharp');
    const path = new URL('../../projects/todays-champion-remaster/public/assets/championship-re/battle/battle-action-ultimate-v1.webp', import.meta.url);
    const bytes = readFileSync(path), meta = await sharp(bytes).metadata();
    assert.equal(meta.hasAlpha, true);
    const { data, info } = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
    assert.equal(data[3], 0); assert.ok(data[Math.floor(info.height / 2) * info.width * 4 + Math.floor(info.width / 2) * 4 + 3] > 240);
    assert.match(source, /load.image\('battle-action-ultimate', 'assets\/championship-re\/battle\/battle-action-ultimate-v1.webp'\)/);
});
