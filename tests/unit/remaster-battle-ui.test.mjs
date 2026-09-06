import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('../../projects/todays-champion-remaster/node_modules/typescript');
const source = readFileSync(new URL('../../projects/todays-champion-remaster/src/game/scenes/Game.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('Game.ts', source, ts.ScriptTarget.Latest, true);
const game = ast.statements.find(node => ts.isClassDeclaration(node) && node.name.text === 'Game');
const initial = game.members.find(node => node.name?.getText(ast) === 'mindDuelUiLayout').initializer.getText(ast);
const layout = vm.runInNewContext(`(${initial})`, { VIEW_WIDTH: 941 });
const context = { exports: {}, require: () => ({ Scene: class {} }) };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);

test('採用済みの案内・選択アクション・3ボタンの全初期値を保持する', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(layout)), {
        prompt: { x: 470.5, y: 1274, size: 17 }, reveal: { x: 470.5, y: 436, size: 47 },
        actions: { break: { x: 173, y: 1435, size: 230 }, guard: { x: 470.5, y: 1435, size: 230 }, attack: { x: 768, y: 1435, size: 230 } }
    });
});

test('初期値を表示とボタン当たり判定へ同時に反映する', () => {
    const item = () => ({ setPosition(x, y) { this.x = x; this.y = y; return this; }, setFontSize(size) { this.fontSize = size; return this; }, setSize(w, h) { this.width = w; this.height = h; return this; }, setDisplaySize(w, h) { return this.setSize(w, h); } });
    const scene = { mindDuelUiLayout: layout, mindDuelChoosePlate: item(), mindDuelStatus: item(), mindDuelReveal: item(), mindDuelActionArts: new Map(), mindDuelActionHitAreas: new Map() };
    for (const move of Object.keys(layout.actions)) { scene.mindDuelActionArts.set(move, item()); scene.mindDuelActionHitAreas.set(move, item()); }
    context.exports.Game.prototype.applyMindDuelUiLayout.call(scene);
    assert.equal(scene.mindDuelChoosePlate.y, 1263);
    assert.equal(scene.mindDuelStatus.y, 1274);
    assert.equal(scene.mindDuelReveal.y, 436); assert.equal(scene.mindDuelReveal.fontSize, 47);
    for (const [move, values] of Object.entries(layout.actions)) for (const obj of [scene.mindDuelActionArts.get(move), scene.mindDuelActionHitAreas.get(move)]) {
        assert.equal(obj.x, values.x); assert.equal(obj.y, values.y); assert.equal(obj.width, values.size); assert.equal(obj.height, values.size);
    }
});
