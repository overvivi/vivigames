# ULTIMATE button v1

- Built-in image_gen（imagegenスキル）で既存ATTACKボタンを編集。
- 入力: `public/assets/championship-re/battle/battle-action-attack-v1.webp`
- 最終素材: `public/assets/championship-re/battle/battle-action-ultimate-v1.webp`
- 原本: `C:/Users/vivin/.codex/generated_images/01a060c8-6d9d-7212-aa0c-8f5a27228dc8/exec-50d967dc-b173-4bca-83e3-80157582d5a8.png`
- 1254×1254、真のalphaを確認。WebP quality92/alphaQuality100へ符号化、絵の加工なし。
- 旧スワイプ矢印／READYリングはコードから撤去、旧素材ファイルは保持。

## 生成プロンプト

Use case: precise-object-edit. Asset type: transparent fantasy fighting-game button sprite. Image 1 is the edit target: the existing ATTACK button. Create its powered-up ULTIMATE variant. Preserve the same square silhouette, dark engraved metal and gold ornamental frame, pointed corner gems, central banner position and diagonal slash motif. Replace red energy and gems with a vivid luminous rainbow gradient flowing red/orange/gold/green/cyan/blue/violet, rich prismatic magical energy, not pastel. Replace ATTACK text with exactly "ULTIMATE" (U L T I M A T E), in the same large metallic embossed serif lettering, high contrast and easily readable at 115px button size, fit inside the central banner. Front-on view, single button, centered, no perspective tilt, full outer frame visible with minimal transparent margins. Genuine transparent alpha outside the ornamental silhouette, no black rectangle, no checkerboard drawn into image. No swipe arrow, no hand, no extra text, no surrounding effects extending outside the frame. Keep the original grimdark premium game UI style.

## 透過修正プロンプト

Use case: background-extraction. Edit only the OUTSIDE background of this ULTIMATE button. Remove all white and gray checkerboard pixels outside the silhouette and return a genuine transparent RGBA PNG with actual alpha=0 outside. Do NOT draw checkerboard to represent transparency. Preserve the entire rainbow button and the exact ULTIMATE lettering, all dark metal, gold points, gems and inner details unchanged. Full button without clipped edges. This is a production transparent UI sprite; actual alpha channel is required, not RGB with a simulated transparency pattern.
