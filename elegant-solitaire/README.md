# elegant-solitaire

ゲーム置き場に載せている **SOLITAIRE**（`games/elegant-solitaire.html`）の元。

`games/elegant-solitaire.html` は **このプロジェクトの書き出し結果**で、
JSもCSSも1枚のHTMLへ畳んである。**あのファイルを直接編集しないこと。**
次のビルドで消える。直すのはここの `src/`。

```bash
npm install          # 最初の1回だけ
npm run dev          # 開発サーバー（http://localhost:3000）
npm run lint         # 型検査
npx tsx tools/rules.check.ts   # ルールまわりの検査（5件）
```

置き場へ反映するのは、リポジトリのルートから:

```bash
npm run games:build  # 両ゲームをビルドして games/ へコピー
npm run verify       # 参照切れと構文の検査
```

## 中身

| ファイル | 役割 |
|---|---|
| `src/gameLogic.ts` | 配牌、状態の型、オート完成の1手（`autoFinishStep`） |
| `src/solver.ts` | **配牌が最後まで解けるかを調べる探索器**。解けると証明できた配牌だけを配る |
| `src/App.tsx` | 画面と操作。移動の判定・得点・選択の管理 |
| `src/components/PlayingCard.tsx` | カード1枚の見た目 |
| `src/audio.ts` | 効果音（WebAudioの合成音） |

## 触るときの注意

- **詰み配牌を出さないことが、このゲームで一番大事な仕様。** `dealSolvable()` を通さずに
  `deal()` を直接使わないこと。ソルバーは保守的に作ってあり、「解ける」と言った配牌は必ず解ける
- ソルバーの探索上限（6000ノード）を上げると難しい配牌も通るが、生成に数百msかかって
  NEW GAME を押した瞬間に画面が固まる。上げるなら実測してから
- 組札から場札へ引き戻したら **−15点**。無得点にすると往復で無限に加点できてしまう
