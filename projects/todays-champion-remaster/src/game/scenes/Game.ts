import { GameObjects, Math as PhaserMath, Scene } from 'phaser';

type DuelState = 'select' | 'preview' | 'idle' | 'countdown' | 'reaction' | 'settling' | 'result';

type AttackEffectDefinition = {
    scale: number;
    offsetX: number;
    offsetY: number;
    layer: 'behind' | 'front';
};

type FighterDefinition = {
    id: string;
    name: string;
    subtitle: string;
    color: number;
    portraitKey: string;
    combatKey: string;
    combatScale: number;
    naturalFacing: 'left' | 'right';
    poseFacing?: Partial<Record<FighterPose, 'left' | 'right'>>;
    poseScales?: Partial<Record<FighterPose, number>>;
    poseOffsetXs?: Partial<Record<FighterPose, number>>;
    poseOffsetYs?: Partial<Record<FighterPose, number>>;
    attackEffect?: AttackEffectDefinition;
};

type FighterPose = 'guard' | 'dash' | 'attack' | 'win' | 'lose';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const LAMP_OFF = 0x17202b;
const LAMP_COLORS = [0xff4e5f, 0xffc84f, 0x5fffd0];
const FIGHTERS: FighterDefinition[] = [
    { id: 'raven', name: 'RAVEN', subtitle: 'ZERO BLADE', color: 0x55dffc, portraitKey: 'portrait-raven', combatKey: 'guard-raven', combatScale: 0.42, naturalFacing: 'left', poseFacing: { attack: 'right' }, poseScales: { attack: 0.43 }, attackEffect: { scale: 0.20, offsetX: 116, offsetY: -45, layer: 'behind' } },
    { id: 'mika', name: 'MIKA', subtitle: 'PINK RIOT', color: 0xff5ca8, portraitKey: 'portrait-mika', combatKey: 'guard-mika', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right' }, poseScales: { attack: 0.43 }, attackEffect: { scale: 0.22, offsetX: 122, offsetY: -6, layer: 'front' } },
    { id: 'brick', name: 'BRICK', subtitle: 'IRON FIST', color: 0xffb14f, portraitKey: 'portrait-brick', combatKey: 'guard-brick', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right' }, poseScales: { attack: 0.43 }, attackEffect: { scale: 0.27, offsetX: 112, offsetY: -18, layer: 'behind' } },
    { id: 'noise', name: 'NOISE', subtitle: 'BEAT BREAKER', color: 0xa776ff, portraitKey: 'portrait-noise', combatKey: 'guard-noise', combatScale: 0.42, naturalFacing: 'left', poseFacing: { attack: 'right' }, poseScales: { attack: 0.45 }, attackEffect: { scale: 0.21, offsetX: 118, offsetY: -42, layer: 'behind' } },
    { id: 'kiri', name: 'KIRI', subtitle: 'GHOST SIGNAL', color: 0xb1c4f6, portraitKey: 'portrait-kiri', combatKey: 'guard-kiri', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right' }, poseScales: { attack: 0.63 }, poseOffsetYs: { attack: -18 }, attackEffect: { scale: 0.22, offsetX: 118, offsetY: -40, layer: 'behind' } },
    { id: 'vivi', name: 'VIVI', subtitle: 'TWO-FACED', color: 0xe8f2ff, portraitKey: 'portrait-vivi', combatKey: 'guard-vivi', combatScale: 0.19, naturalFacing: 'right', attackEffect: { scale: 0.25, offsetX: 116, offsetY: -48, layer: 'front' } },
    { id: 'tomega9', name: 'TΩ9', subtitle: 'DESTROYER', color: 0xff534c, portraitKey: 'portrait-tomega9', combatKey: 'guard-tomega9', combatScale: 0.19, naturalFacing: 'right', attackEffect: { scale: 0.39, offsetX: 108, offsetY: 54, layer: 'behind' } }
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
    private motionPreviewLayer?: GameObjects.Container;
    private motionPreviewEnabled = false;
    private debugEnabled = false;
    private debugLayer?: GameObjects.Container;
    private debugExpanded = true;
    private debugAsset: 'attack' | 'effect' = 'attack';
    private debugEffectPreview?: GameObjects.Image;
    private flash!: GameObjects.Rectangle;

    constructor() {
        super('Game');
    }

    preload() {
        FIGHTERS.forEach((fighter) => {
            if (fighter.id === 'vivi' || fighter.id === 'tomega9') {
                this.load.image(fighter.portraitKey, `assets/fighters/portraits/${fighter.id}-select-v2.png`);
                this.load.image(fighter.combatKey, `assets/fighters/guard/${fighter.id}-v3.png`);
                return;
            }
            this.load.image(fighter.portraitKey, `assets/fighters/portraits/${fighter.id}.webp`);
            this.load.image(fighter.combatKey, `assets/fighters/guard/${fighter.id}.webp`);
        });
    }

    create() {
        const params = new URLSearchParams(window.location.search);
        this.debugEnabled = params.has('debug');
        this.motionPreviewEnabled = params.has('motionPreview') || this.debugEnabled;
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
        fighter.setDepth(5);
        const glow = this.add.circle(0, 16, 104, fighterData.color, 0.1);
        const shadow = this.add.ellipse(0, 101, 138, 22, 0x000000, 0.48);
        const art = this.add.image(0, 82, fighterData.combatKey).setOrigin(0.5, 1).setScale(fighterData.combatScale).setFlipX(this.shouldFlip(fighterData, direction));
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
        if (this.motionPreviewEnabled && this.playerFighter.attackEffect !== undefined) {
            this.showMotionPreview();
            return;
        }
        this.startCountdown();
        // START DUELを押した同じタップをフライング判定へ流さない。
        this.lastActionAt = this.time.now;
    }

    private motionKey(fighter: FighterDefinition, pose: Exclude<FighterPose, 'guard'>) {
        return `motion-${fighter.id}-${pose}`;
    }

    private attackEffectKey(fighter: FighterDefinition) {
        return `effect-${fighter.id}-attack`;
    }

    private hasMotion(fighter: FighterDefinition) {
        return fighter.id === 'vivi' || fighter.id === 'tomega9';
    }

    private hasAttackMotion(_fighter: FighterDefinition) {
        // 現在の7人は全員に攻撃ポーズを用意する。既存5人は攻撃だけを遅延読込にする。
        return true;
    }

    private needsMotionLoad(fighter: FighterDefinition) {
        return (this.hasMotion(fighter) && !this.textures.exists(this.motionKey(fighter, 'dash')))
            || (this.hasAttackMotion(fighter) && !this.textures.exists(this.motionKey(fighter, 'attack')))
            || (fighter.attackEffect !== undefined && !this.textures.exists(this.attackEffectKey(fighter)));
    }

    private motionSourceVersion(fighter: FighterDefinition, pose: Exclude<FighterPose, 'guard'>) {
        // 初回生成の背景が残った素材を残し、透過を検査済みのv2だけをゲームに使う。
        if (fighter.id === 'vivi' && pose === 'win') return 'v3';
        if (fighter.id === 'tomega9' && (pose === 'attack' || pose === 'win')) return 'v3';
        return pose === 'lose' ? 'v1' : 'v2';
    }

    private loadFighterMotions(fighters: FighterDefinition[], onComplete: () => void) {
        const toLoad = fighters.filter((fighter, index) => fighters.findIndex((other) => other.id === fighter.id) === index && this.needsMotionLoad(fighter));
        if (!toLoad.length) {
            onComplete();
            return;
        }
        toLoad.forEach((fighter) => {
            if (this.hasMotion(fighter)) {
                (['dash', 'attack', 'win', 'lose'] as const).forEach((pose) => {
                    const key = this.motionKey(fighter, pose);
                    if (!this.textures.exists(key)) {
                        this.load.image(key, `assets/fighters/motions/${fighter.id}-${pose}-${this.motionSourceVersion(fighter, pose)}.png`);
                    }
                });
            } else if (this.hasAttackMotion(fighter) && !this.textures.exists(this.motionKey(fighter, 'attack'))) {
                this.load.image(this.motionKey(fighter, 'attack'), `assets/fighters/motions/${fighter.id}-attack.webp`);
            }
            if (fighter.attackEffect !== undefined && !this.textures.exists(this.attackEffectKey(fighter))) {
                this.load.image(this.attackEffectKey(fighter), `assets/fighters/effects/${fighter.id}-attack-v1.png`);
            }
        });
        // ESMビルドではグローバルのPhaser名前空間が無いため、文字列イベントで完了を受け取る。
        this.load.once('complete', onComplete);
        this.load.start();
    }

    private setFighterPose(fighter: GameObjects.Container, pose: FighterPose) {
        const art = fighter.getData('art') as GameObjects.Image;
        const definition = fighter.getData('definition') as FighterDefinition;
        const direction = fighter.getData('direction') as -1 | 1;
        const hasPoseMotion = this.hasMotion(definition) || (pose === 'attack' && this.hasAttackMotion(definition));
        const texture = pose === 'guard' || !hasPoseMotion
            ? definition.combatKey
            : this.motionKey(definition, pose);
        art.setTexture(texture).setScale(this.poseScale(definition, pose)).setX(this.poseOffsetX(definition, pose)).setY(82 + this.poseOffsetY(definition, pose)).setFlipX(this.shouldFlip(definition, direction, pose));
    }

    private shouldFlip(fighter: FighterDefinition, direction: -1 | 1, pose: FighterPose = 'guard') {
        // 素材ごとの素の向きを固定し、プレイヤー／NPCの配置が変わっても必ず中央を向ける。
        return this.shouldFlipNatural(fighter.poseFacing?.[pose] ?? fighter.naturalFacing, direction);
    }

    private shouldFlipNatural(naturalFacing: 'left' | 'right', direction: -1 | 1) {
        const desiredFacing = direction === -1 ? 'right' : 'left';
        return naturalFacing !== desiredFacing;
    }

    private poseScale(fighter: FighterDefinition, pose: FighterPose) {
        if (fighter.poseScales?.[pose] !== undefined) return fighter.poseScales[pose];
        if (fighter.id === 'tomega9') {
            // 横長と縦長で元の画像寸法が異なる。怪物らしい体格をどのポーズでも保つ。
            // WIN／LOSEの体格を基準に、横長の待機・ダッシュと縦長の攻撃を揃える。
            const monsterScale: Record<FighterPose, number> = { guard: 0.40, dash: 0.40, attack: 0.36, win: 0.36, lose: 0.32 };
            return monsterScale[pose];
        }
        return fighter.combatScale;
    }

    private poseOffsetY(fighter: FighterDefinition, pose: FighterPose) {
        if (fighter.poseOffsetYs?.[pose] !== undefined) return fighter.poseOffsetYs[pose];
        // 振り上げた腕で縦長になるTΩ9の攻撃だけ、頭の高さを待機・勝利へ合わせる。
        return fighter.id === 'tomega9' && pose === 'attack' ? 30 : 0;
    }

    private poseOffsetX(fighter: FighterDefinition, pose: FighterPose) {
        return fighter.poseOffsetXs?.[pose] ?? 0;
    }

    private showMotionPreview() {
        this.state = 'preview';
        this.setSignal(-1);
        this.promptText.setText('MOTION CHECK');
        this.statusText.setText(`${this.playerFighter.name} の攻撃エフェクトと表示を確認`);

        const layer = this.add.container().setDepth(40);
        const panel = this.add.rectangle(640, 644, 760, 108, 0x0a111c, 0.96).setStrokeStyle(2, 0x4d657b, 1);
        const label = this.add.text(640, 607, 'DEV ONLY  /  SELECT A POSE', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#a9c5d8', letterSpacing: 2 }).setOrigin(0.5);
        layer.add([panel, label]);

        const poses: FighterPose[] = ['guard', 'dash', 'attack', 'win', 'lose'];
        poses.forEach((pose, index) => {
            const x = 390 + index * 125;
            const frame = this.add.rectangle(x, 644, 108, 38, 0x162537, 0.98).setStrokeStyle(1, 0x6d8499, 1).setInteractive({ useHandCursor: true });
            const text = this.add.text(x, 644, pose.toUpperCase(), { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#edf7ff', letterSpacing: 1 }).setOrigin(0.5);
            frame.on('pointerdown', () => {
                this.setFighterPose(this.raven, pose);
                if (pose === 'attack') {
                    if (this.debugEnabled) this.updateDebugPreview();
                    else this.playAttackEffect(this.raven);
                }
                this.statusText.setText(`${this.playerFighter.name}  /  ${pose.toUpperCase()}`);
            });
            layer.add([frame, text]);
        });

        const playFrame = this.add.rectangle(1090, 644, 180, 38, 0x233221, 0.98).setStrokeStyle(2, 0x92f7bf, 1).setInteractive({ useHandCursor: true });
        const playText = this.add.text(1090, 644, 'PLAY DUEL', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c7ffe0', letterSpacing: 2 }).setOrigin(0.5);
        playFrame.on('pointerdown', () => {
            this.motionPreviewLayer?.destroy();
            this.motionPreviewLayer = undefined;
            this.debugLayer?.destroy();
            this.debugLayer = undefined;
            this.debugEffectPreview?.destroy();
            this.debugEffectPreview = undefined;
            this.resetDuel();
            this.startCountdown();
            this.lastActionAt = this.time.now;
        });
        layer.add([playFrame, playText]);
        this.motionPreviewLayer = layer;
        if (this.debugEnabled) {
            this.createDebugTuner();
            this.updateDebugPreview();
        }
    }

    private createDebugTuner() {
        this.debugLayer?.destroy();
        const layer = this.add.container().setDepth(90);
        const toggle = this.add.rectangle(1100, 104, 174, 38, 0x14243a, 0.98).setStrokeStyle(2, 0x75f4ea, 0.9).setInteractive({ useHandCursor: true });
        const toggleText = this.add.text(1100, 104, this.debugExpanded ? 'TUNER  −' : 'TUNER  +', { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#b9fff7', letterSpacing: 2 }).setOrigin(0.5);
        toggle.on('pointerdown', () => {
            this.debugExpanded = !this.debugExpanded;
            this.createDebugTuner();
        });
        layer.add([toggle, toggleText]);
        this.debugLayer = layer;
        if (!this.debugExpanded) return;

        const panel = this.add.rectangle(1020, 370, 470, 486, 0x07101c, 0.97).setStrokeStyle(2, 0x5f7890, 1);
        const heading = this.add.text(802, 150, 'ATTACK TUNER  /  DEBUG ONLY', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#ffdc57', letterSpacing: 2 });
        const hint = this.add.text(802, 171, '選択したキャラをその場で切替。タップで値を変更。', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#a8bdcf' });
        layer.add([panel, heading, hint]);

        FIGHTERS.forEach((fighter, index) => {
            const x = 850 + (index % 4) * 110;
            const y = 204 + Math.floor(index / 4) * 34;
            this.addDebugButton(layer, x, y, 100, 27, fighter.name, fighter.id === this.playerFighter.id, () => this.switchDebugFighter(fighter));
        });

        const attackActive = this.debugAsset === 'attack';
        this.addDebugButton(layer, 885, 274, 150, 32, 'ATTACK POSE', attackActive, () => {
            this.debugAsset = 'attack';
            this.createDebugTuner();
            this.updateDebugPreview();
        });
        this.addDebugButton(layer, 1050, 274, 150, 32, 'ATTACK EFFECT', !attackActive, () => {
            this.debugAsset = 'effect';
            this.createDebugTuner();
            this.updateDebugPreview();
        });

        const fighter = this.playerFighter;
        const isAttack = this.debugAsset === 'attack';
        const xValue = isAttack ? this.poseOffsetX(fighter, 'attack') : fighter.attackEffect!.offsetX;
        const yValue = isAttack ? this.poseOffsetY(fighter, 'attack') : fighter.attackEffect!.offsetY;
        const scaleValue = isAttack ? this.poseScale(fighter, 'attack') : fighter.attackEffect!.scale;
        const xRange: [number, number] = isAttack ? [-140, 140] : [-60, 240];
        const yRange: [number, number] = [-180, 150];
        const scaleRange: [number, number] = isAttack ? [0.20, 1.10] : [0.08, 0.90];
        this.addDebugSlider(layer, 329, 'X', xRange[0], xRange[1], xValue, (value) => {
            if (isAttack) {
                fighter.poseOffsetXs ??= {};
                fighter.poseOffsetXs.attack = Math.round(value);
            } else {
                fighter.attackEffect!.offsetX = Math.round(value);
            }
        }, false);
        this.addDebugSlider(layer, 382, 'Y', yRange[0], yRange[1], yValue, (value) => {
            if (isAttack) {
                fighter.poseOffsetYs ??= {};
                fighter.poseOffsetYs.attack = Math.round(value);
            } else {
                fighter.attackEffect!.offsetY = Math.round(value);
            }
        }, false);
        this.addDebugSlider(layer, 435, 'SIZE', scaleRange[0], scaleRange[1], scaleValue, (value) => {
            if (isAttack) {
                fighter.poseScales ??= {};
                fighter.poseScales.attack = Math.round(value * 100) / 100;
            } else {
                fighter.attackEffect!.scale = Math.round(value * 100) / 100;
            }
        }, true);

        const copy = this.add.rectangle(935, 514, 180, 36, 0x203324, 0.98).setStrokeStyle(2, 0x9cf2be, 0.9).setInteractive({ useHandCursor: true });
        const copyText = this.add.text(935, 514, 'COPY THIS FIGHTER', { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#d3ffe4', letterSpacing: 1 }).setOrigin(0.5);
        copy.on('pointerdown', () => this.copyDebugTuning());
        const allCopy = this.add.rectangle(1110, 514, 145, 36, 0x1a2638, 0.98).setStrokeStyle(2, 0x9bbce8, 0.9).setInteractive({ useHandCursor: true });
        const allCopyText = this.add.text(1110, 514, 'COPY ALL', { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#d7e7ff', letterSpacing: 1 }).setOrigin(0.5);
        allCopy.on('pointerdown', () => this.copyDebugTuning(true));
        layer.add([copy, copyText, allCopy, allCopyText]);
    }

    private addDebugButton(layer: GameObjects.Container, x: number, y: number, width: number, height: number, label: string, active: boolean, onClick: () => void) {
        const frame = this.add.rectangle(x, y, width, height, active ? 0x263a52 : 0x121d2d, 1).setStrokeStyle(active ? 2 : 1, active ? this.playerFighter.color : 0x607b97, 1).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: active ? '#ffffff' : '#b9c9d8', letterSpacing: 1 }).setOrigin(0.5);
        frame.on('pointerdown', onClick);
        layer.add([frame, text]);
    }

    private addDebugSlider(layer: GameObjects.Container, y: number, label: string, min: number, max: number, value: number, setValue: (value: number) => void, decimal: boolean) {
        const startX = 872;
        const width = 224;
        const display = this.add.text(1184, y, decimal ? value.toFixed(2) : `${Math.round(value)}`, { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#eef8ff' }).setOrigin(1, 0.5);
        const caption = this.add.text(807, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#c8dae8', letterSpacing: 1 }).setOrigin(0, 0.5);
        const track = this.add.rectangle(startX + width / 2, y, width, 9, 0x25384c, 1).setInteractive({ useHandCursor: true });
        const currentX = () => startX + ((value - min) / (max - min)) * width;
        const knob = this.add.circle(currentX(), y, 11, 0x75f4ea, 1).setStrokeStyle(2, 0xffffff, 0.95);
        const applyAt = (worldX: number) => {
            const progress = PhaserMath.Clamp((worldX - startX) / width, 0, 1);
            value = min + (max - min) * progress;
            setValue(value);
            display.setText(decimal ? value.toFixed(2) : `${Math.round(value)}`);
            knob.setX(startX + progress * width);
            this.updateDebugPreview();
        };
        track.on('pointerdown', (pointer: Phaser.Input.Pointer) => applyAt(pointer.worldX));
        track.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown) applyAt(pointer.worldX);
        });
        layer.add([caption, track, knob, display]);
    }

    private switchDebugFighter(fighter: FighterDefinition) {
        if (fighter.id === this.playerFighter.id || this.state !== 'preview') return;
        const npc = FIGHTERS.find((other) => other.id !== fighter.id && other.id === 'mika') ?? FIGHTERS[0];
        const apply = () => {
            this.tweens.killTweensOf(this.raven);
            this.tweens.killTweensOf(this.mika);
            this.raven.destroy();
            this.mika.destroy();
            this.playerFighter = fighter;
            this.npcFighter = npc;
            this.createFighters();
            this.promptText.setText('MOTION CHECK');
            this.statusText.setText(`${fighter.name} の攻撃位置を調整中`);
            this.createDebugTuner();
            this.updateDebugPreview();
        };
        if (this.needsMotionLoad(fighter) || this.needsMotionLoad(npc)) {
            this.statusText.setText(`PREPARING ${fighter.name}`);
            this.loadFighterMotions([fighter, npc], apply);
            return;
        }
        apply();
    }

    private updateDebugPreview() {
        if (!this.debugEnabled || this.state !== 'preview') return;
        this.setFighterPose(this.raven, 'attack');
        this.setFighterPose(this.mika, 'guard');
        this.debugEffectPreview?.destroy();
        this.debugEffectPreview = undefined;
        if (this.debugAsset !== 'effect') return;
        const definition = this.playerFighter;
        const effectDefinition = definition.attackEffect;
        if (effectDefinition === undefined || !this.textures.exists(this.attackEffectKey(definition))) return;
        const direction = this.raven.getData('direction') as -1 | 1;
        const towardCenter = direction === -1 ? 1 : -1;
        this.debugEffectPreview = this.add.image(
            this.raven.x + towardCenter * effectDefinition.offsetX,
            this.raven.y + effectDefinition.offsetY,
            this.attackEffectKey(definition)
        ).setOrigin(0.5).setScale(effectDefinition.scale).setFlipX(this.shouldFlipNatural('right', direction)).setAlpha(0.96).setDepth(effectDefinition.layer === 'front' ? 7 : 3);
    }

    private copyDebugTuning(all = false) {
        const serialize = (fighter: FighterDefinition) => ({
            attack: { x: this.poseOffsetX(fighter, 'attack'), y: this.poseOffsetY(fighter, 'attack'), scale: this.poseScale(fighter, 'attack') },
            effect: { x: fighter.attackEffect?.offsetX, y: fighter.attackEffect?.offsetY, scale: fighter.attackEffect?.scale }
        });
        const value = all
            ? Object.fromEntries(FIGHTERS.map((fighter) => [fighter.id, serialize(fighter)]))
            : { [this.playerFighter.id]: serialize(this.playerFighter) };
        const copied = JSON.stringify(value);
        void navigator.clipboard?.writeText(copied);
        this.statusText.setText(`COPIED: ${copied}`);
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
        if (now - this.lastActionAt < 160 || this.state === 'settling' || this.state === 'select' || this.state === 'preview') return;
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
            this.playAttackEffect(this.raven);
        } else {
            this.flashArena(winnerColor, 0.28, 100);
            this.createDashTrail(winner, winnerColor, playerWins ? 1 : -1);
            this.createImpactBurst(winner, winnerColor);
            this.playAttackEffect(winner);
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

    private createImpactBurst(fighter: GameObjects.Container, color: number) {
        const direction = fighter.getData('direction') as -1 | 1;
        const towardCenter = direction === -1 ? 1 : -1;
        const x = fighter.x + towardCenter * 116;
        const y = fighter.y + 42;
        const ring = this.add.circle(x, y, 13).setStrokeStyle(4, color, 0.95).setDepth(6);
        this.tweens.add({ targets: ring, scale: 3.8, alpha: 0, duration: 250, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
        for (let index = 0; index < 9; index++) {
            const spark = this.add.rectangle(x, y, 5, 5, color, 0.9).setDepth(6).setRotation(PhaserMath.FloatBetween(-0.8, 0.8));
            this.tweens.add({
                targets: spark,
                x: x + towardCenter * PhaserMath.Between(44, 155),
                y: y + PhaserMath.Between(-92, 72),
                alpha: 0,
                scale: PhaserMath.FloatBetween(0.35, 0.8),
                duration: PhaserMath.Between(180, 330),
                ease: 'Quad.easeOut',
                onComplete: () => spark.destroy()
            });
        }
    }

    private playAttackEffect(fighter: GameObjects.Container) {
        const definition = fighter.getData('definition') as FighterDefinition;
        const effectDefinition = definition.attackEffect;
        if (effectDefinition === undefined || !this.textures.exists(this.attackEffectKey(definition))) return;
        const direction = fighter.getData('direction') as -1 | 1;
        const towardCenter = direction === -1 ? 1 : -1;
        const effect = this.add.image(
            fighter.x + towardCenter * effectDefinition.offsetX,
            fighter.y + effectDefinition.offsetY,
            this.attackEffectKey(definition)
        ).setOrigin(0.5).setScale(effectDefinition.scale * 0.76).setFlipX(this.shouldFlipNatural('right', direction)).setAlpha(0).setDepth(effectDefinition.layer === 'front' ? 7 : 3);

        this.tweens.add({
            targets: effect,
            alpha: 1,
            scale: effectDefinition.scale,
            duration: 65,
            ease: 'Quad.easeOut'
        });
        this.tweens.add({
            targets: effect,
            x: effect.x + towardCenter * 88,
            alpha: 0,
            scale: effectDefinition.scale * 1.09,
            duration: 340,
            delay: 55,
            ease: 'Sine.easeOut',
            onComplete: () => effect.destroy()
        });
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
