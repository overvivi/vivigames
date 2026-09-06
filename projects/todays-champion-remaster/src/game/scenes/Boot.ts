import { Scene } from 'phaser';

// タイトル素材を読む間も黒画面にしない。重い対戦素材はCPUを押すまで読み込まない。
export class Boot extends Scene {
    constructor() { super('Boot'); }

    preload() {
        // 先に分割・フェード済みの音を読み、ループ境界を描画フレームに依存させない。
        this.load.audio('bgm-menu', 'assets/championship-re/audio/bgm-menu-v1.mp3');
        this.load.audio('bgm-battle', 'assets/championship-re/audio/bgm-battle-v1.mp3');
        this.load.audio('battle-audio-gauge-charge', 'assets/championship-re/audio/gauge-charge-v1.mp3');
        this.load.image('battle-guard-charge-orb', 'assets/championship-re/battle/effects/guard-charge-orb-v1.webp');
        this.load.image('battle-guard-shatter', 'assets/championship-re/battle/effects/guard-shatter-v1.webp');
        this.load.image('championship-re-title', 'assets/championship-re/ui/championship-re-title-final-v3.webp');
        this.load.image('title-orb-seven-fighters', 'assets/championship-re/title/title-orb-seven-fighters-v1.webp');
        this.load.image('title-cpu-battle', 'assets/championship-re/title/title-cpu-battle-v1.webp');
        this.load.image('title-friend-battle', 'assets/championship-re/title/title-friend-battle-v1.webp');
        this.load.image('title-online-battle', 'assets/championship-re/title/title-online-battle-v1.webp');
    }

    create() {
        document.getElementById('boot-overlay')?.remove();
        this.scene.start('Game');
    }
}
