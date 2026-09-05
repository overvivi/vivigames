# immune-defense

ゲーム置き場に載せている **IMMUNE DEFENSE**（`games/immune-defense.html`）の元。

`games/immune-defense.html` は **このプロジェクトの書き出し結果**で、
JSもCSSも1枚のHTMLへ畳んである。**あのファイルを直接編集しないこと。**
次のビルドで消える。直すのはここの `src/`。

```bash
npm install          # 最初の1回だけ
npm run dev          # 開発サーバー（http://localhost:3000）
npm run lint         # 型検査
npx tsx tools/engine.check.ts  # エンジンの検査（8件）
```

置き場へ反映するのは、リポジトリのルートから:

```bash
npm run games:build  # 両ゲームをビルドして games/ へコピー
npm run verify       # 参照切れと構文の検査
```

## 中身

| ファイル | 役割 |
|---|---|
| `src/game/constants.ts` | マスの大きさ、細胞7種の性能、勝利ウェーブ |
| `src/game/Map.ts` | 経路。waypoint を繋いで作る |
| `src/game/GameEngine.ts` | ウェーブ生成、更新ループ、研究、売却 |
| `src/game/entities/` | 細胞と弾、病原体 |
| `src/components/GameCanvas.tsx` | 盤面の描画とクリック・パン・ズーム |
| `src/bg.ts` | 背景画像の参照先。**本番は `images/immune-defense/bg.webp`（外部）** |

## 触るときの注意

- **背景だけは外部ファイル。** base64で埋め込むとHTMLが1MB以上太るため、
  置き場の他のゲームと同じく `images/` に置いている（AGENTS.md「背景画像だけが例外」）。
  webpは `npm run games:build` が元のjpgから作り直す
- **研究（アップグレード）は `GameEngine` 側の倍率で持つこと。** 細胞へ直接掛けると、
  次に配置したときに `updateBuffs()` が全細胞の `damageMultiplier` を1へ戻すので消える
- 継続ダメージ（好酸球）は重ねがけしない。重なると1体で他ユニットの数倍の火力になり、
  編成の意味が無くなる
- 難易度の数値（HPの伸び 0.4、敵速度100、経路46マス＝約26秒）は**実機で詰めていない初期値**。
  変えるときは `tools/engine.check.ts` の「渡り切る時間」も一緒に見ること
