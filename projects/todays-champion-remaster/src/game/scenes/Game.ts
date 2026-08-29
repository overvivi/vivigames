import { GameObjects, Math as PhaserMath, Scene } from 'phaser';

type DuelState = 'select' | 'preview' | 'idle' | 'countdown' | 'reaction' | 'settling' | 'result';
type CountdownValue = '3' | '2' | '1' | 'FIGHT';

type AttackEffectDefinition = {
    scale: number;
    offsetX: number;
    offsetY: number;
    layer: 'behind' | 'front';
    flip?: boolean;
};

type FighterDefinition = {
    id: string;
    name: string;
    subtitle: string;
    color: number;
    portraitKey: string;
    gateLineupKey?: string;
    gateSelectedKey?: string;
    combatKey: string;
    combatScale: number;
    naturalFacing: 'left' | 'right';
    poseFacing?: Partial<Record<FighterPose, 'left' | 'right'>>;
    poseFlipOverrides?: Partial<Record<FighterPose, boolean>>;
    poseScales?: Partial<Record<FighterPose, number>>;
    poseOffsetXs?: Partial<Record<FighterPose, number>>;
    poseOffsetYs?: Partial<Record<FighterPose, number>>;
    attackEffect?: AttackEffectDefinition;
};

type FighterPose = 'guard' | 'dash' | 'attack' | 'win' | 'lose';

// 縦持ち実機を基準にする。PCでは余白を許容し、無理に横長へ引き伸ばさない。
const VIEW_WIDTH = 941;
const VIEW_HEIGHT = 1672;
const DEFAULT_STAGE_LAYOUT = { playerX: 244, npcX: 697, fighterY: 1107, fighterScale: 1 };
// 第二完成系は7枚を常時固定する。縦持ちENVELOPで左右が切れる端末でも外枠が残る安全域。
const SELECT_GATE_SLOTS = [140, 250, 360, 470, 580, 690, 800];
// 境界線より少しだけ路面へ入れる。線上で止めるより、ゲートが濡れた地面に立って見える。
const SELECT_GATE_Y = 822;
const FIGHTERS: FighterDefinition[] = [
    { id: 'raven', name: 'RAVEN', subtitle: 'ZERO BLADE', color: 0x55dffc, portraitKey: 'portrait-raven', gateLineupKey: 'gate-raven-lineup', gateSelectedKey: 'gate-raven-selected', combatKey: 'guard-raven', combatScale: 0.42, naturalFacing: 'left', poseFacing: { dash: 'right', attack: 'right', win: 'right', lose: 'right' }, poseFlipOverrides: { win: true, lose: true }, poseScales: { guard: 0.42, dash: 0.42, attack: 0.43, win: 0.49, lose: 0.32 }, poseOffsetYs: { win: 10 }, attackEffect: { scale: 0.29, offsetX: 57, offsetY: -60, layer: 'front' } },
    { id: 'mika', name: 'MIKA', subtitle: 'PINK RIOT', color: 0xff5ca8, portraitKey: 'portrait-mika', gateLineupKey: 'gate-mika-lineup', gateSelectedKey: 'gate-mika-selected', combatKey: 'guard-mika', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.42, dash: 0.42, attack: 0.47, win: 0.50, lose: 0.33 }, poseOffsetYs: { win: 10 }, attackEffect: { scale: 0.27, offsetX: 67, offsetY: -83, layer: 'front' } },
    { id: 'brick', name: 'BRICK', subtitle: 'IRON FIST', color: 0xffb14f, portraitKey: 'portrait-brick', gateLineupKey: 'gate-brick-lineup', gateSelectedKey: 'gate-brick-selected', combatKey: 'guard-brick', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.50, dash: 0.48, attack: 0.50, win: 0.72, lose: 0.34 }, poseOffsetYs: { guard: 7, win: 20 }, attackEffect: { scale: 0.31, offsetX: 47, offsetY: -160, layer: 'behind' } },
    { id: 'noise', name: 'NOISE', subtitle: 'BEAT BRKR', color: 0xa776ff, portraitKey: 'portrait-noise', gateLineupKey: 'gate-noise-lineup', gateSelectedKey: 'gate-noise-selected', combatKey: 'guard-noise', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right' }, poseFlipOverrides: { guard: true, lose: true }, poseScales: { guard: 0.45, dash: 0.41, attack: 0.46, win: 0.52, lose: 0.33 }, poseOffsetYs: { win: 17 }, attackEffect: { scale: 0.31, offsetX: 123, offsetY: -113, layer: 'behind' } },
    { id: 'kiri', name: 'KIRI', subtitle: 'GHOST SIG', color: 0xb1c4f6, portraitKey: 'portrait-kiri', gateLineupKey: 'gate-kiri-lineup', gateSelectedKey: 'gate-kiri-selected', combatKey: 'guard-kiri', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', win: 'left', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.41, dash: 0.41, attack: 0.63, win: 0.58, lose: 0.31 }, poseOffsetYs: { attack: 60, win: 20, lose: -7 }, attackEffect: { scale: 0.32, offsetX: 70, offsetY: -17, layer: 'behind' } },
    { id: 'vivi', name: 'VIVI', subtitle: 'TWO-FACED', color: 0xf0d59b, portraitKey: 'portrait-vivi', gateLineupKey: 'gate-vivi-lineup', gateSelectedKey: 'gate-vivi-selected', combatKey: 'guard-vivi', combatScale: 0.19, naturalFacing: 'right', poseScales: { guard: 0.25, dash: 0.25, attack: 0.25, win: 0.23, lose: 0.19 }, poseOffsetYs: { guard: 27, dash: -7, attack: 40, win: 3 }, attackEffect: { scale: 0.39, offsetX: 240, offsetY: -70, layer: 'behind' } },
    { id: 'tomega9', name: 'TΩ9', subtitle: 'DESTROYER', color: 0xff534c, portraitKey: 'portrait-tomega9', gateLineupKey: 'gate-tomega9-lineup', gateSelectedKey: 'gate-tomega9-selected', combatKey: 'guard-tomega9', combatScale: 0.19, naturalFacing: 'right', poseScales: { guard: 0.35, dash: 0.34, attack: 0.33, win: 0.34, lose: 0.31 }, poseOffsetYs: { attack: 20 }, attackEffect: { scale: 0.49, offsetX: 147, offsetY: -90, layer: 'behind' } }
];

// 背景へ文字を焼かず、端末差で見た目が崩れない同一キャンバス内の画像演出にする。
const COUNTDOWN_ART: Record<CountdownValue, { key: string; width: number; height: number }> = {
    '3': { key: 'countdown-3', width: 440, height: 440 },
    '2': { key: 'countdown-2', width: 440, height: 440 },
    '1': { key: 'countdown-1', width: 440, height: 440 },
    'FIGHT': { key: 'countdown-fight', width: 700, height: 396 }
};

export class Game extends Scene {
    private state: DuelState = 'idle';
    private promptText!: GameObjects.Text;
    private statusText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private countdownArt!: GameObjects.Image;
    private raven!: GameObjects.Container;
    private mika!: GameObjects.Container;
    private selectedFighter = FIGHTERS[0];
    private playerFighter = FIGHTERS[0];
    private npcFighter = FIGHTERS[1];
    private selectTitle?: GameObjects.Text;
    private selectionLayer?: GameObjects.Container;
    private selectionFrames = new Map<string, GameObjects.Image>();
    private selectionCards = new Map<string, GameObjects.Container>();
    private selectionSwipeStart?: { x: number; y: number };
    private reactionStartedAt = 0;
    private lastActionAt = -Infinity;
    private resultLayer?: GameObjects.Container;
    private motionPreviewLayer?: GameObjects.Container;
    private motionPreviewEnabled = false;
    private debugEnabled = false;
    private debugLayer?: GameObjects.Container;
    private debugExpanded = true;
    private debugAsset: 'pose' | 'effect' = 'pose';
    private debugPose: FighterPose = 'guard';
    private debugEffectPreview?: GameObjects.Image;
    private stageTunerLayer?: GameObjects.Container;
    private stageTunerExpanded = true;
    private stageLayout = { ...DEFAULT_STAGE_LAYOUT };
    // 横長PCはゲームの左右に十分な黒余白がある。そこを使えば確認中の画面を覆わない。
    // 端末が狭い時は従来どおりPhaser内へ戻すため、ゲーム座標そのものには依存させない。
    private desktopDebugEnabled = false;
    private desktopStagePanel?: HTMLElement;
    private desktopMotionPanel?: HTMLElement;
    private desktopDebugStyle?: HTMLStyleElement;
    private flash!: GameObjects.Rectangle;

    constructor() {
        super('Game');
    }

    preload() {
        this.load.image('stage-mobile', 'assets/stages/neon-crosswalk-mobile-v3.webp');
        this.load.image('select-bg-mobile', 'assets/championship-re/select/select-bg-final-v2.webp');
        this.load.image('championship-re-title', 'assets/championship-re/ui/championship-re-title-final-v1.webp');
        this.load.image('championship-re-start-duel', 'assets/championship-re/ui/start-duel-final-v1.webp');
        this.load.image('championship-re-frame-normal', 'assets/championship-re/frames/championship-re-frame-normal-final-v2.webp');
        this.load.image('championship-re-frame-select', 'assets/championship-re/frames/championship-re-frame-select-final-v2.webp');
        FIGHTERS.forEach((fighter) => {
            this.load.image(`gate-interior-${fighter.id}`, `assets/championship-re/gates/interiors/gate-interior-${fighter.id}-v1.webp`);
            this.load.image(fighter.gateLineupKey!, `assets/championship-re/gates/characters/gate-character-${fighter.id}-lineup-v1.webp`);
            this.load.image(fighter.gateSelectedKey!, `assets/championship-re/gates/characters/gate-character-${fighter.id}-selected-v1.webp`);
        });
        this.load.image('countdown-3', 'assets/ui/countdown-3-v1.webp');
        this.load.image('countdown-2', 'assets/ui/countdown-2-v1.webp');
        this.load.image('countdown-1', 'assets/ui/countdown-1-v1.webp');
        this.load.image('countdown-fight', 'assets/ui/countdown-fight-v1.webp');
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
        this.desktopDebugEnabled = this.debugEnabled && this.hasDesktopDebugSpace();
        this.events.once('shutdown', () => this.destroyDesktopDebugPanels());
        this.motionPreviewEnabled = params.has('motionPreview') || this.debugEnabled;
        this.createArena();
        this.createFighters();
        this.createHud();
        this.showFighterSelect();
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.captureSelectSwipe(pointer);
            this.handleAction();
        });
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.finishSelectSwipe(pointer));
        this.input.keyboard?.on('keydown-SPACE', () => this.handleAction());
        this.input.keyboard?.on('keydown-LEFT', () => this.stepSelect(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => this.stepSelect(1));
    }

    private createArena() {
        this.cameras.main.setBackgroundColor(0x070b12);
        this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 'stage-mobile').setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
        this.flash = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0xffffff, 0).setDepth(30);
    }

    private createFighters() {
        this.raven = this.createFighter(this.stageLayout.playerX, this.stageLayout.fighterY, this.playerFighter, -1);
        this.mika = this.createFighter(this.stageLayout.npcX, this.stageLayout.fighterY, this.npcFighter, 1);
    }

    private createFighter(x: number, y: number, fighterData: FighterDefinition, direction: -1 | 1) {
        const fighter = this.add.container(x, y);
        fighter.setDepth(5).setScale(this.stageLayout.fighterScale);
        const glow = this.add.circle(0, 16, 104, fighterData.color, 0.1);
        const shadow = this.add.ellipse(0, 101, 138, 22, 0x000000, 0.48);
        const art = this.add.image(0, 82, fighterData.combatKey).setOrigin(0.5, 1).setScale(fighterData.combatScale).setFlipX(this.shouldFlip(fighterData, direction));
        const nameText = this.add.text(0, 126, fighterData.name, { fontFamily: 'Arial, sans-serif', fontSize: '22px', fontStyle: 'bold', color: `#${fighterData.color.toString(16).padStart(6, '0')}`, letterSpacing: 3 }).setOrigin(0.5);
        const subtitleText = this.add.text(0, 153, fighterData.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#9aa9b7', letterSpacing: 2 }).setOrigin(0.5);
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
        this.hideCountdownChrome();

        const layer = this.add.container().setDepth(100);
        // 選択画面は戦闘背景を暗く覆うのではなく、カードを置く専用舞台へ丸ごと差し替える。
        // 枠・キャラ・文字はこの上へ同じPhaser座標で積むので、端末別のズレを作らない。
        const selectBackground = this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 'select-bg-mobile').setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
        const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02060d, 0.08);
        const upperShade = this.add.rectangle(VIEW_WIDTH / 2, 180, VIEW_WIDTH, 360, 0x050a13, 0.24);
        layer.add([selectBackground, shade, upperShade]);

        const gameBase = this.add.text(110, 60, '← GAME BASE', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#d9efff', letterSpacing: 2 }).setInteractive({ useHandCursor: true });
        gameBase.on('pointerdown', () => { window.location.href = '../..'; });
        // PCでも主題として読める横幅を取る。選択情報は各ゲート内へ集約する。
        const titleLogo = this.add.image(VIEW_WIDTH / 2, 245, 'championship-re-title').setDisplaySize(820, 205);
        this.selectTitle = this.add.text(VIEW_WIDTH / 2, 330, '', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#f5d45e', letterSpacing: 4 }).setOrigin(0.5).setVisible(false);
        layer.add([gameBase, titleLogo, this.selectTitle]);

        // 採用構図は「7本のゲートそのものが主役」。別の大型モニターは置かない。
        // 選択操作の案内はゲート群から切り離し、開始CTAの直前で次の行動として読ませる。
        const selectedHint = this.add.text(VIEW_WIDTH / 2, 1360, 'TAP A GATE   |   SWIPE TO SELECT', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#d9e6ef', letterSpacing: 3 }).setOrigin(0.5);
        layer.add([selectedHint]);
        this.selectionLayer = layer;
        this.selectionFrames.clear();
        this.selectionCards.clear();

        FIGHTERS.forEach((fighter, index) => this.createSelectionCard(fighter, index));
        this.selectFighter(this.selectedFighter, true);

        // CTAは床の反射だけが残る下部デッドゾーンより上へ、透過素材として置く。
        const startButton = this.add.image(VIEW_WIDTH / 2, 1460, 'championship-re-start-duel').setDisplaySize(680, 170).setInteractive({ useHandCursor: true });
        startButton.on('pointerdown', () => this.startSelectedDuel());
        startButton.on('pointerover', () => startButton.setAlpha(0.92));
        startButton.on('pointerout', () => startButton.setAlpha(1));
        layer.add(startButton);
    }

    private createSelectionCard(fighter: FighterDefinition, index: number) {
        const x = SELECT_GATE_SLOTS[index];
        const y = SELECT_GATE_Y;
        const card = this.add.container(x, y);
        // 背景と人物は分ける。非選択で人物だけを落としても、街が異次元ゲート内へ漏れない。
        const gateArtScale = 767 / 3137;
        const interiorArt = this.add.image(0, 0, `gate-interior-${fighter.id}`).setOrigin(0.5).setScale(gateArtScale);
        const lineupArt = this.add.image(0, 0, fighter.gateLineupKey!).setOrigin(0.5).setScale(gateArtScale);
        const selectedArt = this.add.image(0, 0, fighter.gateSelectedKey!).setOrigin(0.5).setScale(gateArtScale).setVisible(false);
        const windowShade = this.add.rectangle(0, 0, 90.5, 767, 0x02070e, 0.42);
        const accent = this.add.rectangle(0, 0, 96, 814, fighter.color, 0.16).setStrokeStyle(2, fighter.color, 0.7);
        const leftAccentRail = this.add.rectangle(-46, 0, 3, 802, fighter.color, 0.68);
        const rightAccentRail = this.add.rectangle(46, 0, 3, 802, fighter.color, 0.68);
        const frame = this.add.image(0, 0, 'championship-re-frame-normal').setOrigin(0.5).setDisplaySize(110, 850);
        // 本体規格は共通。選択時だけは手前へ出る分を小さく拡大し、足元Yは地面ラインへ戻す。
        const selectedFrame = this.add.image(0, 0, 'championship-re-frame-select').setOrigin(0.5).setDisplaySize(110, 850).setVisible(false);
        const number = this.add.text(0, -340, `0${index + 1}`, { fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#f7fbff', letterSpacing: 1 }).setOrigin(0.5);
        const name = this.add.text(0, -304, fighter.name, { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#f7fbff', letterSpacing: 0.5 }).setOrigin(0.5);
        const subtitle = this.add.text(0, -278, fighter.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '9px', fontStyle: 'bold', color: '#d6eaff', letterSpacing: 0.2, align: 'center' }).setOrigin(0.5);
        const hit = this.add.rectangle(0, 0, 110, 850, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.selectFighter(fighter));
        card.setData('fighter', fighter);
        card.setData('lineupArt', lineupArt);
        card.setData('selectedArt', selectedArt);
        card.setData('windowShade', windowShade);
        card.setData('lineupFrame', frame);
        card.setData('selectedFrame', selectedFrame);
        card.setData('accent', accent);
        card.setData('leftAccentRail', leftAccentRail);
        card.setData('rightAccentRail', rightAccentRail);
        card.setData('number', number);
        card.setData('name', name);
        card.setData('subtitle', subtitle);
        card.setData('hit', hit);
        card.add([interiorArt, lineupArt, selectedArt, windowShade, accent, frame, selectedFrame, leftAccentRail, rightAccentRail, number, name, subtitle, hit]);
        this.selectionLayer?.add(card);
        this.selectionFrames.set(fighter.id, frame);
        this.selectionCards.set(fighter.id, card);
    }

    private selectFighter(fighter: FighterDefinition, force = false) {
        if (!force && fighter.id === this.selectedFighter.id) return;
        const changed = fighter.id !== this.selectedFighter.id;
        this.selectedFighter = fighter;
        const index = FIGHTERS.findIndex((entry) => entry.id === fighter.id) + 1;
        this.selectTitle?.setText(`CONTENDER ${String(index).padStart(2, '0')}  //  ${fighter.name}  /  ${fighter.subtitle}`);
        this.selectionCards.forEach((card, id) => {
            const selected = id === fighter.id;
            const targetX = SELECT_GATE_SLOTS[FIGHTERS.findIndex((entry) => entry.id === id)];
            const targetY = SELECT_GATE_Y;
            const frame = card.getData('lineupFrame') as GameObjects.Image;
            const selectedFrame = card.getData('selectedFrame') as GameObjects.Image;
            const lineupArt = card.getData('lineupArt') as GameObjects.Image;
            const selectedArt = card.getData('selectedArt') as GameObjects.Image;
            const windowShade = card.getData('windowShade') as GameObjects.Rectangle;
            const accent = card.getData('accent') as GameObjects.Rectangle;
            const leftAccentRail = card.getData('leftAccentRail') as GameObjects.Rectangle;
            const rightAccentRail = card.getData('rightAccentRail') as GameObjects.Rectangle;
            const number = card.getData('number') as GameObjects.Text;
            const name = card.getData('name') as GameObjects.Text;
            const subtitle = card.getData('subtitle') as GameObjects.Text;
            const hit = card.getData('hit') as GameObjects.Rectangle;
            frame.setVisible(!selected).setAlpha(selected ? 0 : 0.86);
            selectedFrame.setVisible(selected).setAlpha(1);
            // 非選択もカード全体を透過させず、立ち絵だけを抑える。背景が枠内へ透けると空のゲートに見えるため。
            lineupArt.setVisible(!selected).setAlpha(selected ? 0 : 0.58);
            selectedArt.setVisible(selected).setAlpha(selected ? 1 : 0);
            windowShade.setAlpha(selected ? 0.04 : 0.74);
            accent.setAlpha(selected ? 0.34 : 0.16);
            // 全員の色は残しつつ、選択中だけ線の光量を上げて主役を一目で分かるようにする。
            leftAccentRail.setAlpha(selected ? 1 : 0.34);
            rightAccentRail.setAlpha(selected ? 1 : 0.34);
            number.setPosition(0, -340).setAlpha(selected ? 1 : 0.86);
            name.setPosition(0, -304).setAlpha(selected ? 1 : 0.88);
            subtitle.setPosition(0, -278).setAlpha(selected ? 1 : 0.82);
            hit.setScale(selected ? 1 / 1.04 : 1);
            this.tweens.killTweensOf(card);
            if (selected && changed) {
                card.setAlpha(1).setDepth(4);
                this.tweens.add({ targets: card, x: targetX, y: targetY - 13, scaleX: 1.04, scaleY: 1.04, duration: 120, ease: 'Sine.easeOut' });
            } else {
                card.setAlpha(1).setPosition(targetX, selected ? targetY - 13 : targetY).setScale(selected ? 1.04 : 1).setDepth(selected ? 4 : 1);
            }
        });
    }

    private captureSelectSwipe(pointer: Phaser.Input.Pointer) {
        if (this.state === 'select') this.selectionSwipeStart = { x: pointer.x, y: pointer.y };
    }

    private finishSelectSwipe(pointer: Phaser.Input.Pointer) {
        if (this.state !== 'select' || this.selectionSwipeStart === undefined) return;
        const start = this.selectionSwipeStart;
        this.selectionSwipeStart = undefined;
        const xDelta = pointer.x - start.x;
        const yDelta = pointer.y - start.y;
        if (Math.abs(xDelta) < 38 || Math.abs(xDelta) < Math.abs(yDelta) * 1.4) return;
        this.stepSelect(xDelta < 0 ? 1 : -1);
    }

    private stepSelect(step: -1 | 1) {
        if (this.state !== 'select') return;
        const current = FIGHTERS.findIndex((fighter) => fighter.id === this.selectedFighter.id);
        const next = (current + step + FIGHTERS.length) % FIGHTERS.length;
        this.selectFighter(FIGHTERS[next]);
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

    private hasMotion(_fighter: FighterDefinition) {
        return true;
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

    private motionAssetPath(fighter: FighterDefinition, pose: Exclude<FighterPose, 'guard'>) {
        if (fighter.id === 'vivi' || fighter.id === 'tomega9') {
            return `assets/fighters/motions/${fighter.id}-${pose}-${this.motionSourceVersion(fighter, pose)}.png`;
        }
        return pose === 'attack'
            ? `assets/fighters/motions/${fighter.id}-attack.webp`
            : `assets/fighters/motions/${fighter.id}-${pose}.webp`;
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
                        this.load.image(key, this.motionAssetPath(fighter, pose));
                    }
                });
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
        const flip = this.shouldFlipNatural(fighter.poseFacing?.[pose] ?? fighter.naturalFacing, direction);
        return fighter.poseFlipOverrides?.[pose] ? !flip : flip;
    }

    private shouldFlipNatural(naturalFacing: 'left' | 'right', direction: -1 | 1) {
        const desiredFacing = direction === -1 ? 'right' : 'left';
        return naturalFacing !== desiredFacing;
    }

    private shouldFlipEffect(effect: AttackEffectDefinition, direction: -1 | 1) {
        const flip = this.shouldFlipNatural('right', direction);
        return effect.flip ? !flip : flip;
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
        this.hideCountdownChrome();
        this.promptText.setText('MOTION CHECK');
        this.statusText.setText(`${this.playerFighter.name} の攻撃エフェクトと表示を確認`);

        const layer = this.add.container().setDepth(40);
        const panel = this.add.rectangle(VIEW_WIDTH / 2, 1492, 824, 164, 0x0a111c, 0.96).setStrokeStyle(2, 0x4d657b, 1);
        const label = this.add.text(VIEW_WIDTH / 2, 1426, 'DEV ONLY  /  SELECT A POSE', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#a9c5d8', letterSpacing: 2 }).setOrigin(0.5);
        layer.add([panel, label]);

        const poses: FighterPose[] = ['guard', 'dash', 'attack', 'win', 'lose'];
        poses.forEach((pose, index) => {
            const x = 190 + index * 140;
            const frame = this.add.rectangle(x, 1472, 124, 42, 0x162537, 0.98).setStrokeStyle(1, 0x6d8499, 1).setInteractive({ useHandCursor: true });
            const text = this.add.text(x, 1472, pose.toUpperCase(), { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#edf7ff', letterSpacing: 1 }).setOrigin(0.5);
            frame.on('pointerdown', () => {
                if (this.debugEnabled) {
                    this.debugAsset = 'pose';
                    this.debugPose = pose;
                    this.createDebugTuner();
                    this.updateDebugPreview();
                } else {
                    this.setFighterPose(this.raven, pose);
                    if (pose === 'attack') this.playAttackEffect(this.raven);
                }
                this.statusText.setText(`${this.playerFighter.name}  /  ${pose.toUpperCase()}`);
            });
            layer.add([frame, text]);
        });

        const playFrame = this.add.rectangle(VIEW_WIDTH / 2, 1542, 260, 38, 0x233221, 0.98).setStrokeStyle(2, 0x92f7bf, 1).setInteractive({ useHandCursor: true });
        const playText = this.add.text(VIEW_WIDTH / 2, 1542, 'PLAY DUEL', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#c7ffe0', letterSpacing: 2 }).setOrigin(0.5);
        playFrame.on('pointerdown', () => {
            this.motionPreviewLayer?.destroy();
            this.motionPreviewLayer = undefined;
            this.debugLayer?.destroy();
            this.debugLayer = undefined;
            this.stageTunerLayer?.destroy();
            this.stageTunerLayer = undefined;
            this.destroyDesktopDebugPanels();
            this.debugEffectPreview?.destroy();
            this.debugEffectPreview = undefined;
            this.resetDuel();
            this.startCountdown();
            this.lastActionAt = this.time.now;
        });
        layer.add([playFrame, playText]);
        this.motionPreviewLayer = layer;
        if (this.debugEnabled) {
            this.createStageTuner();
            this.createDebugTuner();
            this.updateDebugPreview();
        }
    }

    private hasDesktopDebugSpace() {
        // FIT表示時の実ゲーム幅を基準にする。余白が狭いPCでDOMパネルがゲームへ被るのを防ぐ。
        const gameWidth = Math.min(window.innerWidth, window.innerHeight * (VIEW_WIDTH / VIEW_HEIGHT));
        const sideMargin = (window.innerWidth - gameWidth) / 2;
        return window.innerWidth > window.innerHeight && sideMargin >= 350;
    }

    private destroyDesktopDebugPanels() {
        this.desktopStagePanel?.remove();
        this.desktopMotionPanel?.remove();
        this.desktopDebugStyle?.remove();
        this.desktopStagePanel = undefined;
        this.desktopMotionPanel = undefined;
        this.desktopDebugStyle = undefined;
    }

    private ensureDesktopDebugPanels() {
        if (this.desktopStagePanel && this.desktopMotionPanel) return;
        const style = document.createElement('style');
        style.textContent = `
            .tc-remaster-debug { position:fixed; top:18px; z-index:1000; width:326px; max-height:calc(100vh - 36px); overflow:auto; box-sizing:border-box; padding:14px; color:#d9e9f4; background:linear-gradient(160deg,rgba(8,17,29,.98),rgba(4,10,19,.97)); border:1px solid rgba(113,198,223,.72); box-shadow:0 12px 36px rgba(0,0,0,.52), inset 0 0 28px rgba(45,137,173,.08); font-family:Arial,sans-serif; }
            .tc-remaster-debug--stage { left:18px; }
            .tc-remaster-debug--motion { right:18px; }
            .tc-remaster-debug__eyebrow { margin:0 0 4px; color:#7deee7; font-size:10px; font-weight:700; letter-spacing:2px; }
            .tc-remaster-debug h2 { margin:0 0 12px; color:#ffdc57; font-size:16px; letter-spacing:2px; }
            .tc-remaster-debug h3 { margin:14px 0 7px; color:#b9d8eb; font-size:11px; letter-spacing:1.5px; }
            .tc-remaster-debug__hint { margin:0 0 12px; color:#8faabb; font-size:11px; line-height:1.45; }
            .tc-remaster-debug__row { display:grid; grid-template-columns:74px 1fr 48px; gap:7px; align-items:center; margin:8px 0; font-size:10px; font-weight:700; letter-spacing:.6px; }
            .tc-remaster-debug input[type=range] { width:100%; margin:0; accent-color:#75f4ea; }
            .tc-remaster-debug input[type=number], .tc-remaster-debug select { box-sizing:border-box; width:100%; min-width:0; padding:6px 5px; color:#eef8ff; background:#101d2d; border:1px solid #5c7894; border-radius:0; font:700 11px Arial,sans-serif; }
            .tc-remaster-debug select { margin-bottom:4px; }
            .tc-remaster-debug__tabs { display:grid; gap:5px; margin:7px 0; }
            .tc-remaster-debug__tabs--poses { grid-template-columns:repeat(3,1fr); }
            .tc-remaster-debug__tabs--views { grid-template-columns:1fr 1fr; }
            .tc-remaster-debug button { min-height:30px; padding:6px 5px; color:#c8dae8; background:#111f31; border:1px solid #5d7892; border-radius:0; font:700 10px Arial,sans-serif; letter-spacing:.8px; cursor:pointer; }
            .tc-remaster-debug button:hover { border-color:#b9fff7; color:#fff; }
            .tc-remaster-debug button.is-active { color:#fff; border:2px solid var(--debug-accent,#75f4ea); background:#243c50; }
            .tc-remaster-debug button.tc-remaster-debug__effect { color:#fff0ad; border-color:#d7b94d; }
            .tc-remaster-debug__actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:13px; }
            .tc-remaster-debug__actions button:first-child { border-color:#8ee9b6; color:#d7ffe5; }
            .tc-remaster-debug__status { min-height:14px; margin-top:8px; color:#8fe5c0; font-size:10px; letter-spacing:.5px; }
            @media (max-width:1100px) { .tc-remaster-debug { width:292px; padding:11px; } .tc-remaster-debug--stage { left:10px; } .tc-remaster-debug--motion { right:10px; } }
        `;
        document.head.appendChild(style);
        this.desktopDebugStyle = style;

        const stage = document.createElement('aside');
        stage.className = 'tc-remaster-debug tc-remaster-debug--stage';
        stage.setAttribute('aria-label', 'Stage debug tuner');
        const motion = document.createElement('aside');
        motion.className = 'tc-remaster-debug tc-remaster-debug--motion';
        motion.setAttribute('aria-label', 'Motion debug tuner');
        document.body.append(stage, motion);
        this.desktopStagePanel = stage;
        this.desktopMotionPanel = motion;
    }

    private addDesktopField(host: HTMLElement, label: string, min: number, max: number, value: number, step: number, setValue: (value: number) => void, decimal = false) {
        const row = document.createElement('label');
        row.className = 'tc-remaster-debug__row';
        const caption = document.createElement('span');
        caption.textContent = label;
        const range = document.createElement('input');
        range.type = 'range';
        range.min = `${min}`;
        range.max = `${max}`;
        range.step = `${step}`;
        range.value = `${value}`;
        const number = document.createElement('input');
        number.type = 'number';
        number.min = `${min}`;
        number.max = `${max}`;
        number.step = `${step}`;
        number.value = decimal ? value.toFixed(2) : `${Math.round(value)}`;
        const commit = (next: number) => {
            const safe = PhaserMath.Clamp(next, min, max);
            const normalized = decimal ? Math.round(safe * 100) / 100 : Math.round(safe);
            range.value = `${normalized}`;
            number.value = decimal ? normalized.toFixed(2) : `${normalized}`;
            setValue(normalized);
        };
        range.addEventListener('input', () => commit(Number(range.value)));
        number.addEventListener('change', () => commit(Number(number.value)));
        row.append(caption, range, number);
        host.appendChild(row);
    }

    private addDesktopButton(host: HTMLElement, label: string, onClick: () => void, active = false, extraClass = '') {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.className = `${active ? 'is-active ' : ''}${extraClass}`.trim();
        button.style.setProperty('--debug-accent', `#${this.playerFighter.color.toString(16).padStart(6, '0')}`);
        button.addEventListener('click', onClick);
        host.appendChild(button);
        return button;
    }

    private setDesktopStatus(message: string) {
        [this.desktopStagePanel, this.desktopMotionPanel].forEach((panel) => {
            const status = panel?.querySelector<HTMLElement>('.tc-remaster-debug__status');
            if (status) status.textContent = message;
        });
    }

    private renderDesktopDebugPanels() {
        if (!this.desktopDebugEnabled) return;
        this.debugLayer?.destroy();
        this.debugLayer = undefined;
        this.stageTunerLayer?.destroy();
        this.stageTunerLayer = undefined;
        this.ensureDesktopDebugPanels();
        const stage = this.desktopStagePanel!;
        const motion = this.desktopMotionPanel!;
        stage.replaceChildren();
        motion.replaceChildren();

        const stageEyebrow = document.createElement('p');
        stageEyebrow.className = 'tc-remaster-debug__eyebrow';
        stageEyebrow.textContent = 'DEBUG ONLY / ARENA';
        const stageTitle = document.createElement('h2');
        stageTitle.textContent = 'STAGE TUNER';
        const stageHint = document.createElement('p');
        stageHint.className = 'tc-remaster-debug__hint';
        stageHint.textContent = '共通の立ち位置だけを調整。キャラごとの差は右側のポーズ設定で扱う。';
        stage.append(stageEyebrow, stageTitle, stageHint);
        this.addDesktopField(stage, 'PLAYER X', 110, 350, this.stageLayout.playerX, 1, (value) => {
            this.stageLayout.playerX = value;
            this.applyStageLayout();
        });
        this.addDesktopField(stage, 'NPC X', 590, 830, this.stageLayout.npcX, 1, (value) => {
            this.stageLayout.npcX = value;
            this.applyStageLayout();
        });
        this.addDesktopField(stage, 'FIGHTER Y', 960, 1220, this.stageLayout.fighterY, 1, (value) => {
            this.stageLayout.fighterY = value;
            this.applyStageLayout();
        });
        this.addDesktopField(stage, 'ALL SIZE', 0.72, 1.3, this.stageLayout.fighterScale, 0.01, (value) => {
            this.stageLayout.fighterScale = value;
            this.applyStageLayout();
        }, true);
        const stageActions = document.createElement('div');
        stageActions.className = 'tc-remaster-debug__actions';
        this.addDesktopButton(stageActions, 'COPY STAGE', () => {
            this.copyStageTuning();
            this.setDesktopStatus('COPIED STAGE VALUES');
        });
        this.addDesktopButton(stageActions, 'RESET VIEW', () => {
            this.stageLayout = { ...DEFAULT_STAGE_LAYOUT };
            this.applyStageLayout();
            this.renderDesktopDebugPanels();
        });
        stage.appendChild(stageActions);
        const stageStatus = document.createElement('p');
        stageStatus.className = 'tc-remaster-debug__status';
        stage.appendChild(stageStatus);

        const motionEyebrow = document.createElement('p');
        motionEyebrow.className = 'tc-remaster-debug__eyebrow';
        motionEyebrow.textContent = 'DEBUG ONLY / FIGHTER';
        const motionTitle = document.createElement('h2');
        motionTitle.textContent = 'MOTION TUNER';
        const fighterSelect = document.createElement('select');
        FIGHTERS.forEach((fighter) => {
            const option = document.createElement('option');
            option.value = fighter.id;
            option.textContent = `${fighter.name} / ${fighter.subtitle}`;
            option.selected = fighter.id === this.playerFighter.id;
            fighterSelect.appendChild(option);
        });
        fighterSelect.addEventListener('change', () => {
            const fighter = FIGHTERS.find((entry) => entry.id === fighterSelect.value);
            if (fighter) this.switchDebugFighter(fighter);
        });
        motion.append(motionEyebrow, motionTitle, fighterSelect);

        const poseHeading = document.createElement('h3');
        poseHeading.textContent = 'POSE';
        const poseTabs = document.createElement('div');
        poseTabs.className = 'tc-remaster-debug__tabs tc-remaster-debug__tabs--poses';
        (['guard', 'dash', 'attack', 'win', 'lose'] as FighterPose[]).forEach((pose) => {
            this.addDesktopButton(poseTabs, pose.toUpperCase(), () => {
                this.debugAsset = 'pose';
                this.debugPose = pose;
                this.renderDesktopDebugPanels();
                this.updateDebugPreview();
            }, this.debugAsset === 'pose' && this.debugPose === pose);
        });
        motion.append(poseHeading, poseTabs);

        const viewTabs = document.createElement('div');
        viewTabs.className = 'tc-remaster-debug__tabs tc-remaster-debug__tabs--views';
        this.addDesktopButton(viewTabs, 'POSE SETTINGS', () => {
            this.debugAsset = 'pose';
            this.renderDesktopDebugPanels();
            this.updateDebugPreview();
        }, this.debugAsset === 'pose');
        this.addDesktopButton(viewTabs, 'ATTACK EFFECT', () => {
            this.debugAsset = 'effect';
            this.renderDesktopDebugPanels();
            this.updateDebugPreview();
        }, this.debugAsset === 'effect', 'tc-remaster-debug__effect');
        motion.appendChild(viewTabs);

        const fighter = this.playerFighter;
        const effect = fighter.attackEffect!;
        const isEffect = this.debugAsset === 'effect';
        const pose = this.debugPose;
        const propertyHeading = document.createElement('h3');
        propertyHeading.textContent = isEffect ? 'ATTACK EFFECT SETTINGS' : `${pose.toUpperCase()} SETTINGS`;
        motion.appendChild(propertyHeading);
        this.addDesktopField(motion, 'X', -240, 240, isEffect ? effect.offsetX : this.poseOffsetX(fighter, pose), 1, (value) => {
            if (isEffect) effect.offsetX = value;
            else {
                fighter.poseOffsetXs ??= {};
                fighter.poseOffsetXs[pose] = value;
            }
            this.updateDebugPreview();
        });
        this.addDesktopField(motion, 'Y', -240, 240, isEffect ? effect.offsetY : this.poseOffsetY(fighter, pose), 1, (value) => {
            if (isEffect) effect.offsetY = value;
            else {
                fighter.poseOffsetYs ??= {};
                fighter.poseOffsetYs[pose] = value;
            }
            this.updateDebugPreview();
        });
        this.addDesktopField(motion, 'SIZE', isEffect ? 0.08 : 0.10, isEffect ? 0.90 : 1.50, isEffect ? effect.scale : this.poseScale(fighter, pose), 0.01, (value) => {
            if (isEffect) effect.scale = value;
            else {
                fighter.poseScales ??= {};
                fighter.poseScales[pose] = value;
            }
            this.updateDebugPreview();
        }, true);
        const flags = document.createElement('div');
        flags.className = 'tc-remaster-debug__tabs tc-remaster-debug__tabs--views';
        const flip = isEffect ? effect.flip === true : fighter.poseFlipOverrides?.[pose] === true;
        this.addDesktopButton(flags, `FLIP: ${flip ? 'ON' : 'OFF'}`, () => {
            if (isEffect) effect.flip = !flip;
            else {
                fighter.poseFlipOverrides ??= {};
                fighter.poseFlipOverrides[pose] = !flip;
            }
            this.renderDesktopDebugPanels();
            this.updateDebugPreview();
        }, flip);
        if (isEffect) {
            this.addDesktopButton(flags, `LAYER: ${effect.layer.toUpperCase()}`, () => {
                effect.layer = effect.layer === 'front' ? 'behind' : 'front';
                this.renderDesktopDebugPanels();
                this.updateDebugPreview();
            }, effect.layer === 'front', 'tc-remaster-debug__effect');
        }
        motion.appendChild(flags);
        const motionActions = document.createElement('div');
        motionActions.className = 'tc-remaster-debug__actions';
        this.addDesktopButton(motionActions, 'COPY THIS FIGHTER', () => {
            this.copyDebugTuning();
            this.setDesktopStatus(`COPIED ${fighter.name}`);
        });
        this.addDesktopButton(motionActions, 'COPY ALL FIGHTERS', () => {
            this.copyDebugTuning(true);
            this.setDesktopStatus('COPIED ALL FIGHTERS');
        });
        motion.appendChild(motionActions);
        const motionStatus = document.createElement('p');
        motionStatus.className = 'tc-remaster-debug__status';
        motion.appendChild(motionStatus);
    }

    private createDebugTuner() {
        if (this.desktopDebugEnabled) {
            this.renderDesktopDebugPanels();
            return;
        }
        this.debugLayer?.destroy();
        const layer = this.add.container().setDepth(90);
        const toggle = this.add.rectangle(240, 62, 280, 42, 0x10243a, 0.96).setStrokeStyle(2, 0x75f4ea, 0.9).setInteractive({ useHandCursor: true });
        const toggleText = this.add.text(240, 62, this.debugExpanded ? 'MOTION TUNER  −' : 'MOTION TUNER  +', { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#b9fff7', letterSpacing: 2 }).setOrigin(0.5);
        toggle.on('pointerdown', () => {
            this.debugExpanded = !this.debugExpanded;
            this.createDebugTuner();
        });
        layer.add([toggle, toggleText]);
        this.debugLayer = layer;
        if (!this.debugExpanded) return;

        const panel = this.add.rectangle(VIEW_WIDTH / 2, 770, 740, 430, 0x07101c, 0.97).setStrokeStyle(2, 0x5f7890, 1);
        const heading = this.add.text(92, 586, `${this.playerFighter.name}  /  POSE & EFFECT`, { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffdc57', letterSpacing: 2 });
        const hint = this.add.text(92, 608, 'ポーズ別の位置・サイズ・向きを確認。ATTACK EFFECTは攻撃絵と重ねて調整。', { fontFamily: 'Arial, sans-serif', fontSize: '11px', color: '#a8bdcf' });
        layer.add([panel, heading, hint]);

        FIGHTERS.forEach((fighter, index) => {
            const x = 170 + (index % 4) * 200;
            const y = 638 + Math.floor(index / 4) * 34;
            this.addDebugButton(layer, x, y, 176, 27, fighter.name, fighter.id === this.playerFighter.id, () => this.switchDebugFighter(fighter));
        });

        (['guard', 'dash', 'attack', 'win', 'lose'] as FighterPose[]).forEach((pose, index) => {
            this.addDebugButton(layer, 150 + index * 160, 710, 140, 32, pose.toUpperCase(), this.debugAsset === 'pose' && this.debugPose === pose, () => {
                this.debugAsset = 'pose';
                this.debugPose = pose;
                this.createDebugTuner();
                this.updateDebugPreview();
            });
        });

        this.addDebugButton(layer, 290, 754, 320, 32, 'POSE SETTINGS', this.debugAsset === 'pose', () => {
            this.debugAsset = 'pose';
            this.createDebugTuner();
            this.updateDebugPreview();
        });
        this.addDebugButton(layer, 650, 754, 320, 32, 'ATTACK EFFECT', this.debugAsset === 'effect', () => {
            this.debugAsset = 'effect';
            this.createDebugTuner();
            this.updateDebugPreview();
        });

        const fighter = this.playerFighter;
        const effect = fighter.attackEffect!;
        const isEffect = this.debugAsset === 'effect';
        const pose = this.debugPose;
        const xValue = isEffect ? effect.offsetX : this.poseOffsetX(fighter, pose);
        const yValue = isEffect ? effect.offsetY : this.poseOffsetY(fighter, pose);
        const scaleValue = isEffect ? effect.scale : this.poseScale(fighter, pose);
        this.addDebugSlider(layer, 800, 'X', -240, 240, xValue, (value) => {
            if (isEffect) effect.offsetX = Math.round(value);
            else {
                fighter.poseOffsetXs ??= {};
                fighter.poseOffsetXs[pose] = Math.round(value);
            }
        }, false);
        this.addDebugSlider(layer, 845, 'Y', -240, 240, yValue, (value) => {
            if (isEffect) effect.offsetY = Math.round(value);
            else {
                fighter.poseOffsetYs ??= {};
                fighter.poseOffsetYs[pose] = Math.round(value);
            }
        }, false);
        this.addDebugSlider(layer, 890, 'SIZE', isEffect ? 0.08 : 0.10, isEffect ? 0.90 : 1.50, scaleValue, (value) => {
            if (isEffect) effect.scale = Math.round(value * 100) / 100;
            else {
                fighter.poseScales ??= {};
                fighter.poseScales[pose] = Math.round(value * 100) / 100;
            }
        }, true);

        const flip = isEffect ? effect.flip === true : fighter.poseFlipOverrides?.[pose] === true;
        const flipFrame = this.add.rectangle(290, 932, 320, 34, flip ? 0x3d2442 : 0x14243a, 0.98).setStrokeStyle(2, flip ? 0xff79d1 : 0x83a4c7, 0.92).setInteractive({ useHandCursor: true });
        const flipText = this.add.text(290, 932, `FLIP IMAGE: ${flip ? 'ON' : 'OFF'}`, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#edf8ff', letterSpacing: 1 }).setOrigin(0.5);
        flipFrame.on('pointerdown', () => {
            if (isEffect) effect.flip = !flip;
            else {
                fighter.poseFlipOverrides ??= {};
                fighter.poseFlipOverrides[pose] = !flip;
            }
            this.createDebugTuner();
            this.updateDebugPreview();
        });
        layer.add([flipFrame, flipText]);

        if (isEffect) {
            const layerFrame = this.add.rectangle(650, 932, 320, 34, effect.layer === 'front' ? 0x343021 : 0x14243a, 0.98).setStrokeStyle(2, 0xffdc57, 0.92).setInteractive({ useHandCursor: true });
            const layerText = this.add.text(650, 932, `EFFECT LAYER: ${effect.layer.toUpperCase()}`, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#fff1a7', letterSpacing: 1 }).setOrigin(0.5);
            layerFrame.on('pointerdown', () => {
                effect.layer = effect.layer === 'front' ? 'behind' : 'front';
                this.createDebugTuner();
                this.updateDebugPreview();
            });
            layer.add([layerFrame, layerText]);
        }

        const copy = this.add.rectangle(360, 970, 300, 34, 0x203324, 0.98).setStrokeStyle(2, 0x9cf2be, 0.9).setInteractive({ useHandCursor: true });
        const copyText = this.add.text(360, 970, 'COPY THIS FIGHTER', { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#d3ffe4', letterSpacing: 1 }).setOrigin(0.5);
        copy.on('pointerdown', () => this.copyDebugTuning());
        const allCopy = this.add.rectangle(650, 970, 230, 34, 0x1a2638, 0.98).setStrokeStyle(2, 0x9bbce8, 0.9).setInteractive({ useHandCursor: true });
        const allCopyText = this.add.text(650, 970, 'COPY ALL FIGHTERS', { fontFamily: 'Arial, sans-serif', fontSize: '11px', fontStyle: 'bold', color: '#d7e7ff', letterSpacing: 1 }).setOrigin(0.5);
        allCopy.on('pointerdown', () => this.copyDebugTuning(true));
        layer.add([copy, copyText, allCopy, allCopyText]);
    }

    private createStageTuner() {
        if (this.desktopDebugEnabled) {
            this.renderDesktopDebugPanels();
            return;
        }
        this.stageTunerLayer?.destroy();
        const layer = this.add.container().setDepth(92);
        const toggle = this.add.rectangle(700, 62, 280, 42, 0x10243a, 0.96).setStrokeStyle(2, 0x75f4ea, 0.9).setInteractive({ useHandCursor: true });
        const toggleText = this.add.text(700, 62, this.stageTunerExpanded ? 'STAGE TUNER  −' : 'STAGE TUNER  +', { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#b9fff7', letterSpacing: 2 }).setOrigin(0.5);
        toggle.on('pointerdown', () => {
            this.stageTunerExpanded = !this.stageTunerExpanded;
            this.createStageTuner();
        });
        layer.add([toggle, toggleText]);
        this.stageTunerLayer = layer;
        if (!this.stageTunerExpanded) return;

        const panel = this.add.rectangle(VIEW_WIDTH / 2, 250, 740, 278, 0x07101c, 0.97).setStrokeStyle(2, 0x5f7890, 1);
        const heading = this.add.text(92, 137, 'STAGE POSITION  /  DEBUG ONLY', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#ffdc57', letterSpacing: 2 });
        const hint = this.add.text(92, 161, '足場・左右間隔・全体サイズを実機で調整してコピー。', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#a8bdcf' });
        layer.add([panel, heading, hint]);

        this.addStageSlider(layer, 202, 'PLAYER X', 110, 350, this.stageLayout.playerX, (value) => { this.stageLayout.playerX = Math.round(value); });
        this.addStageSlider(layer, 246, 'NPC X', 590, 830, this.stageLayout.npcX, (value) => { this.stageLayout.npcX = Math.round(value); });
        this.addStageSlider(layer, 290, 'FIGHTER Y', 960, 1120, this.stageLayout.fighterY, (value) => { this.stageLayout.fighterY = Math.round(value); });
        this.addStageSlider(layer, 334, 'ALL SIZE', 0.72, 1.3, this.stageLayout.fighterScale, (value) => { this.stageLayout.fighterScale = Math.round(value * 100) / 100; }, true);

        const copy = this.add.rectangle(VIEW_WIDTH / 2, 390, 300, 38, 0x203324, 0.98).setStrokeStyle(2, 0x9cf2be, 0.9).setInteractive({ useHandCursor: true });
        const copyText = this.add.text(VIEW_WIDTH / 2, 390, 'COPY STAGE VALUES', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#d3ffe4', letterSpacing: 1 }).setOrigin(0.5);
        copy.on('pointerdown', () => this.copyStageTuning());
        layer.add([copy, copyText]);
    }

    private addStageSlider(layer: GameObjects.Container, y: number, label: string, min: number, max: number, initial: number, setValue: (value: number) => void, decimal = false) {
        const startX = 334;
        const width = 348;
        let value = initial;
        const display = this.add.text(818, y, decimal ? value.toFixed(2) : `${Math.round(value)}`, { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#eef8ff' }).setOrigin(1, 0.5);
        const caption = this.add.text(106, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#c8dae8', letterSpacing: 1 }).setOrigin(0, 0.5);
        const track = this.add.rectangle(startX + width / 2, y, width, 9, 0x25384c, 1).setInteractive({ useHandCursor: true });
        const knob = this.add.circle(startX + ((value - min) / (max - min)) * width, y, 11, 0x75f4ea, 1).setStrokeStyle(2, 0xffffff, 0.95);
        const applyAt = (worldX: number) => {
            const progress = PhaserMath.Clamp((worldX - startX) / width, 0, 1);
            value = min + (max - min) * progress;
            setValue(value);
            display.setText(decimal ? value.toFixed(2) : `${Math.round(value)}`);
            knob.setX(startX + progress * width);
            this.applyStageLayout();
        };
        track.on('pointerdown', (pointer: Phaser.Input.Pointer) => applyAt(pointer.worldX));
        track.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown) applyAt(pointer.worldX);
        });
        layer.add([caption, track, knob, display]);
    }

    private applyStageLayout() {
        this.tweens.killTweensOf(this.raven);
        this.tweens.killTweensOf(this.mika);
        this.placeFighter(this.raven, this.playerFighter, this.stageLayout.playerX);
        this.placeFighter(this.mika, this.npcFighter, this.stageLayout.npcX);
        this.statusText.setText(`STAGE  Y ${this.stageLayout.fighterY}  /  SCALE ${this.stageLayout.fighterScale.toFixed(2)}`);
    }

    private placeFighter(target: GameObjects.Container, _fighter: FighterDefinition, x: number) {
        target.setPosition(x, this.stageLayout.fighterY).setScale(this.stageLayout.fighterScale);
    }

    private copyStageTuning() {
        const copied = JSON.stringify({ stage: this.stageLayout });
        void navigator.clipboard?.writeText(copied);
        this.statusText.setText(`COPIED: ${copied}`);
    }

    private addDebugButton(layer: GameObjects.Container, x: number, y: number, width: number, height: number, label: string, active: boolean, onClick: () => void) {
        const frame = this.add.rectangle(x, y, width, height, active ? 0x263a52 : 0x121d2d, 1).setStrokeStyle(active ? 2 : 1, active ? this.playerFighter.color : 0x607b97, 1).setInteractive({ useHandCursor: true });
        const text = this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '10px', fontStyle: 'bold', color: active ? '#ffffff' : '#b9c9d8', letterSpacing: 1 }).setOrigin(0.5);
        frame.on('pointerdown', onClick);
        layer.add([frame, text]);
    }

    private addDebugSlider(layer: GameObjects.Container, y: number, label: string, min: number, max: number, value: number, setValue: (value: number) => void, decimal: boolean) {
        const startX = 300;
        const width = 420;
        const display = this.add.text(824, y, decimal ? value.toFixed(2) : `${Math.round(value)}`, { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#eef8ff' }).setOrigin(1, 0.5);
        const caption = this.add.text(106, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#c8dae8', letterSpacing: 1 }).setOrigin(0, 0.5);
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
            this.createStageTuner();
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
        this.setFighterPose(this.raven, this.debugAsset === 'effect' ? 'attack' : this.debugPose);
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
        ).setOrigin(0.5).setScale(effectDefinition.scale).setFlipX(this.shouldFlipEffect(effectDefinition, direction)).setAlpha(0.96).setDepth(effectDefinition.layer === 'front' ? 7 : 3);
    }

    private copyDebugTuning(all = false) {
        const serializePose = (fighter: FighterDefinition, pose: FighterPose) => ({
            x: this.poseOffsetX(fighter, pose),
            y: this.poseOffsetY(fighter, pose),
            scale: this.poseScale(fighter, pose),
            flip: fighter.poseFlipOverrides?.[pose] === true
        });
        const serialize = (fighter: FighterDefinition) => ({
            guard: serializePose(fighter, 'guard'),
            dash: serializePose(fighter, 'dash'),
            attack: serializePose(fighter, 'attack'),
            win: serializePose(fighter, 'win'),
            lose: serializePose(fighter, 'lose'),
            effect: {
                x: fighter.attackEffect?.offsetX,
                y: fighter.attackEffect?.offsetY,
                scale: fighter.attackEffect?.scale,
                flip: fighter.attackEffect?.flip === true,
                layer: fighter.attackEffect?.layer
            }
        });
        const value = all
            ? Object.fromEntries(FIGHTERS.map((fighter) => [fighter.id, serialize(fighter)]))
            : { [this.playerFighter.id]: serialize(this.playerFighter) };
        const copied = JSON.stringify(value);
        void navigator.clipboard?.writeText(copied);
        this.statusText.setText(`COPIED: ${copied}`);
    }

    private createHud() {
        this.countdownArt = this.add.image(VIEW_WIDTH / 2, 450, 'countdown-3').setDepth(11).setVisible(false);
        this.promptText = this.add.text(VIEW_WIDTH / 2, 450, '', { fontFamily: 'Arial, sans-serif', fontSize: '118px', fontStyle: 'bold', color: '#eff8ff', stroke: '#0d1722', strokeThickness: 14, letterSpacing: 8, align: 'center' }).setOrigin(0.5).setDepth(11);
        this.statusText = this.add.text(VIEW_WIDTH / 2, 555, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#b6d6e6', letterSpacing: 2, align: 'center' }).setOrigin(0.5);
        this.scoreText = this.add.text(244, 888, '', { fontFamily: 'Arial, sans-serif', fontSize: '42px', fontStyle: 'bold', color: '#fff2a6', stroke: '#111923', strokeThickness: 8 }).setOrigin(0.5).setVisible(false);
    }

    private hideCountdownChrome() {
        this.tweens.killTweensOf(this.countdownArt);
        this.countdownArt.setVisible(false).setAlpha(0).setScale(1);
    }

    private showCountdown(value: CountdownValue) {
        const art = COUNTDOWN_ART[value];
        this.tweens.killTweensOf(this.countdownArt);
        this.promptText.setVisible(false);
        this.countdownArt.setTexture(art.key);
        const baseScaleX = art.width / this.countdownArt.width;
        const baseScaleY = art.height / this.countdownArt.height;
        this.countdownArt
            .setAlpha(1)
            .setScale(baseScaleX * 0.82, baseScaleY * 0.82)
            .setVisible(true);
        this.tweens.add({
            targets: this.countdownArt,
            scaleX: baseScaleX * 1.06,
            scaleY: baseScaleY * 1.06,
            duration: 190,
            ease: 'Quad.easeOut',
            yoyo: true
        });
    }

    private resetDuel() {
        this.state = 'idle';
        this.lastActionAt = -Infinity;
        this.resultLayer?.destroy();
        this.resultLayer = undefined;
        this.tweens.killTweensOf(this.cameras.main);
        this.cameras.main.setZoom(1);
        this.placeFighter(this.raven, this.playerFighter, this.stageLayout.playerX);
        this.placeFighter(this.mika, this.npcFighter, this.stageLayout.npcX);
        this.raven.setAlpha(1);
        this.mika.setAlpha(1);
        this.setFighterPose(this.raven, 'guard');
        this.setFighterPose(this.mika, 'guard');
        this.scoreText.setVisible(false);
        this.hideCountdownChrome();
        this.promptText.setVisible(true).setText('READY');
        this.promptText.setFontSize(48).setLetterSpacing(6).setColor('#d6eaff');
        this.statusText.setText('TAP OR SPACE TO START');
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
        this.showCountdown('3');
        this.statusText.setText('');
        this.cameras.main.zoomTo(1.025, 260, 'Sine.easeOut');
        this.time.delayedCall(700, () => {
            if (this.state !== 'countdown') return;
            this.showCountdown('2');
        });
        this.time.delayedCall(1400, () => {
            if (this.state !== 'countdown') return;
            this.showCountdown('1');
        });
        // 同じ拍子を覚えられないよう、最後の待機だけを毎回ずらす。
        this.time.delayedCall(2100 + PhaserMath.Between(400, 1600), () => {
            if (this.state !== 'countdown') return;
            this.state = 'reaction';
            this.reactionStartedAt = this.time.now;
            this.setFighterPose(this.raven, 'dash');
            this.setFighterPose(this.mika, 'dash');
            this.showCountdown('FIGHT');
            this.statusText.setText('CLICK / SPACE');
            this.flashArena(0x8dfff0, 0.38, 140);
            this.cameras.main.shake(110, 0.006);
        });
    }

    private finishDuel(playerMs: number | undefined, falseStart: boolean) {
        this.state = 'settling';
        this.hideCountdownChrome();
        this.promptText.setVisible(true);
        this.scoreText.setVisible(true);
        const npcMs = PhaserMath.Between(135, 230);
        const playerWins = !falseStart && playerMs !== undefined && playerMs < npcMs;
        this.scoreText.setText(falseStart ? 'FLYING' : `${playerMs}ms`);
        this.scoreText.setColor(falseStart ? '#ff6475' : playerWins ? '#8dfff0' : '#ffcc69');
        this.promptText.setFontSize(34).setLetterSpacing(4).setColor('#eff8ff').setText(playerWins ? `${this.playerFighter.name} WINS` : `${this.npcFighter.name} WINS`);
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
        ).setOrigin(0.5).setScale(effectDefinition.scale * 0.76).setFlipX(this.shouldFlipEffect(effectDefinition, direction)).setAlpha(0).setDepth(effectDefinition.layer === 'front' ? 7 : 3);

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
        const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x04070c, 0.66);
        const panel = this.add.rectangle(VIEW_WIDTH / 2, 1430, 680, 152, 0x101925, 0.96).setStrokeStyle(2, playerWins ? 0x65ffe2 : 0xffc15c, 0.9);
        const text = this.add.text(VIEW_WIDTH / 2, 1402, falseStart ? 'TAP / SPACE  TO RETRY' : playerWins ? 'TAP / SPACE  TO CLAIM THE TITLE' : 'TAP / SPACE  TO REMATCH', { fontFamily: 'Arial, sans-serif', fontSize: '16px', fontStyle: 'bold', color: '#edf5fb', letterSpacing: 2 }).setOrigin(0.5);
        const detail = this.add.text(VIEW_WIDTH / 2, 1448, playerWins ? 'NEXT: CHAMPION ENTRY' : 'NEXT: INSTANT REMATCH', { fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#94a9ba', letterSpacing: 2 }).setOrigin(0.5);
        this.resultLayer = this.add.container(0, 44, [shade, panel, text, detail]);
        this.resultLayer.setDepth(20).setAlpha(0);
        this.tweens.add({ targets: this.resultLayer, y: 0, alpha: 1, duration: 220, ease: 'Quad.easeOut' });
        this.cameras.main.zoomTo(1, 360, 'Sine.easeOut');
    }
}
