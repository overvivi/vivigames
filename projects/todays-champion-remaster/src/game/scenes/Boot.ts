import { Scene } from 'phaser';

// タイトル素材を読む間も黒画面にしない。重い対戦素材はCPUを押すまで読み込まない。
export class Boot extends Scene {
    constructor() { super('Boot'); }

    preload() {
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
