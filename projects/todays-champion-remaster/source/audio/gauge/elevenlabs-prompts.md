# 必殺ゲージSE：ElevenLabs制作

2026-09-07。ユーザーが指定URLをElevenLabsへ訂正したため、以後はこちらを正規候補とする。
ローカルのv1（BGM加工）／v2（独自シンセ）は採用対象外。
ユーザーの訂正で、1個目用#2を1個目・MAX両方へ共用する。`public/assets/championship-re/audio/gauge-charge-v1.mp3`を両段階・同音量で再生。保存済み`gauge-max-v1.mp3`は旧候補として保持し、ロード／再生しない。

履歴：https://elevenlabs.io/app/sound-effects/history
共通：ループOFF、プロンプト影響度100%、自動改善OFF。各4候補。

## 1個目：0.5秒

短くシンプルなエネルギー獲得音。生成画面表示20クレジット。

> One short energy charge gained sound for a dark fantasy fighting game. A compact magical electronic PWING: quick upward pitch sweep settling into a clear platinum crystal ping with a tiny warm power pulse. Simple, clean, satisfying partial-charge cue, immediate onset, fast decay within 0.4 seconds. One isolated sound. No repeated notes, no melody, no voices, no ambience, no explosion.

## 2個目・MAX：0.8秒

即座に一発で鳴る派手な魔力解放音。二音連続にしない。生成画面表示32クレジット。

> One short magical energy meter FULL sound for a dark fantasy fighting game. A single brilliant SHAAANG: sharp platinum crystal shimmer, thick electronic power pulse and airy sparkle striking together. Immediate, punchy, triumphant energy-charged notification, 0.8 seconds with a fast clean decay. ONE burst, no introductory ping, no repeated notes, no melody, no voices, no music, no long buildup.

長い初回プロンプトではサイトがエラーを返した。再読み込み後も同様で、上記の短い文面へ変更するとMAX生成が成功。再試行時は成功済み履歴を確認してから進めること。
