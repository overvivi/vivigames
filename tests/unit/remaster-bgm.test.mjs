import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const source = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8');
const context = { exports: {}, require: () => ({ Scene: class {} }) };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const prototype = context.exports.Game.prototype;

function setup(locked = false) {
    const sounds = [];
    const scene = Object.assign(Object.create(prototype), {
        mindDuelBgmMode: 'menu', cache: { audio: { exists: () => true } },
        sound: { locked, add(key, config) {
            const sound = { key, config, isPlaying: false, plays: 0, destroyed: false,
                play() { this.isPlaying = true; this.plays++; }, destroy() { this.isPlaying = false; this.destroyed = true; }
            };
            sounds.push(sound); return sound;
        } }
    });
    return { scene, sounds };
}

test('メニュー内で曲を再開せず、戦闘と結果では一曲だけ切り替える', () => {
    const { scene, sounds } = setup();
    scene.setMindDuelBgm('menu'); scene.setMindDuelBgm('menu');
    assert.equal(sounds.length, 1); assert.equal(sounds[0].plays, 1);
    assert.equal(sounds[0].config.loop, true); assert.equal(sounds[0].config.volume, 0.35);
    scene.setMindDuelBgm('battle');
    assert.equal(sounds[0].destroyed, true); assert.equal(sounds[1].key, 'bgm-battle');
    scene.setMindDuelBgm('menu');
    assert.equal(sounds[1].destroyed, true); assert.equal(sounds[2].key, 'bgm-menu');
    assert.equal(sounds.filter(s => s.isPlaying).length, 1);
});

test('自動再生制限中は再生せず、解除時に現在の画面の曲だけを鳴らす', () => {
    const { scene, sounds } = setup(true);
    scene.setMindDuelBgm('menu'); scene.setMindDuelBgm('battle');
    assert.equal(sounds.length, 0);
    scene.sound.locked = false; scene.setMindDuelBgm(scene.mindDuelBgmMode);
    assert.equal(sounds.length, 1); assert.equal(sounds[0].key, 'bgm-battle');
});

test('BGM欠落時に例外や再生失敗ループを起こさない', () => {
    const { scene, sounds } = setup(); scene.cache.audio.exists = () => false;
    scene.setMindDuelBgm('menu'); assert.equal(sounds.length, 0);
});

test('メニュー音は18秒・末尾はフェード完了、戦闘音は19秒以降の約57.8秒', () => {
    const decode = file => execFileSync(require('ffmpeg-static'), ['-v', 'error', '-i', fileURLToPath(new URL(`../../projects/todays-champion-remaster/public/assets/championship-re/audio/${file}`, import.meta.url)), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 32 * 1024 * 1024 });
    const menu = decode('bgm-menu-v1.mp3');
    assert.equal(menu.length / 4 / 48000, 18);
    const rms = (start, end) => {
        let sum = 0; const first = Math.floor(start * 48000), last = Math.floor(end * 48000);
        for (let i = first; i < last; i++) sum += menu.readFloatLE(i * 4) ** 2;
        return Math.sqrt(sum / (last - first));
    };
    assert.ok(rms(17.98, 18) < rms(17, 17.1) * 0.08, '18秒直前はほぼ無音');
    const duration = decode('bgm-battle-v1.mp3').length / 4 / 48000;
    assert.ok(duration > 57 && duration < 58);
});
