import { AUTO, Game, Scale, Types } from 'phaser';
import { Game as MainGame } from './scenes/Game';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1280,
    height: 720,
    parent: 'game-container',
    backgroundColor: '#070b12',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [MainGame]
};

const startGame = (parent: string) => new Game({ ...config, parent });

export default startGame;
