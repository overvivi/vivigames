# ガード吸収エフェクト・発光粒子 v1

- 内蔵image_genで新規生成。小さな青白い光の本体・尾・ゲージ到着の発光に同じ1枚を使用。
- 元画像: `C:/Users/vivin/.codex/generated_images/01a060c8-6d9d-7212-aa0c-8f5a27228dc8/exec-5d1357b4-dae4-4459-93b0-d1497ff2756f.png`
- 原本: 同フォルダ`guard-charge-orb-v1.png`。256px/quality95 WebPを`public/assets/championship-re/battle/effects/guard-charge-orb-v1.webp`へ保存。
- 黒背景をADDで重ねる方式。透過PNGではなく、黒を加算時に消す既存VFXと同じ方式。原本は保持。
- ガード成功・実ゲージ増加時のみ、260msで発生→480msの曲線移動→新しい宝石の点灯・共通チャージSE。1粒＋残像4粒。盾破砕や盾自体の加工はなし。

## Prompt (built-in image_gen)

Use case: stylized-concept. Asset type: single small fantasy fighting-game VFX particle sprite. Create one centered blue-white magical energy mote: compact brilliant white core, rich icy cyan inner halo, delicate wispy blue radiance, a subtle tiny four-point glint, soft circular falloff fading completely to PURE BLACK well before all edges. 1024x1024 square. The whole glow occupies central 65% with generous pure black margins. Meant for additive blending at 30-90 pixels, so clear luminous center, no dark solid object. Background exactly solid RGB 0,0,0, not transparent, no checkerboard, no scene. Symmetrical, no directional trail (trail animated separately), no rings, no text, no border, no shield, no characters, no extra motes or scattered stars. Premium restrained magical glow matching dark gothic fantasy UI.
