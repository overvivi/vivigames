# HELL RUNNER 2 ローグライト仕様書

## 1. 作品の分離方針

ローグライト能力システムは既存HELL RUNNERの大型更新として上書きせず、独立した新作
`HELL RUNNER 2`として制作する。ゲーム部分は既存の`games/temple-run-clone.html`を土台として流用するが、
既存版の操作感・ランキング・保存データ・公開状態へ影響させない。

- 新しいゲームHTML、保存キー、ランキング、デバッグ入口を使用する
- 既存HELL RUNNERのファイルを直接改造して2へ変えない
- 背景、地形、プレイヤー、大小ジャンプ、一時停止など再利用できる処理は複製後に2側で発展させる
- 画像素材は`images/hell-runner-2/`へ分離する
- 完成して遊べる段階まではポータルへ掲載・公開しない
- ライバルは能力化せず、現在の不安定ですぐ落下することもあるステージギミックとして維持する
- 既存HELL RUNNER 1は凍結し、明示指示がない限り修正・テスト対象にしない

## 2. UI完成予想図

完成予想図は`docs/mockups/hell-runner-roguelite-ui-concept.png`。

- 上部HUD直下にHTML/CSS製の経験値バーを置く
- 通常プレイ中の能力スロットは左右端へ小さく分け、中央視界を確保する
- 能力選択画面は携帯向けの縦3枚とし、カード1タップで即取得する
- 通常の3択後は3秒カウントを使わず、0.5～0.8秒程度の短い再開猶予を試作する
- ギャンブラー取得後と全能力完成後はレベルアップで停止しない

## 3. コインと経験値オーブの画像素材化

既存のCanvas描画コインはHELL RUNNER 2で画像素材へ置き換える。コインとXPオーブは対になる品質で制作し、
文字を読まなくても輪郭・色・動きで区別できるようにする。画像へ数値、`XP`、倍率は焼き込まない。

### 3.1 コイン

| 種類 | ファイル案 | 見た目 | 主な用途 |
|---|---|---|---|
| 通常 | `coin-normal-spritesheet.png` | 金、円形、中央に地獄紋章 | 基本得点 |
| 邪悪 | `coin-evil-spritesheet.png` | 紫黒、尖った外周、禍々しい紋章 | 高価値または特殊得点 |
| 幸運 | `coin-lucky-spritesheet.png` | 白金と虹金、星形の外周光 | 高額・Lucky報酬 |

各素材は透過PNGの横並び8フレームを基本とする。1フレーム192×192px、全体1536×192px。
回転しても中心位置と見かけの直径が動かず、縮小時にも種類を判別できることを必須とする。

### 3.2 経験値オーブ

| 種類 | ファイル案 | 見た目 | 主な用途 |
|---|---|---|---|
| 通常 | `xp-orb-spritesheet.png` | 青い不定形の魂、内側にルーン | 基本経験値 |
| 高密度 | `xp-orb-dense-spritesheet.png` | 青白く大きい魂、二重の光輪 | 複数コイン分の変換・高XP |

各素材は透過PNGの横並び6フレームを基本とする。1フレーム192×192px、全体1152×192px。
コインの円形回転とは異なり、外周が呼吸するように脈動し、内側の魂だけが揺れる。

### 3.3 変換器演出

`effect-coin-to-xp-spritesheet.png`を用意する。透過PNGの横並び8フレームを基本とし、
金色の粒子が砕けて青い魂へ再構成される。変換器取得時に画面内の既存コインへ一度だけ使用し、
取得後に新しく生成するアイテムは最初からXPオーブとして描画する。

変換器取得後は既存コインを1対1でXPへ置換しない。コイン3～5個程度を価値の高いXPオーブ1個へまとめる
ことを初期候補とし、出現数・間隔・XP価値を専用調整する。全能力完成後の内部コイン報酬は、通常の
10000mあたり平均コイン得点を実測し、変換器で失う直接コイン点の70～80%程度を回収する値から試す。

## 4. 画像とHTML/CSSの分担

画像素材にするもの:

- 能力アイコン
- COMMON・RARE・LEGENDの能力カード枠と発光
- 小型能力スロット枠、空枠、鍵、選択画面下部トレー
- LEVEL UP見出し、下部装飾、薄い背景テクスチャ
- コイン、経験値オーブ、変換器・レジェンド取得演出

HTML/CSS/Canvasで作るもの:

- LVゲージ全体、XP数値、バー進行、満タン発光
- 能力名、説明、レアリティ文字、`NEW`、レベル変化、ローマ数字、`MAX`
- カードとスロットの配置、レスポンシブ調整
- 暗転、入力ロック、選択処理、短い再開猶予
- ギャンブラーと全能力完成後の自動取得・頭上通知

## 5. 素材制作順

1. COMMON・RARE・LEGENDの能力カード枠
2. 小型スロット枠4種
3. 仮アイコン3個でHELL RUNNER 2のUI試作
4. 携帯でサイズと可読性を確認し、枠サイズを確定
5. 全能力アイコンを制作
6. コイン・XPオーブと変換演出を制作
7. LEVEL UP装飾・背景質感・レジェンド取得演出を制作
8. 実機で最終調整

### 5.1 工程1の制作結果

COMMON・RARE・LEGENDの文字なし透過カード枠を`images/hell-runner-2/frames/`へ制作した。
生成原本は`images/hell-runner-2/source/frames/`へ保存。外側四隅と中央開口部のアルファ0を実測済み。

- `card-frame-common.png`: 黒鉄＋青い魂光
- `card-frame-rare.png`: 焦げた金属＋金・琥珀光
- `card-frame-legend.png`: 黒曜石＋紫光、宝石だけに控えめな虹色

生成結果は約2.7:1で装飾が最もきれいに残ったため、無理に当初案の3.54:1へ引き伸ばさず、
CSS表示約354×128pxを初期基準とする。縦3枚でも390×844画面へ収まり、説明文とタップ領域も確保できる。

### 5.2 工程2の制作結果

小型能力スロット枠4種を`images/hell-runner-2/frames/`へ制作した。全て1254×1254pxの透過PNGで、
生成原本は`images/hell-runner-2/source/frames/`へ保存。四隅と中央開口部のアルファ0を実測済み。

- `slot-frame-common.png`: 黒鉄＋青いルーン・宝石
- `slot-frame-rare.png`: 焦げた金属＋金・琥珀ルーン
- `slot-frame-legend.png`: 黒曜石＋紫ルーン・虹白宝石
- `slot-frame-empty.png`: 発光なしの暗鉄＋消灯した黒い宝石

能力アイコン、レベル表記、鍵は画像へ焼き込まずHTMLで重ねる。通常プレイでは48～56px、
選択画面下部では必要に応じて少し縮小して表示し、実際のサイズは工程3のUI試作で確定する。

### 5.3 工程3のUI試作結果

既存HELL RUNNERを`games/hell-runner-2.html`へ複製し、2専用のUI試作を追加した。既存版のHTMLは変更せず、
試作側のランキングテーブル名とlocalStorageキーも分離した。2のランキングは未作成なので、外部ライブラリを
取得できないローカル環境でもゲーム本体とUI試作が起動する。

仮アイコンは次の3個を`images/hell-runner-2/icons/`へ制作し、生成原本を`source/icons/`へ保存した。

- `ability-main-triple-jump.png`
- `ability-support-coin-score.png`
- `ability-support-xp-magnet.png`

通常プレイでは上部HUD直下にHTML/CSS製XPバーを表示し、その下の左右端へ小型スロットを分割配置する。
デバッグモードの`LEVEL UP PREVIEW`で背景を停止し、縦3枚の能力カードと現在スロットを表示できる。
カードを1枚押すと0.65秒の短い静止＋`GO!`を経てゲームへ戻る。実際のXP抽選・取得とスロット反映も実装済み。

390×844の自動確認で全カードが画面内へ収まり、カード内文字の重なりを修正した。確認画像は
`docs/mockups/hell-runner-2-ui-prototype.png`。専用テストは`tests/hell-runner-2-ui.spec.js`。

ポーズボタンは独立配置をやめ、スコア・距離・ベストと並ぶ上部HUDの4枠目へCSSで統合する。
XPバーは現状維持。携帯のLEVEL UP寸法も現状を基準とし、PCだけカード・文字・アイコン・スロットを
約10～15%拡大する。PCの実画面キャプチャは`docs/mockups/hell-runner-2-ui-prototype-pc.png`。
通常走行中の上部HUD確認用キャプチャは、携帯が`docs/mockups/hell-runner-2-ui-hud-mobile.png`、
PCが`docs/mockups/hell-runner-2-ui-hud-pc.png`。

### 5.4 コイン・XPオーブ制作結果

画像生成した高解像度マスターを元に、縮小・軽い回転・明滅だけで連続フレームを作った。これにより
各フレームで意匠が変わる事故を避け、走行中に中心位置と識別性を安定させる。

- `images/hell-runner-2/collectibles/coin-normal-spritesheet.png` — 8フレーム、1536×192px
- `images/hell-runner-2/collectibles/coin-evil-spritesheet.png` — 8フレーム、1536×192px
- `images/hell-runner-2/collectibles/coin-lucky-spritesheet.png` — 8フレーム、1536×192px
- `images/hell-runner-2/collectibles/xp-orb-spritesheet.png` — 6フレーム、1152×192px
- `images/hell-runner-2/collectibles/xp-orb-dense-spritesheet.png` — 6フレーム、1152×192px

生成マスターは`images/hell-runner-2/source/collectibles/`へ保存。全5ファイルとも四隅アルファ0、
アルファ範囲0〜255を検査済み。変換器用の変換演出は、コインとXPの実装後に制作する。

### 5.5 全能力アイコン制作結果

メイン3種、補助5種、レジェンド5種の13アイコンを`images/hell-runner-2/icons/`へ揃えた。
生成マスターは`source/icons/`へ保存。全て1254×1254px、左上アルファ0、アルファ範囲0〜255を検査済み。

- メイン: 3段ジャンプ、滑空、転生
- 補助: コイン得点、コインコンボ、コンボ持続、経験値倍率、経験値吸引
- レジェンド: デスイーター、スロット解放、修羅、変換器、ギャンブラー

一覧確認画像は`docs/mockups/hell-runner-2-ability-icons-contact.png`。

### 5.6 変換器演出制作結果

`images/hell-runner-2/collectibles/effect-coin-to-xp-spritesheet.png`を制作。1536×192pxの8フレームで、
通常コイン→金粒子と変換流→XPオーブの順に変化する。マスターは
`images/hell-runner-2/source/collectibles/effect-coin-to-xp-master.png`へ保存。四隅アルファ0、
アルファ範囲0〜255を検査済み。

### 5.7 LEVEL UP見出し装飾

`images/hell-runner-2/frames/level-up-header-ornament.png`を制作し、HTML文字の`LEVEL UP`の背後へ統合した。
装飾画像は文字を含まない透過素材で、今後の文言変更に影響しない。390×844とPCの専用UIテストで、
カード・説明・下部スロットが画面内に収まることを再確認済み。

### 5.8 ローグライト能力ループ実装結果

開始時は2段ジャンプのみ。XPオーブでレベルを上げ、取得可能なメイン・補助から3択を抽選する。
メインは2枠（スロット解放取得時のみ3枠）、補助は3枠、LEGENDは1枠として実装した。

- 補助5種は各Lvの数値効果まで接続済み。デスイーター取得後だけ補助上限を5から6へ広げる
- LEGENDは候補抽選の5%。修羅は固定960px/s・得点1.10倍、ギャンブラーは停止なしの候補内ランダム取得・得点1.12倍
- 変換器取得中はコイン回収をXPへ変え、画面上の既存コインもXPオーブ表示へ即時見せ替えする。回収地点では8フレームのコイン→XP演出も再生する
- 取得可能な能力が尽きた後はLEVEL UP画面を出さず、内部3択相当の18 / 28 / 46点から1つを抽選して`Lucky!`と通知する

通常HUDのメイン・補助・LEGEND枠も現在のビルドとレベルを動的に描画する。`?debug=1`にはテスト用の
`setRogueBuild()`と状態取得を追加したが、通常URLへは公開しない。専用UIテスト3件と`npm run verify`を通過済み。
