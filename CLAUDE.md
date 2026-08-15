# vivi's game

自作ブラウザゲーム集。各ゲームは**単一のHTMLファイルで完結**しており、ビルド工程もnpmもない。
ファイルをブラウザで開けばそのまま動く。

## ファイル構成

| ファイル | 内容 | 状態 |
|---|---|---|
| `index.html` | ゲーム置き場(ポータル)。パッチノートもここに記載 | 現役 |
| `temple-run-clone.html` | **HELL RUNNER** 本体(約6.2MB) | 完成 |
| `boss-battle-demo.html` | **討伐2048** 本体(約7.3MB) | 開発中 |
| `tetris.html` | テトリス。ポータルに3本目として追加予定だが**未リンク** | 試作 |
| `supabase-setup.sql` | ランキング用テーブル作成SQL | 参照用 |
| `supabase-fix-permissions.sql` | GRANT修正SQL(下記の落とし穴を参照) | 参照用 |

ファイルサイズが大きいのは、ドット絵スプライト・UI画像・BGMを **base64で埋め込んでいる**ため。
コード自体は HELL RUNNER が約2200行、討伐2048 が約1700行で、base64は数十行に収まっている。

## 落とし穴 / ハマりどころ

### Supabase: RLSポリシーだけでは足りない

テーブルにRLSポリシーを設定しても、**GRANTを忘れると `permission denied` になる**(実際にハマった)。
ポリシーは「行へのアクセス可否」、GRANTは「テーブルへのアクセス権」で、**両方**必要。

```sql
grant select, insert on runner_scores to anon, authenticated;
grant usage on all sequences in schema public to anon, authenticated;
```

`id` 列が `generated always as identity` のため、シーケンスへの `usage` も要る。
詳細は `supabase-fix-permissions.sql` を参照。

### base64埋め込みファイルの編集

6〜7MBのHTMLを丸ごと読むとコンテキストを食い潰す。編集時は base64 の行(500字超の行)を避けて、
コード部分だけを対象にすること。

## HELL RUNNER(`temple-run-clone.html`)

崩れた足場を2段ジャンプで越える横スクロールランナー。2D Canvas。

- **能力**: 転生(2500m)・レッドブル(5000m)・滑空(10000m)で解放。プレイ開始時に選択する
- **ステージギミック**(選択制ではなく距離到達で全員に自動発動):
  - 5000m — ライバル(デビル)出現
  - 20000m — 十倍界王拳。頭が巨大化し視界デバフ、その代わり頭上のコイン取得判定も拡大
  - 30000m以降 — ゆるやかに加速(50000mで頭打ち・最大+40%)
- **スプライト**: プレイヤー=骸骨、ライバル=デビルのドット絵を導入済み
- **ランキング**: Supabase `runner_scores` テーブル
- **セーブ**: localStorage。キーは `v2` 系(旧バージョンの記録を切り離すため)

### 廃止済み(復活させないこと)

- **修羅モード**(速度1.5倍)— 難易度が高すぎたため廃止
- **十倍界王拳の選択式**— ステージギミックへ変更済み

## 討伐2048(`boss-battle-demo.html`)

2048の合体でボスにダメージを与えるRPG風バトル。

- 勇者選択 + 3ステージ + チャレンジモード
- ボスはHP1割で**1回だけ**回復する
- 目標タイル到達で必殺技による即撃破
- **ランキング**: Supabase `boss_battle_scores` テーブル
- **セーブ**: localStorage `bossDemoUnlockedStages` / `bossDemoChallengeBest`(エクスポート/インポート機能あり)

## 引き継がれなかった試作

`climb-prototype.html` / `evolve-merge.html` / `temple-run-clone-glide-test.html` は
過去の検証用で本編に未統合。このリポジトリには**持ち込んでいない**。

## 慣習

- コード内のコメントは日本語。**なぜそうしたか**を書き残す方針(特に、過去のバグを踏まえた実装意図)
- パッチノートは `index.html` の `<details>` 内に、ゲームごと・バージョンごとに追記する
