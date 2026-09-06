# 戦闘アクション採用音源

## 必殺ゲージ獲得SE（2026-09-07採用）

ユーザーの訂正で、1個目用に生成した#2を1個目・2個目の両方へ共用。MP3は無加工。

| ファイル | 元ファイル | 用途 |
| --- | --- | --- |
| `gauge-charge-v1.mp3` | `One_short_energy_cha_#2-1788713121163.mp3` | 0→1／1→2共通、生成尺0.5秒 |
| `gauge-max-v1.mp3` | `One_short_magical_en_#2-1788713121165.mp3` | 旧MAX候補。比較用に保持、ゲームでは未使用 |

Bootで事前ロード。ガード成功時の結晶更新に合わせて、獲得側がプレイヤー／相手のどちらでも再生する。
1個目・MAXとも同じ獲得音を一発だけ鳴らす。満タン維持・ゲージ消費時は獲得音なし。
ガード衝突音は従来どおり。基準音量は両方0.65にSE設定の倍率を掛ける。
SEミュート・再生途中の音量変更にも追従し、音源欠落時のみ短い仮音へ戻す。
プロンプトは`source/audio/gauge/elevenlabs-prompts.md`参照。BGM加工v1／ローカル合成v2は使用しない。

2026-09-06、ユーザー指定のElevenLabs履歴からMP3を保存。音源の加工・再生成はしていない。
各1秒（MP3コンテナの表示は約1.03秒）。ゲーム中は攻撃ポーズ・VFXの開始と同時に再生する。

| ファイル | 採用候補 | ダウンロード元ファイル |
| --- | --- | --- |
| vivi-attack-v1.mp3 | 雷の連続放電を強めた最新版 #4 | Single_electrified_s_#4-1788702421968.mp3 |
| kiri-attack-v1.mp3 | 高い金属音の余韻を強めた最新版 #2 | Single_scythe_slash,_#2-1788702547423.mp3 |
| tomega9-attack-v1.mp3 | 初版 #2 | One_heavy_martial-ar_#2-1788702563839.mp3 |
| noise-attack-v1.mp3 | 初版 #4 | One_forceful_sonic_s_#4-1788702651391.mp3 |
| brick-attack-v1.mp3 | 初版 #4 | One_massive_war_hamm_#4-1788702728455.mp3 |
| mika-attack-v1.mp3 | 初版 #1 | One_devastating_figh_#1-1788702815104.mp3 |
| raven-attack-v1.mp3 | 初版 #2 | One_powerful_enchant_#2-1788702889952.mp3 |

履歴: https://elevenlabs.io/app/sound-effects/history

単独アタック音量0.65、両者アタック時は各0.45。左右どちらも攻撃したキャラの音を使う。
採用音に同種の仮ヒット音は重ねない。ガード成功・選択・ゲージ準備・結果の仮SEは維持。
キャラ画像と一緒に音を事前ロードする。読込失敗時は従来の仮ヒット音へフォールバックする。

## BREAK／ULTIMATE（2026-09-07追加）

履歴の採用候補をMP3保存。ダウンロード後のトリミング・音程変更・再生成なし。
RAVEN／VIVIのULTIMATEだけは、既に採用済みの約+2半音・90ms×10連打版をコピーした。

| キャラ・技 | 採用候補 | 元ファイル |
| --- | --- | --- |
| raven / kiri BREAK | TΩ9初版 #3共用 | Single_powerful_risi_#3-1788709889391.mp3 |
| tomega9 BREAK | 初版 #2 | Single_powerful_risi_#2-1788709735513.mp3 |
| noise BREAK | 障壁破砕改訂版 #3 | One_large_brittle_gl_#3-1788709768919.mp3 |
| brick BREAK | 咆哮改訂版 #4 | One_powerful_adult_m_#4-1788709793520.mp3 |
| vivi BREAK | 初版 #4 | Single_electrified_s_#4-1788709817864.mp3 |
| mika BREAK | 初版 #2 | Single_two-palm_shoc_#2-1788709838972.mp3 |
| brick ULTIMATE | 大音量爆砕改訂版 #4 | One_extremely_loud_c_#4-1788709546912.mp3 |
| tomega9 ULTIMATE | #4 | A_dragon-like_contin_#4-1788709618587.mp3 |
| kiri ULTIMATE | #3 | One_enormous_scythe__#3-1788709656629.mp3 |
| noise ULTIMATE | #4 | A_sustained_low-pitc_#4-1788709684581.mp3 |
| mika ULTIMATE | #2 | A_huge_forward-trave_#2-1788709709507.mp3 |
| raven / vivi ULTIMATE | 加工済み共通採用音 | source/audio/ultimate-burst/raven-vivi-ultimate-burst-10x-90ms-pitch-plus2.mp3 |

出力名は`{character}-{attack|break|ultimate}-v1.mp3`。BREAKは約1秒、ULTIMATEは約2.5秒（共通連打版のみ約0.9秒）。
再生は両者の技・VFX発動と同じタイミング。ATTACK/BREAK音量0.65、ULTIMATE音量0.8。
両者とも攻撃系の手なら各0.45／ULTIMATEのみ0.55へ減音する。
音の余韻は次ラウンドの発動またはタイトル復帰で停止する。ゲームの入力待ち時間は変更しない。

## BGM「混沌の神_loop」（2026-09-07試聴版）

採用済み。配布サイト: [フリーBGM by パンダの中のパンダ](https://free-bgm.panda-clip.com/)。曲名: [混沌の神](https://free-bgm.panda-clip.com/kontonnokami/)。ゲーム置き場のCREDITSにサイト名・曲名・区間ループ/フェード編集を表示する。

ユーザー提供`混沌の神_loop.mp3`から192kbps MP3を2本作成。原本は変更しない。

- `bgm-menu-v1.mp3`: 元曲0〜18秒。17〜18秒の1秒で線形フェードアウトし、18秒で無音まで下げて0秒へループ。
- `bgm-battle-v1.mp3`: 元曲19秒〜末尾。切り出し後の先頭（元曲19秒）へループ。18〜19秒は使用しない。
- タイトル／フレンドロビー／キャラ選択／リザルトはmenu。タイトル→セレクトでは再開せず継続。戦闘開始でbattle、勝敗決着のリザルトでmenuの先頭へ切替。
- 試聴用音量0.35。二重再生せず、シーン終了で破棄。ブラウザの自動再生制限がある場合は最初のクリック／タップ後に開始する。
- フェードは音源に焼き込み、画面の描画間隔による18秒境界のずれを避ける。ループは音声エンジンに任せる。

再作成用FFmpegフィルター: menu=`atrim=start=0:end=18,asetpts=PTS-STARTPTS,afade=t=out:st=17:d=1`、battle=`atrim=start=19,asetpts=PTS-STARTPTS`。エンコード=`-c:a libmp3lame -b:a 192k`。
