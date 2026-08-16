# HELL RUNNER 画面上部の見切れ修正 指示書

作成日: 2026-08-17
状態: **未実装。討伐2048では同じ修正を適用済み（コミット `ed05d2a`）**

## 1. 何をするか

`games/temple-run-clone.html` の `.overlay` へ **1行足すだけ**。それ以外は変更しない。

## 2. 症状

オーバーレイ画面（タイトル、能力選択、ランキング、遊び方、ゲームオーバー、一時停止など）で、
**中身が画面より高くなると上端が見切れ、上へスクロールして戻ることができない。**

討伐2048では、ホーム画面の「？遊び方」「🏆RANKING」ボタンが切れる形で実際に発生した。
HELL RUNNERは現時点で中身が収まっているため表面化していないが、**同じ構造なので、
項目が増えるかウィンドウを縦に縮めた時点で必ず起きる。**

## 3. 原因

`.overlay` が次の組み合わせになっている。

```css
display:flex; flex-direction:column; justify-content:center;
overflow-y:auto;
```

中身が枠より高いと、中央揃えが**上下均等にはみ出させる**。下方向へはスクロールできるが、
上方向のはみ出しはスクロール範囲に入らないため、**上端が永久に到達不能になる。**
Flexboxでよく知られた挙動で、バグではなく仕様。

なお **この2ゲームにはメディアクエリが1つも無い**ため、画面幅は無関係。
「PCだけ起きる」と報告されるのは、単にPCのウィンドウ高が足りないため。

## 4. 編集箇所

`games/temple-run-clone.html`。行番号は編集で動くため、必ず検索で現在位置を出すこと。

```bash
grep -n '^\s*\.overlay{' games/temple-run-clone.html
```

その直下に、次の行がある（2026-08-17時点で134行目付近）。

```css
    display:flex; flex-direction:column; align-items:center; justify-content:center;
```

**この行の直後へ、次の1行を挿入する。**

```css
    justify-content:safe center;
```

結果はこうなる。

```css
  .overlay{
    position:absolute; inset:0;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    justify-content:safe center;
    background:
```

コメントを添える場合は、討伐2048に入れた文面へ揃えてよい。

## 5. やってはいけないこと

- **既存の `justify-content:center;` を消さない。** `safe` を解さない古いブラウザ向けの
  フォールバックとして必要。**必ず「center が先、safe center が後」の順**にする。逆だと効かない
- `overflow-y:auto` を外さない。スクロール自体は必要
- `align-items` を変えない。横方向の中央揃えは維持する
- `.overlay` を使う個別画面へ `justify-content` の上書きを足さない
- ファイル全体を読まない。base64の長大行を出力しない。フォーマッタをかけない（`AGENTS.md`）

## 6. 検証

```bash
grep -c '<script' games/temple-run-clone.html   # 開きと閉じが一致すること
grep -c '</script>' games/temple-run-clone.html
tail -c 40 games/temple-run-clone.html          # </html> で終わること
git diff --check
npm run test:syntax
```

目視確認（PC）:

1. HELL RUNNERをPCで開き、**ブラウザのウィンドウを縦に短く**する
2. 能力選択、ランキング、遊び方、一時停止の各画面を開く
3. **一番上の見出しやボタンが切れずに見えること**、上端までスクロールできることを確認
4. ウィンドウを十分に高くした状態では、**従来どおり中央に表示される**ことを確認

## 7. 完了条件

- 差分が `.overlay` への1行追加だけであること
- 上記の構造チェックと構文検査が通ること
- 縦に短いウィンドウで上端が見切れないこと
- 縦に余裕がある時は中央揃えのまま変わらないこと
- `PROJECT-STATUS.md` へ変更内容と確認結果を追記すること
