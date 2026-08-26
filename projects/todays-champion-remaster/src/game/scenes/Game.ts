import { Container, GameObjects, Math as PhaserMath, Scene } from 'phaser';

type DuelState = 'idle' | 'countdown' | 'reaction' | 'settling' | 'result';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const LAMP_OFF = 0x17202b;
const LAMP_COLORS = [0xff4e5f, 0xffc84f, 0x5fffd0];

export class Game extends Scene {
    private state: DuelState = 'idle';
    private lamps: GameObjects.Arc[] = [];
    private lampGlows: GameObjects.Arc[] = [];
    private promptText!: GameObjects.Text;
    private statusText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private raven!: Container;
    private mika!: Container;
    private reactionStartedAt = 0;
    private lastActionAt = -Infinity;
    private resultLayer?: Container;
    private flash!: GameObjects.Rectangle;

    constructor() {
        super('Game');
    }

    create() {
        this.createArena();
        this.createFighters();
        this.createSignal();
        this.createHud();
        this.resetDuel();
        this.input.on('pointerdown', () => this.handleAction());
        this.input.keyboard?.on('keydown-SPACE', () => this.handleAction());
    }

    private createArena() {
        this.cameras.main.setBackgroundColor(0x070b12);
        this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x0d1420);
        this.add.rectangle(VIEW_WIDTH / 2, 80, VIEW_WIDTH, 2, 0x75f4ea, 0.28);
        this.add.rectangle(VIEW_WIDTH / 2, 625, VIEW_WIDTH, 2, 0x75f4ea, 0.26);
        this.add.rectangle(VIEW_WIDTH / 2, 527, VIEW_WIDTH, 150, 0x111c29);
        for (let index = 0; index < 44; index++) {
            this.add.rectangle(35 + ((index * 103) % 1210), 150 + ((index * 67) % 340), 2 + (index % 4), 18 + ((index * 19) % 64), index % 2 ? 0x4ed7ff : 0xf64ab9, 0.12);
        }
        for (let line = 0; line < 11; line++) {
            this.add.line(VIEW_WIDTH / 2, 550, 0, 0, VIEW_WIDTH, 0, 0x5d7a95, 0.14).setOrigin(0.5).setScale(1, 1 + line * 0.19);
        }
        this.add.text(640, 108, 'TODAY\'S CHAMPION  /  REMASTER', { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#7d93aa', letterSpacing: 5 }).setOrigin(0.5);
        this.add.text(640, 574, 'NEON DISTRICT  /  DUEL PLATFORM 07', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#5a7084', letterSpacing: 3 }).setOrigin(0.5);
        this.flash = this.add.rectangle(640, 360, VIEW_WIDTH, VIEW_HEIGHT, 0xffffff, 0).setDepth(30);
    }

    private createFighters() {
        this.raven = this.createFighter(314, 470, 'RAVEN', 'ZERO BLADE', 0x55dffc, -1);
        this.mika = this.createFighter(966, 470, 'MIKA', 'PINK RIOT', 0xff5ca8, 1);
    }

    private createFighter(x: number, y: number, name: string, subtitle: string, color: number, direction: -1 | 1) {
        const fighter = this.add.container(x, y);
        const glow = this.add.circle(0, 16, 98, color, 0.08);
        const shadow = this.add.ellipse(0, 101, 138, 22, 0x000000, 0.48);
        const legBack = this.add.rectangle(-direction * 20, 55, 27, 86, 0x131d29).setOrigin(0.5);
        const legFront = this.add.rectangle(direction * 22, 55, 30, 94, 0x202e3d).setOrigin(0.5);
        const body = this.add.rectangle(0, -10, 92, 132, 0x162332).setStrokeStyle(3, color, 0.76).setOrigin(0.5);
        const shoulder = this.add.rectangle(direction * 38, -34, 38, 86, 0x20394c).setAngle(direction * 16).setOrigin(0.5);
        const arm = this.add.rectangle(direction * 62, 11, 25, 98, 0x182532).setAngle(direction * 25).setOrigin(0.5);
        const head = this.add.circle(-direction * 7, -102, 39, 0x223244).setStrokeStyle(3, color, 0.86);
        const visor = this.add.rectangle(-direction * 18, -106, 39, 10, color, 0.9).setOrigin(0.5);
        const weapon = this.add.rectangle(direction * 79, 43, 8, 175, color, 0.76).setAngle(direction * 33).setOrigin(0.5);
        const nameText = this.add.text(0, 132, name, { fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: `#${color.toString(16).padStart(6, '0')}`, letterSpacing: 3 }).setOrigin(0.5);
        const subtitleText = this.add.text(0, 161, subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#9aa9b7', letterSpacing: 2 }).setOrigin(0.5);
        fighter.add([glow, shadow, legBack, legFront, body, shoulder, arm, head, visor, weapon, nameText, subtitleText]);
        this.tweens.add({ targets: fighter, y: y - 8, duration: 1250, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: direction === 1 ? 140 : 0 });
        return fighter;
    }

    private createSignal() {
        this.add.rectangle(640, 206, 410, 130, 0x0b1018, 0.96).setStrokeStyle(3, 0x496174, 1);
        this.add.rectangle(640, 270, 370, 5, 0x2d4958, 0.9);
        [530, 640, 750].forEach((x, index) => {
            this.add.circle(x, 205, 51, 0x000000, 0.56);
            this.lampGlows.push(this.add.circle(x, 205, 68, LAMP_COLORS[index], 0));
            const lamp = this.add.circle(x, 205, 42, LAMP_OFF, 1).setStrokeStyle(3, 0x4e6070, 1);
            this.lamps.push(lamp);
            this.add.text(x, 288, ['01', '02', '03'][index], { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#6f8495', letterSpacing: 2 }).setOrigin(0.5);
        });
    }

    private createHud() {
        this.promptText = this.add.text(640, 334, '', { fontFamily: 'Arial, sans-serif', fontSize: '31px', fontStyle: 'bold', color: '#eff8ff', letterSpacing: 3, align: 'center' }).setOrigin(0.5);
        this.statusText = this.add.text(640, 370, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#9eb3c6', letterSpacing: 1, align: 'center' }).setOrigin(0.5);
        this.scoreText = this.add.text(640, 468, '', { fontFamily: 'Arial, sans-serif', fontSize: '64px', fontStyle: 'bold', color: '#fff2a6', stroke: '#5a4522', strokeThickness: 8 }).setOrigin(0.5).setVisible(false);
    }

    private resetDuel() {
        this.state = 'idle';
        this.lastActionAt = -Infinity;
        this.resultLayer?.destroy();
        this.resultLayer = undefined;
        this.tweens.killTweensOf(this.cameras.main);
        this.cameras.main.setZoom(1);
        this.raven.setPosition(314, 470).setScale(1).setAlpha(1);
        this.mika.setPosition(966, 470).setScale(1).setAlpha(1);
        this.scoreText.setVisible(false);
        this.setSignal(-1);
        this.promptText.setText('CLICK OR SPACE TO START');
        this.statusText.setText('赤を待て。緑に変わった瞬間、最速で踏み込め。');
    }

    private handleAction() {
        const now = this.time.now;
        // タップとSpaceの重なり、または連打が演出途中の状態を飛び越えないよう短く受け付けを止める。
        if (now - this.lastActionAt < 160 || this.state === 'settling') return;
        this.lastActionAt = now;
        if (this.state === 'idle' || this.state === 'result') {
            this.resetDuel();
            this.startCountdown();
            return;
        }
        if (this.state === 'countdown') {
            this.finishDuel(undefined, true);
            return;
        }
        if (this.state === 'reaction') this.finishDuel(Math.round(this.time.now - this.reactionStartedAt), false);
    }

    private startCountdown() {
        this.state = 'countdown';
        this.promptText.setText('READY');
        this.statusText.setText('信号が緑に変わるまで、待機。');
        this.setSignal(0);
        this.cameras.main.zoomTo(1.025, 260, 'Sine.easeOut');
        this.time.delayedCall(700, () => {
            if (this.state !== 'countdown') return;
            this.setSignal(1);
            this.promptText.setText('STEADY');
        });
        // 同じ拍子を覚えられないよう、最後の待機だけを毎回ずらす。
        this.time.delayedCall(1450 + PhaserMath.Between(400, 1600), () => {
            if (this.state !== 'countdown') return;
            this.state = 'reaction';
            this.reactionStartedAt = this.time.now;
            this.setSignal(2);
            this.promptText.setText('GO!');
            this.statusText.setText('CLICK / SPACE');
            this.flashArena(0x8dfff0, 0.38, 140);
            this.cameras.main.shake(110, 0.006);
        });
    }

    private setSignal(activeIndex: number) {
        this.lamps.forEach((lamp, index) => {
            const active = index === activeIndex;
            const glow = this.lampGlows[index];
            lamp.setFillStyle(active ? LAMP_COLORS[index] : LAMP_OFF, active ? 1 : 0.96);
            lamp.setStrokeStyle(active ? 4 : 3, active ? 0xffffff : 0x4e6070, active ? 0.75 : 1);
            this.tweens.killTweensOf(lamp);
            this.tweens.killTweensOf(glow);
            if (active) {
                lamp.setScale(1.04);
                glow.setFillStyle(LAMP_COLORS[index], 0.26).setScale(1);
                this.tweens.add({ targets: [lamp, glow], scale: 1.14, duration: 180, ease: 'Sine.easeOut', yoyo: true });
                this.tweens.add({ targets: glow, alpha: 0.05, duration: 430, ease: 'Sine.easeOut' });
            } else {
                lamp.setScale(1);
                glow.setAlpha(0).setScale(1);
            }
        });
    }

    private finishDuel(playerMs: number | undefined, falseStart: boolean) {
        this.state = 'settling';
        this.setSignal(falseStart ? 0 : 2);
        this.scoreText.setVisible(true);
        const npcMs = PhaserMath.Between(135, 230);
        const playerWins = !falseStart && playerMs !== undefined && playerMs < npcMs;
        this.scoreText.setText(falseStart ? 'FLYING' : `${playerMs}ms`);
        this.scoreText.setColor(falseStart ? '#ff6475' : playerWins ? '#8dfff0' : '#ffcc69');
        this.promptText.setText(playerWins ? 'RAVEN WINS' : 'MIKA WINS');
        this.statusText.setText(falseStart ? 'フライング。緑になってから踏み込め。' : playerWins ? `MIKA  ${npcMs}ms  /  記録更新圏内` : `MIKA  ${npcMs}ms  /  もう一度、反応を研ぎ澄ませ`);
        const winner = playerWins ? this.raven : this.mika;
        const winnerColor = playerWins ? 0x55dffc : 0xff5ca8;
        if (falseStart) {
            this.flashArena(0xff405b, 0.3, 190);
        } else {
            this.flashArena(winnerColor, 0.28, 100);
            this.createDashTrail(winner, winnerColor, playerWins ? 1 : -1);
            this.tweens.add({ targets: winner, x: winner.x + (playerWins ? 150 : -150), duration: 190, ease: 'Quad.easeOut' });
        }
        this.tweens.add({ targets: this.scoreText, scale: 1.14, duration: 120, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
        this.cameras.main.zoomTo(falseStart ? 1.035 : 1.09, 100, 'Quad.easeOut');
        this.cameras.main.shake(210, falseStart ? 0.006 : 0.012);
        this.time.delayedCall(620, () => this.showResult(playerWins, falseStart));
    }

    private flashArena(color: number, alpha: number, duration: number) {
        this.tweens.killTweensOf(this.flash);
        this.flash.setFillStyle(color, alpha);
        this.tweens.add({ targets: this.flash, alpha: 0, duration, ease: 'Sine.easeOut' });
    }

    private createDashTrail(fighter: Container, color: number, direction: -1 | 1) {
        for (let index = 0; index < 4; index++) {
            const trail = this.add.rectangle(fighter.x - direction * (20 + index * 34), fighter.y - 10, 86 - index * 10, 128 - index * 14, color, 0.22 - index * 0.035).setDepth(4);
            this.tweens.add({
                targets: trail,
                x: trail.x - direction * 80,
                alpha: 0,
                scaleY: 0.74,
                duration: 260 + index * 45,
                ease: 'Quad.easeOut',
                onComplete: () => trail.destroy()
            });
        }
    }

    private showResult(playerWins: boolean, falseStart: boolean) {
        this.state = 'result';
        const shade = this.add.rectangle(640, 360, VIEW_WIDTH, VIEW_HEIGHT, 0x04070c, 0.66);
        const panel = this.add.rectangle(640, 560, 490, 96, 0x101925, 0.96).setStrokeStyle(2, playerWins ? 0x65ffe2 : 0xffc15c, 0.9);
        const text = this.add.text(640, 540, falseStart ? 'CLICK / SPACE  TO RETRY' : playerWins ? 'CLICK / SPACE  TO CLAIM THE TITLE' : 'CLICK / SPACE  TO REMATCH', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#edf5fb', letterSpacing: 2 }).setOrigin(0.5);
        const detail = this.add.text(640, 575, playerWins ? 'NEXT: CHAMPION ENTRY' : 'NEXT: INSTANT REMATCH', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#94a9ba', letterSpacing: 2 }).setOrigin(0.5);
        this.resultLayer = this.add.container(0, 44, [shade, panel, text, detail]);
        this.resultLayer.setDepth(20).setAlpha(0);
        this.tweens.add({ targets: this.resultLayer, y: 0, alpha: 1, duration: 220, ease: 'Quad.easeOut' });
        this.cameras.main.zoomTo(1, 360, 'Sine.easeOut');
    }
}
