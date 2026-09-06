# 通常アタック採用音源

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
通常アタックの共通仮ヒット音は重ねない。ガード・BREAK・ULTIMATE等の仮SEは維持。
キャラ画像と一緒に音を事前ロードする。読込失敗時は従来の仮ヒット音へフォールバックする。
