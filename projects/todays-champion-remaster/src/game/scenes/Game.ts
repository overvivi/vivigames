import { GameObjects, Math as PhaserMath, Scene } from 'phaser';

type DuelState = 'select' | 'idle' | 'countdown' | 'reaction' | 'settling' | 'result';

type FighterDefinition = {
    id: string;
    name: string;
    subtitle: string;
    color: number;
    portraitKey: string;
    combatKey: string;
    combatScale: number;
};

type FighterPose = 'guard' | 'dash' | 'attack' | 'win' | 'lose';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const LAMP_OFF = 0x17202b;
const LAMP_COLORS = [0xff4e5f, 0xffc84f, 0x5fffd0];
const FIGHTERS: FighterDefinition[] = [
    { id: 'raven', name: 'RAVEN', subtitle: 'ZERO BLADE', color: 0x55dffc, portraitKey: 'portrait-raven', combatKey: 'guard-raven', combatScale: 0.42 },
    { id: 'mika', name: 'MIKA', subtitle: 'PINK RIOT', color: 0xff5ca8, portraitKey: 'portrait-mika', combatKey: 'guard-mika', combatScale: 0.42 },
    { id: 'brick', name: 'BRICK', subtitle: 'IRON FIST', color: 0xffb14f, portraitKey: 'portrait-brick', combatKey: 'guard-brick', combatScale: 0.42 },
    { id: 'noise', name: 'NOISE', subtitle: 'BEAT BREAKER', color: 0xa776ff, portraitKey: 'portrait-noise', combatKey: 'guard-noise', combatScale: 0.42 },
    { id: 'kiri', name: 'KIRI', subtitle: 'GHOST SIGNAL', color: 0xb1c4f6, portraitKey: 'portrait-kiri', combatKey: 'guard-kiri', combatScale: 0.42 },
    { id: 'vivi', name: 'VIVI', subtitle: 'TWO-FACED', color: 0xe8f2ff, portraitKey: 'portrait-vivi', combatKey: 'guard-vivi', combatScale: 0.19 },
    { id: 'tomega9', name: 'TΩ9', subtitle: 'DESTROYER', color: 0xff534c, portraitKey: 'portrait-tomega9', combatKey: 'guard-tomega9', combatScale: 0.19 }
];

export class Game extends Scene {
    private state: DuelState = 'idle';
    private lamps: GameObjects.Arc[] = [];
    private lampGlows: GameObjects.Arc[] = [];
    private promptText!: GameObjects.Text;
    private statusText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private raven!: GameObjects.Container;
    private mika!: GameObjects.Container;
    private selectedFighter = FIGHTERS[0];
    private playerFighter = FIGHTERS[0];
    private npcFighter = FIGHTERS[1];
    private selectTitle?: GameObjects.Text;
    private selectionLayer?: GameObjects.Container;
    private selectionFrames = new Map<string, GameObjects.Rectangle>();
    private reactionStartedAt = 0;
    private lastActionAt = -Infinity;
    private resultLayer?: GameObjects.Container;
    private flash!: GameObjects.Rectangle;

    constructor() {
        super('Game');
    }

    preload() {
        FIGHTERS.forEach((fighter) => {
            if (fighter.id === 'vivi' || fighter.id === 'tomega9') {
                this.load.image(fighter.portraitKey, `assets/fighters/portraits/${fighter.id}-select-v2.png`);
                this.load.image(fighter.combatKey, `assets/fighters/${fighter.id}-select-v1.png`);
                return;
            }
            this.load.image(fighter.portraitKey, `assets/fighters/portraits/${fighter.id}.webp`);
            this.load.image(fighter.combatKey, `assets/fighters/guard/${fighter.id}.webp`);
        });
    }

    create() {
        this.createArena();
        this.createFighters();
        this.createSignal();
        this.createHud();
        this.showFighterSelect();
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
        this.raven = this.createFighter(314, 470, this.playerFighter, -1);
        this.mika = this.createFighter(966, 470, this.npcFighter, 1);
    }

    private createFighter(x: number, y: number, fighterData: FighterDefinition, direction: -1 | 1) {
        const fighter = this.add.container(x, y);
        const glow = this.add.circle(0, 16, 104, fighterData.color, 0.1);
        const shadow = this.add.ellipse(0, 101, 138, 22, 0x000000, 0.48);
        const art = this.add.image(0, 82, fighterData.combatKey).setOrigin(0.5, 1).setScale(fighterData.combatScale).setFlipX(direction === 1);
        const nameText = this.add.text(0, 132, fighterData.name, { fontFamily: 'Arial, sans-serif', fontSize: '28px', fontStyle: 'bold', color: `#${fighterData.color.toString(16).padStart(6, '0')}`, letterSpacing: 3 }).setOrigin(0.5);
        const subtitleText = this.add.text(0, 161, fighterData.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#9aa9b7', letterSpacing: 2 }).setOrigin(0.5);
        fighter.add([glow, shadow, art, nameText, subtitleText]);
        fighter.setData('art', art);
        fighter.setData('definition', fighterData);
        fighter.setData('direction', direction);
        this.tweens.add({ targets: fighter, y: y - 8, duration: 1250, ease: 'Sine.easeInOut', yoyo: true, repeat: -1, delay: direction === 1 ? 140 : 0 });
        return fighter;
    }

    private showFighterSelect() {
        this.state = 'select';
        this.raven.setVisible(false);
        this.mika.setVisible(false);
        this.promptText.setVisible(false);
        this.statusText.setVisible(false);
        this.scoreText.setVisible(false);
        this.setSignal(-1);

        const layer = this.add.container().setDepth(100);
        const shade = this.add.rectangle(640, 360, VIEW_WIDTH, VIEW_HEIGHT, 0x050912, 0.94);
        const eyebrow = this.add.text(640, 54, 'TODAY\'S CHAMPION  /  REMASTER', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#8ea7bd', letterSpacing: 4 }).setOrigin(0.5);
        const title = this.add.text(640, 88, 'FIGHTER SELECT', { fontFamily: 'Arial, sans-serif', fontSize: '34px', fontStyle: 'bold', color: '#eff8ff', letterSpacing: 6 }).setOrigin(0.5);
        this.selectTitle = this.add.text(640, 122, '', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#f4d45e', letterSpacing: 3 }).setOrigin(0.5);
        layer.add([shade, eyebrow, title, this.selectTitle]);
        this.selectionLayer = layer;
        this.selectionFrames.clear();

        FIGHTERS.forEach((fighter, index) => this.createSelectionCard(fighter, index));
        this.selectFighter(this.selectedFighter);

        const startFrame = this.add.rectangle(640, 668, 360, 48, 0x121c2b, 0.98).setStrokeStyle(2, 0xf5d24b, 1).setInteractive({ useHandCursor: true });
        const startText = this.add.text(640, 668, 'START DUEL', { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#f9dd67', letterSpacing: 3 }).setOrigin(0.5);
        startFrame.on('pointerdown', () => this.startSelectedDuel());
        startFrame.on('pointerover', () => startFrame.setFillStyle(0x26344b));
        startFrame.on('pointerout', () => startFrame.setFillStyle(0x121c2b));
        layer.add([startFrame, startText]);
    }

    private createSelectionCard(fighter: FighterDefinition, index: number) {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = 210 + column * 285 + (row === 1 ? 142 : 0);
        const y = row === 0 ? 278 : 500;
        const frame = this.add.rectangle(x, y, 228, 192, 0x101927, 0.96).setStrokeStyle(2, 0x476074, 1).setInteractive({ useHandCursor: true });
        const portrait = this.add.image(x, y - 28, fighter.portraitKey).setDisplaySize(212, 148);
        const name = this.add.text(x, y + 63, fighter.name, { fontFamily: 'Arial, sans-serif', fontSize: '19px', fontStyle: 'bold', color: '#eaf4ff', letterSpacing: 2 }).setOrigin(0.5);
        const subtitle = this.add.text(x, y + 86, fighter.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#9eb3c6', letterSpacing: 1 }).setOrigin(0.5);
        frame.on('pointerdown', () => this.selectFighter(fighter));
        frame.on('pointerover', () => {
            if (fighter !== this.selectedFighter) frame.setFillStyle(0x17253a);
        });
        frame.on('pointerout', () => {
            if (fighter !== this.selectedFighter) frame.setFillStyle(0x101927);
        });
        this.selectionLayer?.add([frame, portrait, name, subtitle]);
        this.selectionFrames.set(fighter.id, frame);
    }

    private selectFighter(fighter: FighterDefinition) {
        this.selectedFighter = fighter;
        this.selectTitle?.setText(`${fighter.name}  /  ${fighter.subtitle}`);
        this.selectionFrames.forEach((frame, id) => {
            const selected = id === fighter.id;
            frame.setFillStyle(selected ? 0x23354b : 0x101927);
            frame.setStrokeStyle(selected ? 3 : 2, selected ? fighter.color : 0x476074, selected ? 1 : 0.9);
        });
    }

    private startSelectedDuel() {
        if (this.state !== 'select') return;
        this.playerFighter = this.selectedFighter;
        this.npcFighter = FIGHTERS.find((fighter) => fighter.id !== this.playerFighter.id && fighter.id === 'mika') ?? FIGHTERS[0];
        const fighters = [this.playerFighter, this.npcFighter];
        if (fighters.some((fighter) => this.needsMotionLoad(fighter))) {
            this.state = 'settling';
            this.selectTitle?.setText(`PREPARING ${this.playerFighter.name}`);
            this.loadFighterMotions(fighters, () => this.beginSelectedDuel());
            return;
        }
        this.beginSelectedDuel();
    }

    private beginSelectedDuel() {
        this.tweens.killTweensOf(this.raven);
        this.tweens.killTweensOf(this.mika);
        this.raven.destroy();
        this.mika.destroy();
        this.createFighters();
        this.selectionLayer?.destroy();
        this.selectionLayer = undefined;
        this.promptText.setVisible(true);
        this.statusText.setVisible(true);
        this.raven.setVisible(true);
        this.mika.setVisible(true);
        this.resetDuel();
        this.startCountdown();
        // START DUELを押した同じタップをフライング判定へ流さない。
        this.lastActionAt = this.time.now;
    }

    private motionKey(fighter: FighterDefinition, pose: Exclude<FighterPose, 'guard'>) {
        return `motion-${fighter.id}-${pose}`;
    }

    private hasMotion(fighter: FighterDefinition) {
        return fighter.id === 'vivi' || fighter.id === 'tomega9';
    }

    private needsMotionLoad(fighter: FighterDefinition) {
        return this.hasMotion(fighter) && !this.textures.exists(this.motionKey(fighter, 'attack'));
    }

    private loadFighterMotions(fighters: FighterDefinition[], onComplete: () => void) {
        const toLoad = fighters.filter((fighter, index) => this.hasMotion(fighter) && fighters.findIndex((other) => other.id === fighter.id) === index && this.needsMotionLoad(fighter));
        if (!toLoad.length) {
            onComplete();
            return;
        }
        toLoad.forEach((fighter) => {
            (['dash', 'attack', 'win', 'lose'] as const).forEach((pose) => {
                this.load.image(this.motionKey(fighter, pose), `assets/fighters/motions/${fighter.id}-${pose}-v1.png`);
            });
        });
        this.load.once(Phaser.Loader.Events.COMPLETE, onComplete);
        this.load.start();
    }

    private setFighterPose(fighter: GameObjects.Container, pose: FighterPose) {
        const art = fighter.getData('art') as GameObjects.Image;
        const definition = fighter.getData('definition') as FighterDefinition;
        const direction = fighter.getData('direction') as -1 | 1;
        const texture = pose === 'guard' || !this.hasMotion(definition)
            ? definition.combatKey
            : this.motionKey(definition, pose);
        art.setTexture(texture).setScale(definition.combatScale).setFlipX(direction === 1);
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
        this.setFighterPose(this.raven, 'guard');
        this.setFighterPose(this.mika, 'guard');
        this.scoreText.setVisible(false);
        this.setSignal(-1);
        this.promptText.setText('CLICK OR SPACE TO START');
        this.statusText.setText('赤を待て。緑に変わった瞬間、最速で踏み込め。');
    }

    private handleAction() {
        const now = this.time.now;
        // タップとSpaceの重なり、または連打が演出途中の状態を飛び越えないよう短く受け付けを止める。
        if (now - this.lastActionAt < 160 || this.state === 'settling' || this.state === 'select') return;
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
            this.setFighterPose(this.raven, 'dash');
            this.setFighterPose(this.mika, 'dash');
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
        this.promptText.setText(playerWins ? `${this.playerFighter.name} WINS` : `${this.npcFighter.name} WINS`);
        this.statusText.setText(falseStart ? 'フライング。緑になってから踏み込め。' : playerWins ? `${this.npcFighter.name}  ${npcMs}ms  /  記録更新圏内` : `${this.npcFighter.name}  ${npcMs}ms  /  もう一度、反応を研ぎ澄ませ`);
        const winner = playerWins ? this.raven : this.mika;
        const loser = playerWins ? this.mika : this.raven;
        const winnerColor = playerWins ? this.playerFighter.color : this.npcFighter.color;
        this.setFighterPose(this.raven, 'attack');
        this.setFighterPose(this.mika, 'attack');
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
        this.time.delayedCall(170, () => {
            if (this.state !== 'settling') return;
            this.setFighterPose(winner, 'win');
            this.setFighterPose(loser, 'lose');
        });
        this.time.delayedCall(620, () => this.showResult(playerWins, falseStart));
    }

    private flashArena(color: number, alpha: number, duration: number) {
        this.tweens.killTweensOf(this.flash);
        this.flash.setFillStyle(color, alpha);
        this.tweens.add({ targets: this.flash, alpha: 0, duration, ease: 'Sine.easeOut' });
    }

    private createDashTrail(fighter: GameObjects.Container, color: number, direction: -1 | 1) {
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
