// 背景画像だけは外部ファイルのままにする。
// ゲーム本体は単一HTMLへ畳んで games/ へ置くが、この絵をbase64で埋めると
// HTMLが1MB以上太るため、置き場の他のゲームと同じく images/ に置く
// （AGENTS.md「ゲームは単一HTMLで完結させる（背景画像だけが例外）」）。
//   開発サーバー: public/bg.webp
//   書き出し後  : games/immune-defense.html から見た ../images/...
export const BG_URL = import.meta.env.PROD ? '../images/immune-defense/bg.webp' : './bg.webp';
