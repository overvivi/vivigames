import { Scene } from 'phaser';

// タイトル素材を読む間も黒画面にしない。重い対戦素材はCPUを押すまで読み込まない。
export class Boot extends Scene {
    constructor() { super('Boot'); }

    create() {
        this.cameras.main.setBackgroundColor(0x070b12);
        const label = this.add.text(470, 836, 'SUMMONING RIFT', { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#fff2bd', letterSpacing: 4 }).setOrigin(0.5);
        const bar = this.add.rectangle(470, 890, 360, 5, 0x2a394a, 1);
        const fill = this.add.rectangle(290, 890, 0, 5, 0x87dfff, 1).setOrigin(0, 0.5);
        const assets = [
            ['championship-re-title', 'assets/championship-re/ui/championship-re-title-final-v3.webp'],
            ['title-orb-seven-fighters', 'assets/championship-re/title/title-orb-seven-fighters-v1.webp'],
            ['title-cpu-battle', 'assets/championship-re/title/title-cpu-battle-v1.webp'],
            ['title-friend-battle', 'assets/championship-re/title/title-friend-battle-v1.webp'],
            ['title-online-battle', 'assets/championship-re/title/title-online-battle-v1.webp']
        ];
        assets.forEach(([key, path]) => this.load.image(key, path));
        this.load.on('progress', (value: number) => fill.setDisplaySize(360 * value, 5));
        this.load.once('loaderror', () => label.setText('RETRYING CONNECTION'));
        this.load.once('complete', () => this.scene.start('Game'));
        this.load.start();
        bar.setDepth(1);
    }
}
