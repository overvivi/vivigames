import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
function load(path, globals = {}) {
    const context = { exports: {}, require: () => ({ Scene: class {} }), ...globals };
    vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return context.exports;
}
const { readAudioSettings } = load('../../projects/todays-champion-remaster/src/game/AudioControls.ts');
const prototype = load('../../projects/todays-champion-remaster/src/game/scenes/Game.ts').Game.prototype;
test('保存なし・破損・保存拒否時は確定済み初期音量に戻る', () => {
    for (const storage of [{ getItem: () => null }, { getItem: () => '{broken' }, { getItem: () => { throw Error(); } }]) {
        assert.equal(JSON.stringify(readAudioSettings(storage)), JSON.stringify({ bgm: 35, sfx: 100, bgmMuted: false, sfxMuted: false }));
    }
});

test('音設定を開いた間は入力を停止し、閉じると元の状態だけを復元する', () => {
    for (const original of [true, false]) {
        const scene = { input: { enabled: original } };
        prototype.setAudioModalOpen.call(scene, true);
        prototype.setAudioModalOpen.call(scene, true);
        assert.equal(scene.input.enabled, false);
        prototype.setAudioModalOpen.call(scene, false);
        assert.equal(scene.input.enabled, original);
        assert.equal(scene.audioModalInputEnabled, undefined);
    }
    const scene = { input: { enabled: false }, friendLobbyInputEnabled: true };
    prototype.setAudioModalOpen.call(scene, true);
    prototype.destroyFriendLobby.call(scene);
    assert.equal(scene.input.enabled, false);
    prototype.setAudioModalOpen.call(scene, false);
    assert.equal(scene.input.enabled, true);
});

function modalFixture() {
    const listeners = new Map(), saved = new Map();
    const doc = { addEventListener: (type, fn) => listeners.set(fn, type), removeEventListener: (_type, fn) => listeners.delete(fn) };
    class Element {
        children = []; attrs = {}; style = {}; isConnected = true;
        constructor(tag) { this.tag = tag; }
        append(...nodes) { for (const node of nodes) { this.children.push(node); if (typeof node === 'object') node.parent = this; } }
        appendChild(node) { this.append(node); return node; }
        setAttribute(key, value) { this.attrs[key] = value; }
        contains(node) { return node === this || this.children.some(child => typeof child === 'object' && child.contains(node)); }
        querySelector(selector) { return this.querySelectorAll(selector)[0]; }
        querySelectorAll(selector) { return this.children.flatMap(child => typeof child === 'object' ? [...((selector.startsWith('.') ? child.className === selector.slice(1) : selector.split(',').includes(child.tag)) ? [child] : []), ...child.querySelectorAll(selector)] : []); }
        set innerHTML(_value) { for (const name of ['note', 'cross', 'mute-label']) { const span = new Element('span'); span.className = name; this.append(span); } }
        focus() { doc.activeElement = this; }
        remove() { this.isConnected = false; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 375, height: 667 }; }
    }
    doc.createElement = tag => new Element(tag); doc.body = new Element('body'); doc.head = new Element('head'); doc.activeElement = doc.body;
    const { AudioControls } = load('../../projects/todays-champion-remaster/src/game/AudioControls.ts', {
        document: doc, Node: Element, HTMLElement: Element, window: { innerWidth: 375, innerHeight: 667, addEventListener() {}, removeEventListener() {} },
        localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) }, ResizeObserver: class { observe() {} disconnect() {} }
    });
    const states = []; let changes = 0;
    const controls = new AudioControls(new Element('canvas'), false, () => changes++, open => states.push(open));
    return { controls, doc, states, saved, listeners, changes: () => changes };
}

test('単一♪から大きな音設定を開閉し、個別ミュート・音量を保存する', () => {
    const { controls: c, doc, states, saved, changes } = modalFixture();
    assert.equal(c.overlay.hidden, true);
    assert.equal(c.opener.style.width, '44px');
    c.opener.onclick();
    assert.equal(c.overlay.hidden, false); assert.equal(doc.activeElement, c.close);
    assert.equal(c.dialog.attrs['aria-modal'], 'true');
    const sliders = c.dialog.querySelectorAll('input');
    sliders[0].value = '61'; sliders[0].oninput();
    const mute = c.dialog.querySelectorAll('button')[1]; mute.onclick();
    assert.equal(c.settings.bgm, 61); assert.equal(c.settings.bgmMuted, true); assert.equal(c.settings.sfx, 100);
    assert.equal(JSON.parse(saved.get('tc-audio-settings-v1')).bgm, 61); assert.equal(changes(), 2);
    c.close.onclick(); assert.equal(c.overlay.hidden, true); assert.equal(doc.activeElement, doc.body);
    assert.equal(states.join(','), 'true,false');
    c.opener.onclick(); assert.equal(sliders[0].value, '61');
    c.destroy(); assert.equal(states.join(','), 'true,false,true,false');
});

test('開いている間は背面イベントを遮断し、閉じたクリックも貫通させない', () => {
    const { controls: c, doc, listeners } = modalFixture();
    let blocked = 0;
    const event = target => ({ target, stopPropagation: () => blocked++, preventDefault() {} });
    c.block(event(doc.body)); assert.equal(blocked, 0);
    c.opener.onclick(); c.block(event(doc.body)); assert.equal(blocked, 1);
    const last = c.dialog.querySelectorAll('input').at(-1); last.focus();
    c.keyboard({ ...event(last), key: 'Tab' }); assert.equal(doc.activeElement, c.close);
    c.keyboard({ ...event(c.close), key: 'Escape' }); assert.equal(c.overlay.hidden, true);
    c.block(event(c.close)); assert.equal(blocked, 3);
    c.block(event(doc.body)); assert.equal(blocked, 3);
    c.destroy(); assert.equal(listeners.size, 0);
});

test('セレクトだけ指定の♪位置にし、他画面へ戻ると従来位置に戻す', () => {
    const { controls: c } = modalFixture();
    const original = { ...c.opener.style };
    c.setScreen('select');
    assert.equal(c.opener.style.left, `${375 * 805 / 941 - 22}px`);
    assert.equal(c.opener.style.top, `${667 * 105 / 1672}px`);
    assert.equal(c.opener.style.width, original.width);
    c.position(); assert.equal(c.opener.style.top, `${667 * 105 / 1672}px`);
    c.setScreen('default'); assert.deepEqual(c.opener.style, original);
    c.setScreen('select'); assert.equal(c.opener.style.top, `${667 * 105 / 1672}px`);
    c.destroy();
});
test('相性アイコンはバトルだけ、♪と同じ大きさで直下に配置する', () => {
    const { controls: c, states } = modalFixture();
    assert.equal(c.rulesButton.hidden, true);
    c.rulesButton.onclick(); assert.equal(c.rulesOverlay.hidden, true);
    c.setScreen('select'); assert.equal(c.rulesButton.hidden, true);
    c.setScreen('battle'); assert.equal(c.rulesButton.hidden, false);
    assert.equal(c.rulesButton.style.width, c.opener.style.width);
    assert.equal(c.rulesButton.style.height, c.opener.style.height);
    assert.equal(c.rulesButton.style.left, c.opener.style.left);
    assert.equal(parseFloat(c.rulesButton.style.top), parseFloat(c.opener.style.top) + parseFloat(c.opener.style.height) + 8);
    c.rulesButton.onclick(); assert.equal(c.rulesOverlay.hidden, false);
    c.setScreen('default'); assert.equal(c.rulesOverlay.hidden, true); assert.equal(c.rulesButton.hidden, true);
    assert.equal(states.join(','), 'true,false');
    c.destroy();
});

test('相性表は×とEscapeで閉じ、背面を遮断してから音設定も正常に開ける', () => {
    const { controls: c, doc, states } = modalFixture();
    c.setScreen('battle'); c.rulesButton.focus(); c.rulesButton.onclick();
    assert.equal(c.rulesDialog.attrs['aria-modal'], 'true');
    assert.equal(c.rulesDialog.querySelectorAll('img')[0].src, 'assets/championship-re/battle/battle-rules-help-v1.webp');
    assert.equal(doc.activeElement, c.rulesClose);
    let blocked = 0;
    c.block({ target: doc.body, stopPropagation() { blocked++; } }); assert.equal(blocked, 1);
    c.rulesClose.onclick(); assert.equal(doc.activeElement, c.rulesButton);
    c.block({ target: c.rulesClose, stopPropagation() { blocked++; } }); assert.equal(blocked, 2);
    c.opener.onclick(); assert.equal(c.overlay.hidden, false); assert.equal(c.rulesOverlay.hidden, true);
    c.close.onclick(); c.rulesButton.onclick();
    c.keyboard({ key: 'Escape', preventDefault() {}, stopPropagation() {} });
    assert.equal(c.rulesOverlay.hidden, true);
    assert.equal(states.join(','), 'true,false,true,false,true,false');
    c.destroy();
});

test('音量・各ミュートを別々に復元し、範囲外の値を制限する', () => {
    const settings = readAudioSettings({ getItem: () => JSON.stringify({ bgm: -10, sfx: 200, bgmMuted: true, sfxMuted: false }) });
    assert.equal(settings.bgm, 0); assert.equal(settings.sfx, 100);
    assert.equal(settings.bgmMuted, true); assert.equal(settings.sfxMuted, false);
});
test('SEミュート時は生成音も仮音も鳴らさず、通常時は比率を維持して減音', () => {
    let volume;
    const scene = { audioControls: { settings: { sfx: 50, sfxMuted: false } }, cache: { audio: { exists: () => true } }, sound: { play: (_key, cfg) => { volume = cfg.volume; return true; } } };
    prototype.playMindDuelMoveSfx.call(scene, { id: 'vivi' }, 'ultimate'); assert.equal(volume, 0.4);
    scene.audioControls.settings.sfxMuted = true;
    scene.sound.play = () => assert.fail('muted');
    assert.equal(prototype.playMindDuelMoveSfx.call(scene, { id: 'vivi' }, 'ultimate'), true);
    assert.doesNotThrow(() => prototype.playMindDuelSfx.call(scene, 'victory'));
});
test('再生中も即座にミュートし、解除で元の相対音量へ戻す（再スタートなし）', () => {
    const sound = { key: 'battle-audio-vivi-ultimate', volume: 0.8, setVolume(v) { this.volume = v; } };
    const bgm = { volume: 0.35, setVolume(v) { this.volume = v; } };
    let synth;
    const scene = { audioControls: { settings: { bgm: 35, sfx: 100, bgmMuted: false, sfxMuted: true } }, appliedSfxGain: 1, activeSfxBases: new WeakMap(), mindDuelBgm: bgm, sound: { getAllPlaying: () => [bgm, sound] }, mindDuelSfxGain: { gain: { setValueAtTime: value => { synth = value; } } }, mindDuelAudio: { currentTime: 0 } };
    bgm.key = 'bgm-menu';
    prototype.applyAudioSettings.call(scene); assert.equal(sound.volume, 0); assert.equal(synth, 0); assert.equal(bgm.volume, 0.35);
    scene.audioControls.settings.sfxMuted = false; scene.audioControls.settings.sfx = 50; scene.audioControls.settings.bgmMuted = true;
    prototype.applyAudioSettings.call(scene); assert.equal(sound.volume, 0.4); assert.equal(synth, 0.5); assert.equal(bgm.volume, 0);
});
