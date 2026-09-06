import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const source = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

class Element {
    children = []; handlers = {}; value = ''; hidden = false;
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    remove() { this.removed = true; }
    addEventListener(type, fn) { this.handlers[type] = fn; }
}

function setup() {
    const storage = new Map();
    const document = { createElement: () => new Element(), head: new Element(), body: new Element() };
    const context = { exports: {}, document, require: () => ({ Scene: class {} }), sessionStorage: {
        setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key)
    } };
    vm.runInNewContext(compiled, context);
    const pointerHandlers = {};
    const image = { setInteractive() { return this; }, setAlpha() { return this; }, on(type, fn) { pointerHandlers[type] = fn; return this; } };
    const scene = Object.assign(Object.create(context.exports.Game.prototype), {
        state: 'title', input: { enabled: true }, titleModeButtons: new Map(), gameplayAssetsLoaded: true,
        add: { image: () => image }, stopFriendRoomPolling() {}, startFriendRoomPolling() {},
        showFighterSelect() { this.state = 'select'; }, showTitleScreen() { this.state = 'title'; }
    });
    return { scene, storage, pointerHandlers, button: text => scene.friendLobby.children.find(el => el.textContent === text) };
}

test('ロビーを開くと背面入力を停止し、DOMイベントもwindowへ伝播させない', () => {
    const { scene } = setup(); scene.showFriendLobby();
    assert.equal(scene.input.enabled, false);
    for (const event of ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
        let stopped = false;
        scene.friendLobby.handlers[event]({ stopPropagation() { stopped = true; } });
        assert.equal(stopped, true, event);
    }
    scene.destroyFriendLobby(); assert.equal(scene.input.enabled, true);
    scene.destroyFriendLobby(); assert.equal(scene.input.enabled, true);
});

test('ロビー中のCPUボタンと直接CPU入口の呼出で部屋を消さない', () => {
    const { scene, storage, pointerHandlers } = setup();
    scene.createTitleModeButton({ add() {} }, 'cpu', 'cpu', () => scene.startCpuMode());
    scene.showFriendLobby();
    scene.friendRoom = { code: 'TEST01', token: 'test-token', seat: 'host' }; scene.saveFriendRoom();
    const saved = storage.get('tc-friend-room');
    pointerHandlers.pointerdown(); scene.startCpuMode();
    assert.equal(scene.state, 'friend-lobby');
    assert.equal(scene.friendRoom.code, 'TEST01');
    assert.equal(storage.get('tc-friend-room'), saved);
});

for (const seat of ['host', 'guest']) test(`${seat}: 作成／参加後に部屋情報を維持して選択・STARTへ進む`, async () => {
    const { scene, button } = setup(); scene.showFriendLobby();
    scene.friendLobby.children.find(el => el.placeholder === 'YOUR NAME').value = 'TEST PLAYER';
    scene.friendLobby.children.find(el => el.placeholder === 'ROOM CODE').value = 'TEST01';
    scene.callFriendRoomRpc = async () => [{ code: 'TEST01', seat_token: 'test-token' }];
    await button(seat === 'host' ? 'CREATE ROOM' : 'JOIN ROOM').onclick();
    button('CONTINUE TO FIGHTER SELECT').onclick();
    assert.equal(scene.state, 'select'); assert.equal(scene.input.enabled, true);
    assert.equal(scene.friendRoom.seat, seat); assert.equal(scene.friendBattleMode, true);
    let started = false; scene.startFriendSelectedDuel = () => { started = true; };
    scene.startSelectedDuel(); assert.equal(started, true);
});

test('部屋なしのCONTINUEはロビーに留まり、フレンド選択へ直接進めない', () => {
    const { scene, button } = setup(); scene.showFriendLobby();
    button('CONTINUE TO FIGHTER SELECT').onclick(); scene.startCpuMode(true);
    assert.equal(scene.state, 'friend-lobby'); assert.equal(scene.input.enabled, false);
    assert.match(scene.friendLobby.children.find(el => el.className === 'tc-friend-lobby__status').textContent, /ROOM INFORMATION MISSING/);
});

test('保存済みの部屋情報から復元してCONTINUEできる', () => {
    const { scene, storage, button } = setup(); scene.showFriendLobby();
    storage.set('tc-friend-room', JSON.stringify({ code: 'TEST01', token: 'test-token', seat: 'guest' }));
    button('CONTINUE TO FIGHTER SELECT').onclick();
    assert.equal(scene.state, 'select'); assert.equal(scene.friendRoom.seat, 'guest');
});

test('BACK後はCPU入口が使え、意図したCPU開始時だけ部屋を破棄する', () => {
    const { scene, storage, button } = setup(); scene.showFriendLobby();
    scene.friendRoom = { code: 'TEST01', token: 'test-token', seat: 'host' }; scene.saveFriendRoom();
    button('BACK TO TITLE').onclick();
    assert.equal(scene.input.enabled, true); assert.equal(scene.state, 'title');
    scene.startCpuMode(); assert.equal(scene.state, 'select'); assert.equal(scene.friendRoom, undefined);
    assert.equal(storage.has('tc-friend-room'), false); assert.equal(scene.friendBattleMode, false);
});

test('閉じたロビーの遅延RPC結果で新しい画面の部屋情報を上書きしない', async () => {
    const { scene, button } = setup(); scene.showFriendLobby();
    scene.friendLobby.children.find(el => el.placeholder === 'YOUR NAME').value = 'TEST';
    let finish; scene.callFriendRoomRpc = () => new Promise(resolve => { finish = resolve; });
    const pending = button('CREATE ROOM').onclick();
    button('BACK TO TITLE').onclick();
    finish([{ code: 'STALE1', seat_token: 'old-test-token' }]); await pending;
    assert.equal(scene.state, 'title'); assert.equal(scene.friendRoom, undefined);
});

test('タイトル再表示で旧レイヤーを破棄し、選択画面を覆い隠さない', () => {
    const { scene } = setup();
    delete scene.showTitleScreen;
    let destroyed = false;
    scene.titleLayer = { destroy() { destroyed = true; } };
    const display = { setDepth() { return this; }, setDisplaySize() { return this; }, setInteractive() { return this; }, on() { return this; }, add() {} };
    scene.add = { container: () => display, image: () => display, text: () => display };
    scene.applyTitleLayout = () => {};
    scene.setMindDuelBgm = () => {};
    scene.showTitleScreen();
    assert.equal(destroyed, true);
    assert.equal(scene.titleLayer, display);
    assert.equal(scene.state, 'title');
});
