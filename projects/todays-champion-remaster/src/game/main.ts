import { AUTO, Game, Scale, Types } from 'phaser';
import { Game as MainGame } from './scenes/Game';

const config: Types.Core.GameConfig = {
    type: AUTO,
    // スマホの縦持ちを基準にし、PCは黒い余白を残して同じ画面を見せる。
    width: 941,
    height: 1672,
    parent: 'game-container',
    backgroundColor: '#070b12',
    scale: {
        // 縦持ちは余白を作らず没入感を優先し、PCでは全体を見せるため切り抜かない。
        mode: window.innerHeight > window.innerWidth ? Scale.ENVELOP : Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [MainGame]
};

const startGame = (parent: string) => new Game({ ...config, parent });

export default startGame;
