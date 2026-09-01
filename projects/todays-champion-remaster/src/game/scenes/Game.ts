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
type GateCharacterState = 'lineup' | 'selected';
type GateCharacterLayout = { x: number; y: number; scale: number };
type RectLayout = { x: number; y: number; width: number; height: number };
type SummonStageLayout = {
    title: RectLayout;
    miniGate: { x: number; y: number; width: number; height: number; gap: number };
    gate: RectLayout;
    interior: RectLayout;
    character: { baseline: number; height: number };
    hintY: number;
    cta: RectLayout;
};

// 縦持ち実機を基準にする。PCでは余白を許容し、無理に横長へ引き伸ばさない。
const VIEW_WIDTH = 941;
const VIEW_HEIGHT = 1672;
const DEFAULT_STAGE_LAYOUT = { playerX: 244, npcX: 697, fighterY: 1107, fighterScale: 1 };
// 見出しはキャラ制作前に全員共通で決める。個別のゲートで位置を変えると、
// 立ち絵を同じ距離感・同じ安全領域へ揃えられなくなるため、ここでは共通値だけを持つ。
const DEFAULT_GATE_HEADER_LAYOUT = {
    numberY: -391, numberSize: 19,
    markY: -338, markSize: 75,
    nameY: -286, nameSize: 20,
    subtitleY: -265, subtitleSize: 13
};
// 素材を作る前に、参考モックの構図を基準キャンバスへ固定する。
// 大門は横へ広く、内側は背景素材専用の空き窓として扱う。
const DEFAULT_SUMMON_STAGE_LAYOUT: SummonStageLayout = {
    title: { x: 60, y: 64, width: 820, height: 166 },
    miniGate: { x: 88, y: 254, width: 90, height: 284, gap: 22 },
    gate: { x: 84, y: 561, width: 772, height: 790 },
    interior: { x: 178, y: 660, width: 585, height: 692 },
    character: { baseline: 1390, height: 727 },
    hintY: 1465,
    cta: { x: 130, y: 1445, width: 680, height: 170 }
};
// 実機のGATE TUNERでユーザーが全14状態を見比べて確定した構図。
// 通常／選択は別々に持ち、リセットしてもこの安全な位置・サイズへ戻す。
const DEFAULT_GATE_CHARACTER_LAYOUTS: Record<string, Record<GateCharacterState, GateCharacterLayout>> = {
    raven: { lineup: { x: -49, y: 49, scale: 1.08 }, selected: { x: 9, y: 51, scale: 1 } },
    mika: { lineup: { x: -21, y: 80, scale: 0.91 }, selected: { x: 22, y: 86, scale: 0.88 } },
    brick: { lineup: { x: -19, y: 85, scale: 0.88 }, selected: { x: 0, y: 98, scale: 0.83 } },
    noise: { lineup: { x: -12, y: 55, scale: 1.07 }, selected: { x: 0, y: 51, scale: 1 } },
    kiri: { lineup: { x: -3, y: 42, scale: 1.11 }, selected: { x: -2, y: 29, scale: 1.1 } },
    vivi: { lineup: { x: -8, y: 38, scale: 1.14 }, selected: { x: -5, y: 32, scale: 1.09 } },
    tomega9: { lineup: { x: 0, y: 94, scale: 1 }, selected: { x: -11, y: 95, scale: 0.93 } }
};
// 第二完成系は7枚を常時固定する。縦持ちENVELOPで左右が切れる端末でも外枠が残る安全域。
const SELECT_GATE_SLOTS = [140, 250, 360, 470, 580, 690, 800];
// 境界線より少しだけ路面へ入れる。線上で止めるより、ゲートが濡れた地面に立って見える。
const SELECT_GATE_Y = 822;
const GATE_DISPLAY_WIDTH = 110;
const GATE_DISPLAY_HEIGHT = 850;
// 枠v3の透明開口(370×3369 / 450×3477)と同じ表示寸法。暗幕だけ旧キャラ窓の
// 高さにすると、その始終端が背景の横線に見えるため、内側へ重ねる全要素で共用する。
const GATE_OPENING_WIDTH = GATE_DISPLAY_WIDTH * 370 / 450;
const GATE_OPENING_HEIGHT = GATE_DISPLAY_HEIGHT * 3385 / 3477;
// 選択中だけは隣のゲート1本分強まで開く。7人の整列は残しつつ、衣装・武器・翼などの横情報を読ませる。
const SELECTED_GATE_REVEAL_WIDTH = 250;
// 原画を先に枠幅で切ると、位置調整時に存在しない画素を引っ張ることになる。
// この規格は表示上の身長と足元だけを共通化し、横方向は各原画を残したまま開口で切る。
const GATE_CHARACTER_CANVAS_HEIGHT = 3137;
const GATE_CHARACTER_BASELINE = 3070;
const GATE_CHARACTER_CANVAS_SCALE = 767 / GATE_CHARACTER_CANVAS_HEIGHT;
const GATE_CHARACTER_DISPLAY_HEIGHTS: Record<string, number> = { raven: 2400, mika: 2400, brick: 2250, noise: 2250, kiri: 2540, vivi: 2325, tomega9: 2250 };
const FIGHTERS: FighterDefinition[] = [
    { id: 'raven', name: 'RAVEN', subtitle: 'ZERO BLADE', color: 0x55dffc, portraitKey: 'portrait-raven', gateLineupKey: 'gate-raven-lineup', gateSelectedKey: 'gate-raven-selected', combatKey: 'guard-raven', combatScale: 0.42, naturalFacing: 'left', poseFacing: { dash: 'right', attack: 'right', win: 'right', lose: 'right' }, poseFlipOverrides: { win: true, lose: true }, poseScales: { guard: 0.42, dash: 0.42, attack: 0.43, win: 0.49, lose: 0.32 }, poseOffsetYs: { win: 10 }, attackEffect: { scale: 0.29, offsetX: 57, offsetY: -60, layer: 'front' } },
    { id: 'mika', name: 'MIKA', subtitle: 'PINK RIOT', color: 0xff5ca8, portraitKey: 'portrait-mika', gateLineupKey: 'gate-mika-lineup', gateSelectedKey: 'gate-mika-selected', combatKey: 'guard-mika', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.42, dash: 0.42, attack: 0.47, win: 0.50, lose: 0.33 }, poseOffsetYs: { win: 10 }, attackEffect: { scale: 0.27, offsetX: 67, offsetY: -83, layer: 'front' } },
    { id: 'brick', name: 'BRICK', subtitle: 'IRON FIST', color: 0xffb14f, portraitKey: 'portrait-brick', gateLineupKey: 'gate-brick-lineup', gateSelectedKey: 'gate-brick-selected', combatKey: 'guard-brick', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.50, dash: 0.48, attack: 0.50, win: 0.72, lose: 0.34 }, poseOffsetYs: { guard: 7, win: 20 }, attackEffect: { scale: 0.31, offsetX: 47, offsetY: -160, layer: 'behind' } },
    { id: 'noise', name: 'NOISE', subtitle: 'BEAT BRKR', color: 0xa776ff, portraitKey: 'portrait-noise', gateLineupKey: 'gate-noise-lineup', gateSelectedKey: 'gate-noise-selected', combatKey: 'guard-noise', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right' }, poseFlipOverrides: { guard: true, lose: true }, poseScales: { guard: 0.45, dash: 0.41, attack: 0.46, win: 0.52, lose: 0.33 }, poseOffsetYs: { win: 17 }, attackEffect: { scale: 0.31, offsetX: 123, offsetY: -113, layer: 'behind' } },
    { id: 'kiri', name: 'KIRI', subtitle: 'GHOST SIG', color: 0xb1c4f6, portraitKey: 'portrait-kiri', gateLineupKey: 'gate-kiri-lineup', gateSelectedKey: 'gate-kiri-selected', combatKey: 'guard-kiri', combatScale: 0.42, naturalFacing: 'right', poseFacing: { attack: 'right', win: 'left', lose: 'left' }, poseFlipOverrides: { lose: true }, poseScales: { guard: 0.41, dash: 0.41, attack: 0.63, win: 0.58, lose: 0.31 }, poseOffsetYs: { attack: 60, win: 20, lose: -7 }, attackEffect: { scale: 0.32, offsetX: 70, offsetY: -17, layer: 'behind' } },
    { id: 'vivi', name: 'VIVI', subtitle: 'TWO-FACED', color: 0xf0d59b, portraitKey: 'portrait-vivi', gateLineupKey: 'gate-vivi-lineup', gateSelectedKey: 'gate-vivi-selected', combatKey: 'guard-vivi', combatScale: 0.19, naturalFacing: 'right', poseScales: { guard: 0.25, dash: 0.25, attack: 0.25, win: 0.23, lose: 0.19 }, poseOffsetYs: { guard: 27, dash: -7, attack: 40, win: 3 }, attackEffect: { scale: 0.39, offsetX: 240, offsetY: -70, layer: 'behind' } },
    { id: 'tomega9', name: 'TΩ9', subtitle: 'DRUNK BEAST', color: 0xff534c, portraitKey: 'portrait-tomega9', gateLineupKey: 'gate-tomega9-lineup', gateSelectedKey: 'gate-tomega9-selected', combatKey: 'guard-tomega9', combatScale: 0.19, naturalFacing: 'right', poseScales: { guard: 0.35, dash: 0.34, attack: 0.33, win: 0.34, lose: 0.31 }, poseOffsetYs: { attack: 20 }, attackEffect: { scale: 0.49, offsetX: 147, offsetY: -90, layer: 'behind' } }
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
    private selectionOpeningMasks = new Map<string, GameObjects.Graphics>();
    private selectionSwipeStart?: { x: number; y: number };
    private reactionStartedAt = 0;
    private lastActionAt = -Infinity;
    private resultLayer?: GameObjects.Container;
    private motionPreviewLayer?: GameObjects.Container;
    private motionPreviewEnabled = false;
    private debugEnabled = false;
    private summonStagePreviewEnabled = false;
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
    private gateHeaderLayout = { ...DEFAULT_GATE_HEADER_LAYOUT };
    private gateHeaderTuner?: HTMLDetailsElement;
    private gateHeaderTunerStyle?: HTMLStyleElement;
    private gateHeaderTunerOpen = false;
    private gateHeaderTunerPosition: 'top' | 'bottom' = 'bottom';
    private summonStageTuner?: HTMLDetailsElement;
    private summonStageTunerStyle?: HTMLStyleElement;
    private summonStageGuide?: GameObjects.Container;
    private summonStageLayout: SummonStageLayout = JSON.parse(JSON.stringify(DEFAULT_SUMMON_STAGE_LAYOUT));
    private gateCharacterTunerFighterId = 'raven';
    private gateCharacterTunerState: GateCharacterState = 'lineup';
    private gateCharacterLayouts = Object.fromEntries(FIGHTERS.map((fighter) => [fighter.id, {
        lineup: { ...DEFAULT_GATE_CHARACTER_LAYOUTS[fighter.id].lineup },
        selected: { ...DEFAULT_GATE_CHARACTER_LAYOUTS[fighter.id].selected }
    }])) as Record<string, Record<GateCharacterState, GateCharacterLayout>>;
    private flash!: GameObjects.Rectangle;

    constructor() {
        super('Game');
    }

    preload() {
        this.load.image('stage-mobile', 'assets/stages/neon-crosswalk-mobile-v3.webp');
        this.load.image('select-bg-mobile', 'assets/championship-re/select/select-bg-final-v2.webp');
        this.load.image('summon-stage-preview-bg', 'assets/championship-re/select/summon-stage-preview-bg-v2.webp');
        FIGHTERS.forEach((fighter) => this.load.image(`summon-gate-${fighter.id}`, `assets/championship-re/summon/summon-gate-${fighter.id}-final-v2.webp`));
        this.load.image('championship-re-title', 'assets/championship-re/ui/championship-re-title-final-v3.webp');
        this.load.image('championship-re-start-duel', 'assets/championship-re/ui/start-duel-final-v1.webp');
        this.load.image('championship-re-frame-normal', 'assets/championship-re/frames/championship-re-frame-normal-final-v3.webp');
        this.load.image('championship-re-frame-select', 'assets/championship-re/frames/championship-re-frame-select-final-v3.webp');
        FIGHTERS.forEach((fighter) => {
            this.load.image(`gate-icon-${fighter.id}`, `assets/championship-re/icons/gate-icon-${fighter.id}-art-v1.webp`);
            this.load.image(`gate-interior-${fighter.id}`, `assets/championship-re/gates/interiors/gate-interior-${fighter.id}-v1.webp`);
            this.load.image(fighter.gateLineupKey!, `assets/championship-re/gates/characters/gate-character-${fighter.id}-lineup-v8.webp`);
            this.load.image(fighter.gateSelectedKey!, `assets/championship-re/gates/characters/gate-character-${fighter.id}-selected-v8.webp`);
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
        this.summonStagePreviewEnabled = this.debugEnabled && params.has('layout');
        this.desktopDebugEnabled = this.debugEnabled && this.hasDesktopDebugSpace();
        this.events.once('shutdown', () => {
            this.destroyDesktopDebugPanels();
            this.destroyGateHeaderTuner();
            this.destroySummonStageTuner();
        });
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
        // 大型召喚ステージの確認時だけ、門・人物を焼き込んでいない外側背景へ差し替える。
        // 通常の7ゲート選択画面は既存背景のまま残し、構図確認の結果だけを切り離して判断する。
        const selectBackgroundKey = this.summonStagePreviewEnabled ? 'summon-stage-preview-bg' : 'select-bg-mobile';
        const selectBackground = this.add.image(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, selectBackgroundKey).setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
        const shade = this.add.rectangle(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, VIEW_WIDTH, VIEW_HEIGHT, 0x02060d, 0.08);
        const upperShade = this.add.rectangle(VIEW_WIDTH / 2, 180, VIEW_WIDTH, 360, 0x050a13, 0.24);
        layer.add([selectBackground, shade, upperShade]);

        const gameBase = this.add.text(110, 60, '← GAME BASE', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#d9efff', letterSpacing: 2 }).setInteractive({ useHandCursor: true });
        gameBase.on('pointerdown', () => { window.location.href = '../..'; });
        const archive = this.add.text(VIEW_WIDTH - 110, 60, 'CHARACTER ARCHIVE →', { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#d9efff', letterSpacing: 1.2 }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
        archive.on('pointerdown', () => { window.location.href = 'character-archive.html'; });
        // タイトル枠は最大安全領域。ロゴ自体は元の比率を守って中央へ収め、
        // 左右上端のGAME BASE／ARCHIVE導線を避ける。
        const titleSafeArea = this.summonStagePreviewEnabled
            ? this.summonStageLayout.title
            : { x: 60, y: 142, width: 820, height: 205 };
        const titleLogo = this.add.image(
            titleSafeArea.x + titleSafeArea.width / 2,
            titleSafeArea.y + titleSafeArea.height / 2,
            'championship-re-title'
        );
        const titleScale = Math.min(titleSafeArea.width / titleLogo.width, titleSafeArea.height / titleLogo.height);
        titleLogo.setDisplaySize(titleLogo.width * titleScale, titleLogo.height * titleScale);
        this.selectTitle = this.add.text(VIEW_WIDTH / 2, 330, '', { fontFamily: 'Arial, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#f5d45e', letterSpacing: 4 }).setOrigin(0.5).setVisible(false);
        layer.add([gameBase, archive, titleLogo, this.selectTitle]);

        // 採用構図は「7本のゲートそのものが主役」。別の大型モニターは置かない。
        // 選択操作の案内はゲート群から切り離し、開始CTAの直前で次の行動として読ませる。
        const selectedHint = this.add.text(VIEW_WIDTH / 2, 1360, 'TAP A GATE   |   SWIPE TO SELECT', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#d9e6ef', letterSpacing: 3 }).setOrigin(0.5);
        layer.add([selectedHint]);
        this.selectionLayer = layer;
        this.selectionOpeningMasks.forEach((mask) => mask.destroy());
        this.selectionOpeningMasks.clear();
        this.selectionFrames.clear();
        this.selectionCards.clear();

        if (this.summonStagePreviewEnabled) {
            // 完成画面を作り込む前に、実キャンバス上で各素材の占有領域を決める。
            // 既存の細いゲートは出さず、ここでは「何をどこへ置くか」だけを確認する。
            this.createSummonStagePreview(layer);
            this.createSummonStageTuner();
            return;
        }

        FIGHTERS.forEach((fighter, index) => this.createSelectionCard(fighter, index));
        this.selectFighter(this.selectedFighter, true);
        this.createGateHeaderTuner();

        // CTAは床の反射だけが残る下部デッドゾーンより上へ、透過素材として置く。
        const startButton = this.add.image(VIEW_WIDTH / 2, 1460, 'championship-re-start-duel').setDisplaySize(680, 170).setInteractive({ useHandCursor: true });
        startButton.on('pointerdown', () => this.startSelectedDuel());
        startButton.on('pointerover', () => startButton.setAlpha(0.92));
        startButton.on('pointerout', () => startButton.setAlpha(1));
        layer.add(startButton);
    }

    private createSummonStagePreview(layer: GameObjects.Container) {
        this.summonStageGuide?.destroy();
        const guide = this.add.container().setDepth(8);
        const layout = this.summonStageLayout;
        const addBox = (box: RectLayout, color: number, alpha: number, label: string) => {
            const rect = this.add.rectangle(box.x, box.y, box.width, box.height, color, alpha).setOrigin(0).setStrokeStyle(3, color, 0.95);
            const text = this.add.text(box.x + 10, box.y + 10, label, { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#f4fbff', letterSpacing: 1.2 });
            guide.add([rect, text]);
        };
        const mini = layout.miniGate;
        addBox(layout.title, 0xf2cf70, 0.08, `TITLE  ${layout.title.width} × ${layout.title.height}`);
        FIGHTERS.forEach((fighter, index) => {
            const x = mini.x + index * (mini.width + mini.gap);
            // 大型門の切替先と上段ロスターの強調を同じ選択状態へ揃える。
            // 固定のVIVI強調のままだと、タップが反映されたか見分けられない。
            const selected = fighter.id === this.selectedFighter.id;
            const scale = selected ? 1.06 : 1;
            const y = mini.y - (selected ? 12 : 0);
            const gate = this.add.rectangle(x, y, mini.width, mini.height, fighter.color, selected ? 0.34 : 0.16).setOrigin(0).setStrokeStyle(selected ? 4 : 2, fighter.color, 0.98).setScale(scale).setInteractive({ useHandCursor: true });
            gate.on('pointerdown', () => {
                this.selectedFighter = fighter;
                this.createSummonStagePreview(this.selectionLayer!);
                this.createSummonStageTuner();
            });
            const number = this.add.text(x + mini.width / 2, y + 34, `0${index + 1}`, { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#eefaff' }).setOrigin(0.5).setScale(scale);
            // setDisplaySize後にsetScaleすると元画像の巨大な寸法へ戻るため、選択時の拡大分も表示寸法へ含める。
            const icon = this.add.image(x + mini.width / 2, y + 104, `gate-icon-${fighter.id}`).setDisplaySize(52 * scale, 52 * scale).setTint(this.gateHeaderTint(fighter.color));
            const name = this.add.text(x + mini.width / 2, y + 184, fighter.name, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: this.gateHeaderTextColor(fighter.color) }).setOrigin(0.5).setScale(scale);
            const role = this.add.text(x + mini.width / 2, y + 207, fighter.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: '8px', fontStyle: 'bold', color: '#dce9f4' }).setOrigin(0.5).setScale(scale);
            guide.add([gate, number, icon, name, role]);
        });
        // 各キャラの門は共通寸法だけを揃え、意匠はロスター選択と連動して切り替える。
        // ガイド枠は門の実占有領域を見失わないよう上から薄く残す。
        const summonGate = this.add.image(layout.gate.x + layout.gate.width / 2, layout.gate.y + layout.gate.height / 2, `summon-gate-${this.selectedFighter.id}`).setDisplaySize(layout.gate.width, layout.gate.height);
        guide.add(summonGate);
        addBox(layout.gate, 0xe8c878, 0.1, `SUMMON GATE  ${layout.gate.width} × ${layout.gate.height}`);
        addBox(layout.interior, 0x7257d6, 0.22, `DIMENSION BG  ${layout.interior.width} × ${layout.interior.height}`);
        const characterTop = layout.character.baseline - layout.character.height;
        const character = this.add.rectangle(VIEW_WIDTH / 2 - 180, characterTop, 360, layout.character.height, 0x5ff1cf, 0.08).setOrigin(0).setStrokeStyle(3, 0x5ff1cf, 0.95);
        const characterLabel = this.add.text(VIEW_WIDTH / 2, characterTop + 16, `CHARACTER SAFE AREA  H=${layout.character.height}`, { fontFamily: 'Arial, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#baffed', letterSpacing: 1 }).setOrigin(0.5);
        const baseline = this.add.rectangle(100, layout.character.baseline, VIEW_WIDTH - 200, 3, 0x5ff1cf, 0.98).setOrigin(0, 0.5);
        const baselineLabel = this.add.text(108, layout.character.baseline - 23, `FOOT BASELINE  Y=${layout.character.baseline}`, { fontFamily: 'Arial, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#baffed', letterSpacing: 1 });
        guide.add([character, characterLabel, baseline, baselineLabel]);
        const hint = this.add.text(VIEW_WIDTH / 2, layout.hintY, 'SWIPE TO SELECT', { fontFamily: 'Arial, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#e3ecf6', letterSpacing: 3 }).setOrigin(0.5);
        const cta = this.add.rectangle(layout.cta.x, layout.cta.y, layout.cta.width, layout.cta.height, 0xe8c878, 0.16).setOrigin(0).setStrokeStyle(3, 0xe8c878, 0.95);
        const ctaLabel = this.add.text(layout.cta.x + layout.cta.width / 2, layout.cta.y + layout.cta.height / 2, `START DUEL  ${layout.cta.width} × ${layout.cta.height}`, { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#ffedb2', letterSpacing: 3 }).setOrigin(0.5);
        guide.add([hint, cta, ctaLabel]);
        layer.add(guide);
        this.summonStageGuide = guide;
    }

    private createSelectionCard(fighter: FighterDefinition, index: number) {
        const x = SELECT_GATE_SLOTS[index];
        const y = SELECT_GATE_Y;
        const card = this.add.container(x, y);
        // 背景は枠の外寸を完全に埋め、人物だけを透明窓の内寸に合わせる。両者を同じ内寸にすると上下に抜けが残る。
        const interiorArtScale = 850 / 3477;
        const interiorArt = this.add.image(0, 0, `gate-interior-${fighter.id}`).setOrigin(0.5).setScale(interiorArtScale);
        const lineupLayout = this.gateCharacterLayouts[fighter.id].lineup;
        const selectedLayout = this.gateCharacterLayouts[fighter.id].selected;
        const lineupArt = this.add.image(lineupLayout.x, this.gateCharacterBaseY(fighter) + lineupLayout.y, fighter.gateLineupKey!).setOrigin(0.5);
        const selectedArt = this.add.image(selectedLayout.x, this.gateCharacterBaseY(fighter) + selectedLayout.y, fighter.gateSelectedKey!).setOrigin(0.5).setVisible(false);
        lineupArt.setScale(this.gateCharacterBaseScale(fighter, lineupArt) * lineupLayout.scale);
        selectedArt.setScale(this.gateCharacterBaseScale(fighter, selectedArt) * selectedLayout.scale);
        // 原画は広く残し、見える範囲だけをゲートの透明開口へ限定する。
        // maskはカード移動と同じ座標を使うため、選択時の前進演出でも枠からずれない。
        const openingMaskShape = this.make.graphics({ x, y }, false);
        this.drawGateOpeningMask(openingMaskShape, GATE_OPENING_WIDTH);
        // WebGLではGeometryMaskが効かないため、Phaser 4の外部Maskフィルタを使う。
        // この方式ならカードと同じworld座標の矩形だけを描画し、隣のゲートへは漏れない。
        lineupArt.enableFilters().filters!.external.addMask(openingMaskShape, false, this.cameras.main, 'world');
        selectedArt.enableFilters().filters!.external.addMask(openingMaskShape, false, this.cameras.main, 'world');
        const windowShade = this.add.rectangle(0, 0, GATE_OPENING_WIDTH, GATE_OPENING_HEIGHT, 0x02070e, 0.42);
        const accent = this.add.rectangle(0, 0, 96, GATE_OPENING_HEIGHT, fighter.color, 0.16).setStrokeStyle(2, fighter.color, 0.7);
        // 枠v3の上下キャップ直前まで届く長さに揃える。選択だけ別寸にすると、
        // 点灯が上端で途切れたように見えるため、通常・選択で同じレールを使う。
        const leftAccentRail = this.add.rectangle(-46, 0, 3, GATE_OPENING_HEIGHT, fighter.color, 0.68);
        const rightAccentRail = this.add.rectangle(46, 0, 3, GATE_OPENING_HEIGHT, fighter.color, 0.68);
        const frame = this.add.image(0, 0, 'championship-re-frame-normal').setOrigin(0.5).setDisplaySize(GATE_DISPLAY_WIDTH, GATE_DISPLAY_HEIGHT);
        // 本体規格は共通。選択時だけは手前へ出る分を小さく拡大し、足元Yは地面ラインへ戻す。
        const selectedFrame = this.add.image(0, 0, 'championship-re-frame-select').setOrigin(0.5).setDisplaySize(GATE_DISPLAY_WIDTH, GATE_DISPLAY_HEIGHT).setVisible(false);
        // 番号→マーク→名前→肩書きを先に固定する。立ち絵はこの見出しブロックの下から描く。
        const headerColor = this.gateHeaderTextColor(fighter.color);
        const number = this.add.text(0, this.gateHeaderLayout.numberY, `0${index + 1}`, { fontFamily: 'Arial, sans-serif', fontSize: `${this.gateHeaderLayout.numberSize}px`, fontStyle: 'bold', color: headerColor, letterSpacing: 1 }).setOrigin(0.5);
        // 色をベタにせず少し白へ寄せる。暗い背景でも細い線画の密度を潰さず、レール色ともつながる。
        const mark = this.add.image(0, this.gateHeaderLayout.markY, `gate-icon-${fighter.id}`).setOrigin(0.5).setDisplaySize(this.gateHeaderLayout.markSize, this.gateHeaderLayout.markSize).setTint(this.gateHeaderTint(fighter.color));
        const name = this.add.text(0, this.gateHeaderLayout.nameY, fighter.name, { fontFamily: 'Arial, sans-serif', fontSize: `${this.gateHeaderLayout.nameSize}px`, fontStyle: 'bold', color: headerColor, letterSpacing: 0.5 }).setOrigin(0.5);
        const subtitle = this.add.text(0, this.gateHeaderLayout.subtitleY, fighter.subtitle, { fontFamily: 'Arial, sans-serif', fontSize: `${this.gateHeaderLayout.subtitleSize}px`, fontStyle: 'bold', color: headerColor, letterSpacing: 0.2, align: 'center' }).setOrigin(0.5);
        const hit = this.add.rectangle(0, 0, GATE_DISPLAY_WIDTH, GATE_DISPLAY_HEIGHT, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => this.selectFighter(fighter));
        card.setData('fighter', fighter);
        card.setData('lineupArt', lineupArt);
        card.setData('selectedArt', selectedArt);
        card.setData('openingMaskShape', openingMaskShape);
        card.setData('windowShade', windowShade);
        card.setData('lineupFrame', frame);
        card.setData('selectedFrame', selectedFrame);
        card.setData('accent', accent);
        card.setData('leftAccentRail', leftAccentRail);
        card.setData('rightAccentRail', rightAccentRail);
        card.setData('mark', mark);
        card.setData('number', number);
        card.setData('name', name);
        card.setData('subtitle', subtitle);
        card.setData('hit', hit);
        card.add([interiorArt, lineupArt, selectedArt, windowShade, accent, frame, selectedFrame, leftAccentRail, rightAccentRail, number, mark, name, subtitle, hit]);
        this.selectionLayer?.add(card);
        this.selectionFrames.set(fighter.id, frame);
        this.selectionCards.set(fighter.id, card);
        this.selectionOpeningMasks.set(fighter.id, openingMaskShape);
    }

    private selectFighter(fighter: FighterDefinition, force = false) {
        if (!force && fighter.id === this.selectedFighter.id) return;
        const changed = fighter.id !== this.selectedFighter.id;
        this.selectedFighter = fighter;
        const index = FIGHTERS.findIndex((entry) => entry.id === fighter.id) + 1;
        this.selectTitle?.setText(`CONTENDER ${String(index).padStart(2, '0')}  //  ${fighter.name}  /  ${fighter.subtitle}`);
        this.selectionCards.forEach((card, id) => {
            const selected = id === fighter.id;
            // 調整中だけは、選択中のカードにも通常絵を出せるようにする。通常絵を暗転状態で
            // 判断するとサイズ・足元位置を誤るため、通常／選択を同じ明るさで見比べられるようにする。
            const previewingLineup = selected && this.debugEnabled && id === this.gateCharacterTunerFighterId && this.gateCharacterTunerState === 'lineup';
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
            const mark = card.getData('mark') as GameObjects.Image;
            const number = card.getData('number') as GameObjects.Text;
            const name = card.getData('name') as GameObjects.Text;
            const subtitle = card.getData('subtitle') as GameObjects.Text;
            const hit = card.getData('hit') as GameObjects.Rectangle;
            const openingMaskShape = card.getData('openingMaskShape') as GameObjects.Graphics;
            const reveal = selected && !previewingLineup;
            const frameWidth = reveal ? SELECTED_GATE_REVEAL_WIDTH : GATE_DISPLAY_WIDTH;
            const openingWidth = frameWidth * 370 / 450;
            this.drawGateOpeningMask(openingMaskShape, openingWidth);
            frame.setVisible(!selected || previewingLineup).setAlpha(previewingLineup ? 1 : selected ? 0 : 0.86);
            selectedFrame.setDisplaySize(frameWidth, GATE_DISPLAY_HEIGHT).setVisible(reveal).setAlpha(1);
            // 非選択キャラは透明にせず暗くする。alphaを下げると床の線が体を貫通して見えるため。
            lineupArt.setVisible(!selected || previewingLineup).setAlpha(selected && !previewingLineup ? 0 : 1).setTint(previewingLineup ? 0xffffff : selected ? 0xffffff : 0x666666);
            selectedArt.setVisible(selected && !previewingLineup).setAlpha(selected ? 1 : 0);
            windowShade.setSize(openingWidth, GATE_OPENING_HEIGHT).setAlpha(reveal ? 0.04 : previewingLineup ? 0.04 : 0.74);
            accent.setSize(openingWidth, GATE_OPENING_HEIGHT);
            leftAccentRail.setX(-openingWidth / 2 + 2.5);
            rightAccentRail.setX(openingWidth / 2 - 2.5);
            accent.setAlpha(selected ? 0.34 : 0.16);
            // 全員の色は残しつつ、選択中だけ線の光量を上げて主役を一目で分かるようにする。
            leftAccentRail.setAlpha(selected ? 1 : 0.34);
            rightAccentRail.setAlpha(selected ? 1 : 0.34);
            number.setPosition(0, this.gateHeaderLayout.numberY).setAlpha(selected ? 1 : 0.86);
            mark.setPosition(0, this.gateHeaderLayout.markY).setAlpha(selected ? 1 : 0.72);
            name.setPosition(0, this.gateHeaderLayout.nameY).setAlpha(selected ? 1 : 0.88);
            subtitle.setPosition(0, this.gateHeaderLayout.subtitleY).setAlpha(selected ? 1 : 0.82);
            hit.setScale(selected && !previewingLineup ? 1 / 1.04 : 1);
            this.tweens.killTweensOf(card);
            this.tweens.killTweensOf(openingMaskShape);
            if (selected && changed && !previewingLineup) {
                card.setAlpha(1).setDepth(4);
                this.tweens.add({ targets: [card, openingMaskShape], x: targetX, y: targetY - 13, scaleX: 1.04, scaleY: 1.04, duration: 120, ease: 'Sine.easeOut' });
            } else {
                card.setAlpha(1).setPosition(targetX, selected && !previewingLineup ? targetY - 13 : targetY).setScale(selected && !previewingLineup ? 1.04 : 1).setDepth(selected && !previewingLineup ? 4 : 1);
                openingMaskShape.setPosition(card.x, card.y).setScale(card.scaleX, card.scaleY);
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
        this.destroyGateHeaderTuner();
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
            this.destroyGateHeaderTuner();
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

    private createSummonStageTuner() {
        if (!this.summonStagePreviewEnabled || !this.selectionLayer) return;
        if (!this.summonStageTuner) {
            const style = document.createElement('style');
            style.textContent = `
                .tc-remaster-summon-tuner { position:fixed; z-index:1200; left:8px; right:8px; bottom:8px; box-sizing:border-box; max-height:36vh; overflow:auto; color:#d9e9f4; background:linear-gradient(160deg,rgba(8,17,29,.98),rgba(4,10,19,.97)); border:1px solid rgba(232,200,120,.9); box-shadow:0 12px 36px rgba(0,0,0,.58); font-family:Arial,sans-serif; touch-action:manipulation; }
                .tc-remaster-summon-tuner summary { padding:12px; color:#ffedb2; font-size:11px; font-weight:700; letter-spacing:1.4px; cursor:pointer; }
                .tc-remaster-summon-tuner__body { padding:0 12px 12px; }
                .tc-remaster-summon-tuner__section { margin:12px 0 7px; padding-top:10px; border-top:1px solid rgba(232,200,120,.28); color:#ffedb2; font-size:10px; letter-spacing:1px; }
                .tc-remaster-summon-tuner__row { display:grid; grid-template-columns:95px 1fr 62px; gap:7px; align-items:center; margin:7px 0; color:#dbe6ee; font-size:10px; font-weight:700; letter-spacing:.4px; }
                .tc-remaster-summon-tuner input[type=range] { width:100%; margin:0; accent-color:#f2cf70; }
                .tc-remaster-summon-tuner input[type=number] { box-sizing:border-box; width:100%; padding:6px 5px; color:#eef8ff; background:#101d2d; border:1px solid #6d7682; font:700 12px Arial,sans-serif; }
                .tc-remaster-summon-tuner__actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:12px; }
                .tc-remaster-summon-tuner button { min-height:34px; padding:7px; color:#fff0b8; background:#2c2618; border:1px solid #d9b85d; font:700 10px Arial,sans-serif; letter-spacing:.8px; }
                .tc-remaster-summon-tuner__status { min-height:12px; margin:8px 0 0; color:#a9eac9; font-size:10px; overflow-wrap:anywhere; }
                @media (min-width:1101px) { .tc-remaster-summon-tuner { left:auto; right:12px; top:18px; bottom:auto; width:360px; max-height:calc(100vh - 36px); } }
            `;
            document.head.appendChild(style);
            this.summonStageTunerStyle = style;
            const tuner = document.createElement('details');
            tuner.className = 'tc-remaster-summon-tuner';
            tuner.open = true;
            tuner.addEventListener('toggle', () => { this.input.enabled = !tuner.open; });
            const stopInput = (event: Event) => event.stopPropagation();
            tuner.addEventListener('pointerdown', stopInput);
            tuner.addEventListener('pointerup', stopInput);
            tuner.addEventListener('click', stopInput);
            document.body.appendChild(tuner);
            this.summonStageTuner = tuner;
            this.input.enabled = false;
        }
        const tuner = this.summonStageTuner;
        tuner.replaceChildren();
        const summary = document.createElement('summary');
        summary.textContent = 'SUMMON STAGE TUNER  /  LAYOUT GUIDES';
        const body = document.createElement('div');
        body.className = 'tc-remaster-summon-tuner__body';
        const layout = this.summonStageLayout;
        const addSection = (text: string) => {
            const title = document.createElement('h3');
            title.className = 'tc-remaster-summon-tuner__section';
            title.textContent = text;
            body.appendChild(title);
        };
        addSection('TITLE ART');
        this.addSummonStageField(body, 'TITLE X', 0, 180, layout.title.x, 1, (value) => { layout.title.x = value; });
        this.addSummonStageField(body, 'TITLE Y', 20, 150, layout.title.y, 1, (value) => { layout.title.y = value; });
        this.addSummonStageField(body, 'TITLE WIDTH', 620, 900, layout.title.width, 1, (value) => { layout.title.width = value; });
        this.addSummonStageField(body, 'TITLE HEIGHT', 110, 230, layout.title.height, 1, (value) => { layout.title.height = value; });
        addSection('TOP ROSTER / 7 MINI GATES');
        this.addSummonStageField(body, 'ROW X', 0, 160, layout.miniGate.x, 1, (value) => { layout.miniGate.x = value; });
        this.addSummonStageField(body, 'ROW Y', 220, 390, layout.miniGate.y, 1, (value) => { layout.miniGate.y = value; });
        this.addSummonStageField(body, 'GATE WIDTH', 72, 118, layout.miniGate.width, 1, (value) => { layout.miniGate.width = value; });
        this.addSummonStageField(body, 'GATE HEIGHT', 220, 370, layout.miniGate.height, 1, (value) => { layout.miniGate.height = value; });
        this.addSummonStageField(body, 'GATE GAP', 8, 36, layout.miniGate.gap, 1, (value) => { layout.miniGate.gap = value; });
        addSection('LARGE SUMMON GATE');
        this.addSummonStageField(body, 'GATE X', 0, 100, layout.gate.x, 1, (value) => { layout.gate.x = value; });
        this.addSummonStageField(body, 'GATE Y', 520, 760, layout.gate.y, 1, (value) => { layout.gate.y = value; });
        this.addSummonStageField(body, 'GATE WIDTH', 700, 920, layout.gate.width, 1, (value) => { layout.gate.width = value; });
        this.addSummonStageField(body, 'GATE HEIGHT', 650, 980, layout.gate.height, 1, (value) => { layout.gate.height = value; });
        addSection('INNER DIMENSION / CHARACTER');
        this.addSummonStageField(body, 'INNER X', 90, 260, layout.interior.x, 1, (value) => { layout.interior.x = value; });
        this.addSummonStageField(body, 'INNER Y', 570, 830, layout.interior.y, 1, (value) => { layout.interior.y = value; });
        this.addSummonStageField(body, 'INNER WIDTH', 420, 700, layout.interior.width, 1, (value) => { layout.interior.width = value; });
        this.addSummonStageField(body, 'INNER HEIGHT', 560, 840, layout.interior.height, 1, (value) => { layout.interior.height = value; });
        this.addSummonStageField(body, 'FOOT BASELINE', 1260, 1460, layout.character.baseline, 1, (value) => { layout.character.baseline = value; });
        this.addSummonStageField(body, 'CHARACTER H', 600, 900, layout.character.height, 1, (value) => { layout.character.height = value; });
        addSection('CTA');
        this.addSummonStageField(body, 'CTA Y', 1430, 1520, layout.cta.y, 1, (value) => { layout.cta.y = value; });
        const actions = document.createElement('div');
        actions.className = 'tc-remaster-summon-tuner__actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'COPY LAYOUT JSON';
        copy.addEventListener('click', () => {
            const values = JSON.stringify({ summonStage: this.summonStageLayout });
            void navigator.clipboard?.writeText(values);
            const status = body.querySelector<HTMLElement>('.tc-remaster-summon-tuner__status');
            if (status) status.textContent = `COPIED: ${values}`;
        });
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'RESET GUIDE';
        reset.addEventListener('click', () => {
            this.summonStageLayout = JSON.parse(JSON.stringify(DEFAULT_SUMMON_STAGE_LAYOUT));
            this.createSummonStagePreview(this.selectionLayer!);
            this.createSummonStageTuner();
        });
        const status = document.createElement('p');
        status.className = 'tc-remaster-summon-tuner__status';
        actions.append(copy, reset);
        body.append(actions, status);
        tuner.append(summary, body);
    }

    private addSummonStageField(host: HTMLElement, label: string, min: number, max: number, value: number, step: number, setValue: (value: number) => void) {
        const row = document.createElement('label');
        row.className = 'tc-remaster-summon-tuner__row';
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
        number.value = `${value}`;
        const commit = (next: number) => {
            if (!Number.isFinite(next)) return;
            const normalized = Math.round(PhaserMath.Clamp(next, min, max) / step) * step;
            range.value = `${normalized}`;
            number.value = `${normalized}`;
            setValue(normalized);
            this.createSummonStagePreview(this.selectionLayer!);
        };
        range.addEventListener('input', () => commit(Number(range.value)));
        number.addEventListener('change', () => commit(Number(number.value)));
        row.append(caption, range, number);
        host.appendChild(row);
    }

    private destroySummonStageTuner() {
        this.summonStageTuner?.remove();
        this.summonStageTunerStyle?.remove();
        this.summonStageTuner = undefined;
        this.summonStageTunerStyle = undefined;
        this.summonStageGuide?.destroy();
        this.summonStageGuide = undefined;
    }

    private createGateHeaderTuner() {
        if (!this.debugEnabled || this.state !== 'select') return;
        if (!this.gateHeaderTuner) {
            const style = document.createElement('style');
            style.textContent = `
                .tc-remaster-gate-tuner { position:fixed; z-index:1100; left:8px; right:8px; bottom:8px; box-sizing:border-box; max-height:43vh; overflow:auto; color:#d9e9f4; background:linear-gradient(160deg,rgba(8,17,29,.98),rgba(4,10,19,.97)); border:1px solid rgba(113,198,223,.82); box-shadow:0 12px 36px rgba(0,0,0,.58), inset 0 0 28px rgba(45,137,173,.08); font-family:Arial,sans-serif; }
                .tc-remaster-gate-tuner.is-top { top:8px; bottom:auto; }
                .tc-remaster-gate-tuner summary { min-height:38px; box-sizing:border-box; padding:12px; color:#b9fff7; font-size:11px; font-weight:700; letter-spacing:1.4px; cursor:pointer; }
                .tc-remaster-gate-tuner__body { padding:0 12px 12px; }
                .tc-remaster-gate-tuner__hint { margin:0 0 10px; color:#9cb7c9; font-size:10px; line-height:1.4; }
                .tc-remaster-gate-tuner__section { margin:16px 0 8px; padding-top:12px; border-top:1px solid rgba(113,198,223,.28); color:#b9fff7; font-size:10px; letter-spacing:1px; }
                .tc-remaster-gate-tuner__choice { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin:8px 0; }
                .tc-remaster-gate-tuner select { box-sizing:border-box; width:100%; min-width:0; padding:8px; color:#eef8ff; background:#101d2d; border:1px solid #5c7894; border-radius:0; font:700 12px Arial,sans-serif; }
                .tc-remaster-gate-tuner__choice button.is-active { color:#071318; background:#9af7ec; border-color:#dcfffa; }
                .tc-remaster-gate-tuner__row { display:grid; grid-template-columns:90px 1fr 58px; gap:7px; align-items:center; margin:8px 0; color:#c8dae8; font-size:10px; font-weight:700; letter-spacing:.5px; }
                .tc-remaster-gate-tuner input[type=range] { width:100%; margin:0; accent-color:#75f4ea; }
                .tc-remaster-gate-tuner input[type=number] { box-sizing:border-box; width:100%; min-width:0; padding:7px 5px; color:#eef8ff; background:#101d2d; border:1px solid #5c7894; border-radius:0; font:700 12px Arial,sans-serif; }
                .tc-remaster-gate-tuner__actions { display:grid; grid-template-columns:repeat(3,1fr); gap:7px; margin-top:12px; }
                .tc-remaster-gate-tuner button { min-height:34px; padding:7px; color:#d7ffe5; background:#162b29; border:1px solid #8ee9b6; border-radius:0; font:700 10px Arial,sans-serif; letter-spacing:.8px; }
                .tc-remaster-gate-tuner button + button { color:#c8dae8; background:#111f31; border-color:#5d7892; }
                .tc-remaster-gate-tuner__status { min-height:13px; margin:8px 0 0; color:#8fe5c0; font-size:10px; letter-spacing:.4px; }
                .tc-remaster-gate-tuner__header { margin:0 0 12px; border:1px solid rgba(113,198,223,.35); }
                .tc-remaster-gate-tuner__header summary { min-height:30px; padding:9px; color:#a9c6d8; font-size:9px; }
                @media (max-width:1100px) {
                    /* 携帯ではゲートを隠さず、下端のゲーム操作とも重ならない上端に固定する。 */
                    .tc-remaster-gate-tuner { top:8px; bottom:auto; max-height:31vh; touch-action:manipulation; }
                    .tc-remaster-gate-tuner__body { padding:0 10px 10px; }
                    .tc-remaster-gate-tuner__header { display:none; }
                    .tc-remaster-gate-tuner__header-actions { display:none; }
                    .tc-remaster-gate-tuner__section { margin:0 0 5px; padding:0; border:0; }
                    .tc-remaster-gate-tuner__hint { display:none; }
                    .tc-remaster-gate-tuner__choice { margin:6px 0; }
                    .tc-remaster-gate-tuner__row { margin:5px 0; }
                    .tc-remaster-gate-tuner__actions { margin-top:7px; }
                }
                @media (min-width:1101px) {
                    .tc-remaster-gate-tuner { left:50%; right:auto; width:360px; transform:translateX(-50%); bottom:18px; max-height:58vh; }
                    .tc-remaster-gate-tuner.is-top { top:18px; bottom:auto; }
                    /* FIT表示したゲームの右余白に収める。ゲーム側の表示倍率は高さ基準なので、
                       余白幅もviewport高さから算出しておけば、横長PCで本体へ重ならない。 */
                    .tc-remaster-gate-tuner.is-desktop-side { left:auto; right:12px; bottom:auto; top:18px; width:min(360px, max(300px, calc(50vw - 29vh - 12px))); max-height:calc(100vh - 36px); transform:none; }
                }
            `;
            document.head.appendChild(style);
            this.gateHeaderTunerStyle = style;
            const tuner = document.createElement('details');
            tuner.className = 'tc-remaster-gate-tuner';
            tuner.open = this.gateHeaderTunerOpen;
            tuner.addEventListener('toggle', () => {
                this.gateHeaderTunerOpen = tuner.open;
                // DOMパネルを開いている間は、画面全体を監視するPhaser入力を止める。
                // イベント伝播だけでは携帯Safariのタッチが背後のゲートへ届くことがあるため。
                this.input.enabled = !tuner.open;
            });
            // Phaser は画面全体のポインタを監視するため、調整UIへの操作をゲート選択へ渡さない。
            const stopGateInput = (event: Event) => event.stopPropagation();
            tuner.addEventListener('pointerdown', stopGateInput);
            tuner.addEventListener('pointerup', stopGateInput);
            tuner.addEventListener('click', stopGateInput);
            document.body.appendChild(tuner);
            this.gateHeaderTuner = tuner;
            this.input.enabled = !tuner.open;
        }

        const tuner = this.gateHeaderTuner;
        const useDesktopSide = this.hasDesktopDebugSpace();
        tuner.classList.toggle('is-desktop-side', useDesktopSide);
        tuner.classList.toggle('is-top', this.gateHeaderTunerPosition === 'top');
        // PCの十分な余白では開いたまま置く。閉じる操作は残すので、通常操作へ戻したい時も支障はない。
        if (useDesktopSide && !tuner.open) {
            tuner.open = true;
            this.gateHeaderTunerOpen = true;
            this.input.enabled = false;
        }
        tuner.replaceChildren();
        const summary = document.createElement('summary');
        summary.textContent = useDesktopSide ? 'GATE TUNER  /  PC SIDE PANEL' : 'GATE TUNER  /  TAP TO OPEN';
        const body = document.createElement('div');
        body.className = 'tc-remaster-gate-tuner__body';
        const headerSettings = document.createElement('details');
        headerSettings.className = 'tc-remaster-gate-tuner__header';
        const headerSummary = document.createElement('summary');
        headerSummary.textContent = 'HEADER SETTINGS (PC ONLY)';
        headerSettings.appendChild(headerSummary);
        const hint = document.createElement('p');
        hint.className = 'tc-remaster-gate-tuner__hint';
        hint.textContent = '全7ゲート共通。スライダーか右の数値入力で、番号・マーク・名前・肩書きを個別調整できる。';
        headerSettings.appendChild(hint);
        this.addGateHeaderField(headerSettings, 'NUMBER Y', -410, -320, this.gateHeaderLayout.numberY, 1, (value) => { this.gateHeaderLayout.numberY = value; });
        this.addGateHeaderField(headerSettings, 'NUMBER SIZE', 12, 28, this.gateHeaderLayout.numberSize, 1, (value) => { this.gateHeaderLayout.numberSize = value; });
        this.addGateHeaderField(headerSettings, 'MARK Y', -360, -260, this.gateHeaderLayout.markY, 1, (value) => { this.gateHeaderLayout.markY = value; });
        this.addGateHeaderField(headerSettings, 'MARK SIZE', 36, 86, this.gateHeaderLayout.markSize, 1, (value) => { this.gateHeaderLayout.markSize = value; });
        this.addGateHeaderField(headerSettings, 'NAME Y', -300, -210, this.gateHeaderLayout.nameY, 1, (value) => { this.gateHeaderLayout.nameY = value; });
        this.addGateHeaderField(headerSettings, 'NAME SIZE', 10, 24, this.gateHeaderLayout.nameSize, 1, (value) => { this.gateHeaderLayout.nameSize = value; });
        this.addGateHeaderField(headerSettings, 'TITLE Y', -270, -190, this.gateHeaderLayout.subtitleY, 1, (value) => { this.gateHeaderLayout.subtitleY = value; });
        this.addGateHeaderField(headerSettings, 'TITLE SIZE', 7, 16, this.gateHeaderLayout.subtitleSize, 1, (value) => { this.gateHeaderLayout.subtitleSize = value; });
        body.appendChild(headerSettings);
        const characterSection = document.createElement('h3');
        characterSection.className = 'tc-remaster-gate-tuner__section';
        characterSection.textContent = 'GATE CHARACTER TUNER';
        body.appendChild(characterSection);
        const characterHint = document.createElement('p');
        characterHint.className = 'tc-remaster-gate-tuner__hint';
        characterHint.textContent = 'キャラごとに通常／選択を別々に調整。対象の絵を明るく表示したまま、X・Y・SIZEを直接入力できる。';
        body.appendChild(characterHint);
        const fighterSelect = document.createElement('select');
        FIGHTERS.forEach((fighter) => {
            const option = document.createElement('option');
            option.value = fighter.id;
            option.textContent = `${fighter.name} / ${fighter.subtitle}`;
            fighterSelect.appendChild(option);
        });
        fighterSelect.value = this.gateCharacterTunerFighterId;
        fighterSelect.addEventListener('change', () => {
            this.gateCharacterTunerFighterId = fighterSelect.value;
            const target = FIGHTERS.find((fighter) => fighter.id === fighterSelect.value);
            if (target) this.selectFighter(target, true);
            this.createGateHeaderTuner();
        });
        body.appendChild(fighterSelect);
        const stateChoice = document.createElement('div');
        stateChoice.className = 'tc-remaster-gate-tuner__choice';
        (['lineup', 'selected'] as GateCharacterState[]).forEach((state) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = state === 'lineup' ? 'NORMAL' : 'SELECTED';
            button.classList.toggle('is-active', this.gateCharacterTunerState === state);
            button.addEventListener('click', () => {
                this.gateCharacterTunerState = state;
                const target = FIGHTERS.find((fighter) => fighter.id === this.gateCharacterTunerFighterId);
                if (target) this.selectFighter(target, true);
                this.createGateHeaderTuner();
            });
            stateChoice.appendChild(button);
        });
        body.appendChild(stateChoice);
        const characterLayout = this.gateCharacterLayouts[this.gateCharacterTunerFighterId][this.gateCharacterTunerState];
        this.addGateCharacterField(body, 'CHARACTER X', -80, 80, characterLayout.x, 1, (value) => { characterLayout.x = value; });
        this.addGateCharacterField(body, 'CHARACTER Y', -120, 120, characterLayout.y, 1, (value) => { characterLayout.y = value; });
        this.addGateCharacterField(body, 'CHARACTER SIZE', 0.65, 1.35, characterLayout.scale, 0.01, (value) => { characterLayout.scale = value; });
        const characterActions = document.createElement('div');
        characterActions.className = 'tc-remaster-gate-tuner__actions';
        const copyCharacter = document.createElement('button');
        copyCharacter.type = 'button';
        copyCharacter.textContent = 'COPY CHARACTER VALUES';
        copyCharacter.addEventListener('click', () => {
            const values = JSON.stringify({ gateCharacters: this.gateCharacterLayouts });
            void navigator.clipboard?.writeText(values);
            const status = body.querySelector<HTMLElement>('.tc-remaster-gate-tuner__status');
            if (status) status.textContent = `COPIED: ${values}`;
        });
        const resetCharacter = document.createElement('button');
        resetCharacter.type = 'button';
        resetCharacter.textContent = 'RESET THIS STATE';
        resetCharacter.addEventListener('click', () => {
            this.gateCharacterLayouts[this.gateCharacterTunerFighterId][this.gateCharacterTunerState] = { ...DEFAULT_GATE_CHARACTER_LAYOUTS[this.gateCharacterTunerFighterId][this.gateCharacterTunerState] };
            this.applyGateCharacterLayout();
            this.createGateHeaderTuner();
        });
        characterActions.append(copyCharacter, resetCharacter);
        body.appendChild(characterActions);
        const actions = document.createElement('div');
        actions.className = 'tc-remaster-gate-tuner__actions tc-remaster-gate-tuner__header-actions';
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.textContent = 'COPY HEADER VALUES';
        copy.addEventListener('click', () => {
            const values = JSON.stringify({ gateHeader: this.gateHeaderLayout });
            void navigator.clipboard?.writeText(values);
            const status = body.querySelector<HTMLElement>('.tc-remaster-gate-tuner__status');
            if (status) status.textContent = `COPIED: ${values}`;
        });
        const reset = document.createElement('button');
        reset.type = 'button';
        reset.textContent = 'RESET HEADER';
        reset.addEventListener('click', () => {
            this.gateHeaderLayout = { ...DEFAULT_GATE_HEADER_LAYOUT };
            this.applyGateHeaderLayout();
            this.createGateHeaderTuner();
        });
        const move = document.createElement('button');
        move.type = 'button';
        move.textContent = this.gateHeaderTunerPosition === 'bottom' ? 'MOVE TO TOP' : 'MOVE TO BOTTOM';
        move.addEventListener('click', () => {
            this.gateHeaderTunerPosition = this.gateHeaderTunerPosition === 'bottom' ? 'top' : 'bottom';
            this.createGateHeaderTuner();
        });
        actions.append(copy, reset, move);
        const status = document.createElement('p');
        status.className = 'tc-remaster-gate-tuner__status';
        body.append(actions, status);
        tuner.append(summary, body);
    }

    private addGateHeaderField(host: HTMLElement, label: string, min: number, max: number, value: number, step: number, setValue: (value: number) => void) {
        const row = document.createElement('label');
        row.className = 'tc-remaster-gate-tuner__row';
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
        number.value = `${Math.round(value)}`;
        const commit = (next: number) => {
            if (!Number.isFinite(next)) return;
            const normalized = Math.round(PhaserMath.Clamp(next, min, max));
            range.value = `${normalized}`;
            number.value = `${normalized}`;
            setValue(normalized);
            this.applyGateHeaderLayout();
        };
        range.addEventListener('input', () => commit(Number(range.value)));
        number.addEventListener('change', () => commit(Number(number.value)));
        row.append(caption, range, number);
        host.appendChild(row);
    }

    private addGateCharacterField(host: HTMLElement, label: string, min: number, max: number, value: number, step: number, setValue: (value: number) => void) {
        const row = document.createElement('label');
        row.className = 'tc-remaster-gate-tuner__row';
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
        number.value = `${Number(value.toFixed(2))}`;
        const commit = (next: number) => {
            if (!Number.isFinite(next)) return;
            const normalized = Math.round(PhaserMath.Clamp(next, min, max) / step) * step;
            const displayValue = Number(normalized.toFixed(2));
            range.value = `${displayValue}`;
            number.value = `${displayValue}`;
            setValue(displayValue);
            this.applyGateCharacterLayout();
        };
        range.addEventListener('input', () => commit(Number(range.value)));
        number.addEventListener('change', () => commit(Number(number.value)));
        row.append(caption, range, number);
        host.appendChild(row);
    }

    private applyGateCharacterLayout() {
        this.selectionCards.forEach((card, id) => {
            const fighter = card.getData('fighter') as FighterDefinition;
            const layout = this.gateCharacterLayouts[id];
            const lineupArt = card.getData('lineupArt') as GameObjects.Image;
            const selectedArt = card.getData('selectedArt') as GameObjects.Image;
            lineupArt.setPosition(layout.lineup.x, this.gateCharacterBaseY(fighter) + layout.lineup.y).setScale(this.gateCharacterBaseScale(fighter, lineupArt) * layout.lineup.scale);
            selectedArt.setPosition(layout.selected.x, this.gateCharacterBaseY(fighter) + layout.selected.y).setScale(this.gateCharacterBaseScale(fighter, selectedArt) * layout.selected.scale);
        });
        this.selectFighter(this.selectedFighter, true);
    }

    private drawGateOpeningMask(mask: GameObjects.Graphics, width: number) {
        mask.clear();
        mask.fillStyle(0xffffff);
        mask.fillRect(-width / 2, -GATE_OPENING_HEIGHT / 2, width, GATE_OPENING_HEIGHT);
    }

    private gateCharacterBaseScale(fighter: FighterDefinition, art: GameObjects.Image) {
        return GATE_CHARACTER_CANVAS_SCALE * GATE_CHARACTER_DISPLAY_HEIGHTS[fighter.id] / art.height;
    }

    private gateCharacterBaseY(fighter: FighterDefinition) {
        return GATE_CHARACTER_CANVAS_SCALE * (GATE_CHARACTER_BASELINE - GATE_CHARACTER_DISPLAY_HEIGHTS[fighter.id] / 2 - GATE_CHARACTER_CANVAS_HEIGHT / 2);
    }

    private applyGateHeaderLayout() {
        this.selectionCards.forEach((card) => {
            const fighter = card.getData('fighter') as FighterDefinition;
            const headerColor = this.gateHeaderTextColor(fighter.color);
            (card.getData('number') as GameObjects.Text).setY(this.gateHeaderLayout.numberY).setFontSize(this.gateHeaderLayout.numberSize);
            (card.getData('mark') as GameObjects.Image).setY(this.gateHeaderLayout.markY).setDisplaySize(this.gateHeaderLayout.markSize, this.gateHeaderLayout.markSize).setTint(this.gateHeaderTint(fighter.color));
            (card.getData('number') as GameObjects.Text).setColor(headerColor);
            (card.getData('name') as GameObjects.Text).setY(this.gateHeaderLayout.nameY).setFontSize(this.gateHeaderLayout.nameSize).setColor(headerColor);
            (card.getData('subtitle') as GameObjects.Text).setY(this.gateHeaderLayout.subtitleY).setFontSize(this.gateHeaderLayout.subtitleSize).setColor(headerColor);
        });
    }

    private gateHeaderTint(color: number) {
        const lift = (channel: number) => Math.round(channel + (255 - channel) * 0.26);
        return (lift((color >> 16) & 0xff) << 16) | (lift((color >> 8) & 0xff) << 8) | lift(color & 0xff);
    }

    private gateHeaderTextColor(color: number) {
        return `#${this.gateHeaderTint(color).toString(16).padStart(6, '0')}`;
    }

    private destroyGateHeaderTuner() {
        this.gateHeaderTuner?.remove();
        this.gateHeaderTunerStyle?.remove();
        this.gateHeaderTuner = undefined;
        this.gateHeaderTunerStyle = undefined;
        // 調整画面を離れた後までゲーム操作が止まらないよう、ここで必ず戻す。
        this.input.enabled = true;
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
