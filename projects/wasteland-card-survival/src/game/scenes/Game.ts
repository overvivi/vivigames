import { Container, GameObjects, Input, Math as PhaserMath, Scene } from 'phaser';

type CardKind = 'scout' | 'metal-rubble' | 'electronics-rubble' | 'scrap' | 'wire' | 'workbench' | 'generator' | 'radio-tower' | 'restored-tower';

type CardDefinition = { title: string; detail: string; color: number; accent: number; };
type CardView = { kind: CardKind; container: Container; panel: GameObjects.Rectangle; };
type Recipe = { ingredients: [CardKind, CardKind]; result: CardKind; keep?: CardKind; message: string; };

const CARD_WIDTH = 178;
const CARD_HEIGHT = 226;
const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 1800;
const MIN_ZOOM = 0.58;
const MAX_ZOOM = 1.28;
const CARD_DEFINITIONS: Record<CardKind, CardDefinition> = {
    scout: { title: '探索者', detail: '瓦礫から使える物を\n探し出せる。', color: 0x26313a, accent: 0x7be1ff },
    'metal-rubble': { title: '金属瓦礫', detail: '歪んだ鉄骨の山。\nスクラップになりそう。', color: 0x403b3a, accent: 0xffb45c },
    'electronics-rubble': { title: '電子瓦礫', detail: '壊れた端末と基板。\n配線が残っている。', color: 0x342f46, accent: 0xc795ff },
    scrap: { title: 'スクラップ', detail: '使い道のある金属片。\n重ねて加工できる。', color: 0x43454b, accent: 0xe5e7eb },
    wire: { title: '配線', detail: 'まだ通電できそうな\n古いケーブル。', color: 0x263b3b, accent: 0x66e6c7 },
    workbench: { title: '作業台', detail: '資材を直して\n設備を組み立てられる。', color: 0x44382e, accent: 0xf8d66d },
    generator: { title: '発電機', detail: 'かろうじて動く。\n通信塔へ電力を送ろう。', color: 0x293f35, accent: 0x8aef8a },
    'radio-tower': { title: '通信塔', detail: '沈黙したままの塔。\n電力があれば復旧できる。', color: 0x293145, accent: 0x8da9ff },
    'restored-tower': { title: '通信塔・復旧', detail: '生活圏に\n最初の灯りが戻った。', color: 0x183f3a, accent: 0x5fffd0 }
};

const RECIPES: Recipe[] = [
    { ingredients: ['scout', 'metal-rubble'], result: 'scrap', keep: 'scout', message: '金属瓦礫からスクラップを回収した。' },
    { ingredients: ['scout', 'electronics-rubble'], result: 'wire', keep: 'scout', message: '電子瓦礫から使える配線を見つけた。' },
    { ingredients: ['scrap', 'scrap'], result: 'workbench', message: 'スクラップを組み、作業台を作った。' },
    { ingredients: ['workbench', 'wire'], result: 'generator', message: '配線をつなぎ、発電機を修理した。' },
    { ingredients: ['generator', 'radio-tower'], result: 'restored-tower', message: '通信塔に灯りが戻った。生活圏の再生が始まる。' }
];

export class Game extends Scene {
    private cards: CardView[] = [];
    private statusText!: GameObjects.Text;
    private progressText!: GameObjects.Text;
    private completionLayer?: Container;
    private isPanning = false;
    private panStartX = 0;
    private panStartY = 0;
    private panCameraX = 0;
    private panCameraY = 0;

    constructor() {
        super('Game');
    }

    create() {
        this.createBackdrop();
        this.createHud();
        this.enableMapPan();
        this.resetBoard();
    }

    private createBackdrop() {
        this.cameras.main.setBackgroundColor(0x090d12);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x101720);
        for (let index = 0; index < 170; index++) {
            this.add.circle(45 + ((index * 137) % (WORLD_WIDTH - 90)), 160 + ((index * 83) % (WORLD_HEIGHT - 300)), 1 + (index % 3), 0x4c6980, 0.18);
        }
        this.add.rectangle(WORLD_WIDTH / 2, 150, WORLD_WIDTH, 2, 0x6fe7da, 0.32);
        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 70, WORLD_WIDTH, 2, 0x6fe7da, 0.24);
        this.createSectorLabel(130, 210, 'SECTOR 01  /  SCRAP YARD');
        this.createSectorLabel(1340, 300, 'SECTOR 02  /  WORKBENCH');
        this.createSectorLabel(2470, 780, 'SECTOR 03  /  RADIO TOWER');
    }

    private createHud() {
        this.add.text(56, 42, 'WASTELAND CARD SURVIVAL', { fontFamily: 'Arial, sans-serif', fontSize: '26px', fontStyle: 'bold', color: '#e9edf2', letterSpacing: 4 }).setScrollFactor(0);
        this.add.text(58, 82, 'CORE PROTOTYPE  /  カードを重ねて、通信塔を復旧せよ', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#91a3b7', letterSpacing: 1 }).setScrollFactor(0);
        this.add.text(58, 108, '空いている場所をドラッグして盤面を移動  /  PCはホイールで拡大・縮小', { fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#6e8498', letterSpacing: 1 }).setScrollFactor(0);
        this.progressText = this.add.text(1222, 54, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#7be1ff', align: 'right' }).setOrigin(1, 0).setScrollFactor(0);
        this.statusText = this.add.text(640, 658, '', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#dfe8f2', align: 'center', wordWrap: { width: 900 } }).setOrigin(0.5, 0.5).setScrollFactor(0);
        const restart = this.add.text(1218, 682, '↻ RESET', { fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#aebdca', backgroundColor: '#18222e', padding: { x: 12, y: 7 } }).setOrigin(1, 0.5).setScrollFactor(0).setInteractive({ useHandCursor: true });
        restart.on('pointerover', () => restart.setColor('#ffffff'));
        restart.on('pointerout', () => restart.setColor('#aebdca'));
        restart.on('pointerup', () => this.resetBoard());
    }

    private createSectorLabel(x: number, y: number, label: string) {
        this.add.text(x, y, label, { fontFamily: 'Arial, sans-serif', fontSize: '18px', fontStyle: 'bold', color: '#527386', letterSpacing: 2, alpha: 0.75 });
        this.add.rectangle(x, y + 33, 280, 2, 0x456476, 0.6).setOrigin(0, 0.5);
    }

    private enableMapPan() {
        this.input.on('pointerdown', (pointer: Input.Pointer, currentlyOver: GameObjects.GameObject[]) => {
            if (this.completionLayer || currentlyOver.length > 0) return;
            this.isPanning = true;
            this.panStartX = pointer.x;
            this.panStartY = pointer.y;
            this.panCameraX = this.cameras.main.scrollX;
            this.panCameraY = this.cameras.main.scrollY;
        });
        this.input.on('pointermove', (pointer: Input.Pointer) => {
            if (!this.isPanning || !pointer.isDown) return;
            const zoom = this.cameras.main.zoom;
            this.setCameraScroll(this.panCameraX - (pointer.x - this.panStartX) / zoom, this.panCameraY - (pointer.y - this.panStartY) / zoom);
        });
        this.input.on('pointerup', () => { this.isPanning = false; });
        this.input.on('wheel', (_pointer: Input.Pointer, _objects: GameObjects.GameObject[], deltaX: number, deltaY: number) => {
            // 横スクロールも含めて拡縮へ寄せ、盤面を探検する感覚を優先する。
            const pointer = _pointer;
            const camera = this.cameras.main;
            const focusX = camera.scrollX + pointer.x / camera.zoom;
            const focusY = camera.scrollY + pointer.y / camera.zoom;
            const direction = deltaY === 0 ? deltaX : deltaY;
            const nextZoom = PhaserMath.Clamp(camera.zoom * (1 - direction * 0.0015), MIN_ZOOM, MAX_ZOOM);
            if (nextZoom === camera.zoom) return;
            camera.setZoom(nextZoom);
            this.setCameraScroll(focusX - pointer.x / nextZoom, focusY - pointer.y / nextZoom);
        });
    }

    private setCameraScroll(x: number, y: number) {
        const camera = this.cameras.main;
        const visibleWidth = camera.width / camera.zoom;
        const visibleHeight = camera.height / camera.zoom;
        camera.setScroll(
            PhaserMath.Clamp(x, 0, Math.max(0, WORLD_WIDTH - visibleWidth)),
            PhaserMath.Clamp(y, 0, Math.max(0, WORLD_HEIGHT - visibleHeight))
        );
    }

    private resetBoard() {
        this.cards.forEach((card) => card.container.destroy());
        this.cards = [];
        this.cameras.main.setScroll(0, 0);
        this.completionLayer?.destroy();
        this.completionLayer = undefined;
        this.createCard('scout', 250, 520);
        this.createCard('metal-rubble', 640, 470);
        this.createCard('electronics-rubble', 1040, 520);
        this.createCard('scrap', 1450, 650);
        this.createCard('scrap', 1900, 620);
        this.createCard('radio-tower', 2820, 1080);
        this.setStatus('探索者を瓦礫へ重ね、使える資源を回収しよう。');
        this.refreshProgress();
    }

    private createCard(kind: CardKind, x: number, y: number) {
        const definition = CARD_DEFINITIONS[kind];
        const container = this.add.container(x, y);
        const shadow = this.add.rectangle(5, 7, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0.34).setOrigin(0.5);
        const panel = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, definition.color, 1).setStrokeStyle(2, definition.accent, 0.72).setOrigin(0.5);
        const band = this.add.rectangle(0, -76, CARD_WIDTH - 18, 4, definition.accent, 0.9).setOrigin(0.5);
        const title = this.add.text(0, -47, definition.title, { fontFamily: 'Arial, sans-serif', fontSize: '23px', fontStyle: 'bold', color: '#f5f7fa', align: 'center', wordWrap: { width: CARD_WIDTH - 24 } }).setOrigin(0.5);
        const detail = this.add.text(0, 26, definition.detail, { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#c6d0da', align: 'center', lineSpacing: 5, wordWrap: { width: CARD_WIDTH - 28 } }).setOrigin(0.5);
        const tag = this.add.text(0, 82, 'DRAG + STACK', { fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#9caebe', letterSpacing: 1 }).setOrigin(0.5);
        container.add([shadow, panel, band, title, detail, tag]);
        container.setSize(CARD_WIDTH, CARD_HEIGHT);
        container.setInteractive({ useHandCursor: true });
        this.input.setDraggable(container);
        const card: CardView = { kind, container, panel };
        this.cards.push(card);
        container.on('dragstart', () => {
            container.setDepth(20);
            container.setScale(1.045);
            panel.setStrokeStyle(3, 0xffffff, 0.95);
        });
        container.on('drag', (_pointer: Input.Pointer, dragX: number, dragY: number) => {
            container.x = PhaserMath.Clamp(dragX, CARD_WIDTH / 2 + 14, WORLD_WIDTH - CARD_WIDTH / 2 - 14);
            container.y = PhaserMath.Clamp(dragY, 170 + CARD_HEIGHT / 2, WORLD_HEIGHT - CARD_HEIGHT / 2 - 84);
        });
        container.on('dragend', () => {
            container.setDepth(1);
            container.setScale(1);
            panel.setStrokeStyle(2, definition.accent, 0.72);
            this.resolveDrop(card);
        });
    }

    private resolveDrop(dragged: CardView) {
        const targets = this.cards
            .filter((candidate) => candidate !== dragged)
            .filter((candidate) => PhaserMath.Distance.Between(dragged.container.x, dragged.container.y, candidate.container.x, candidate.container.y) < 118)
            .sort((left, right) => PhaserMath.Distance.Between(dragged.container.x, dragged.container.y, left.container.x, left.container.y) - PhaserMath.Distance.Between(dragged.container.x, dragged.container.y, right.container.x, right.container.y));
        const target = targets.find((candidate) => this.findRecipe(dragged.kind, candidate.kind)) ?? targets[0];
        if (!target) return;
        const recipe = this.findRecipe(dragged.kind, target.kind);
        if (!recipe) {
            this.setStatus('この組み合わせでは何も起きない。別のカードを重ねよう。', '#ffbd75');
            return;
        }
        const resultX = (dragged.container.x + target.container.x) / 2;
        const resultY = (dragged.container.y + target.container.y) / 2;
        const keptCard = recipe.keep === dragged.kind ? dragged : recipe.keep === target.kind ? target : undefined;
        [dragged, target].filter((card) => card !== keptCard).forEach((card) => this.removeCard(card));
        // 残る探索者が生成物と重なると次のドラッグ対象を取りにくくなるため、下側へ逃がす。
        if (keptCard) keptCard.container.setPosition(resultX, Math.min(resultY + 245, WORLD_HEIGHT - CARD_HEIGHT / 2 - 84));
        this.createCard(recipe.result, resultX, resultY);
        this.setStatus(recipe.message, '#8cffcf');
        this.refreshProgress();
        if (recipe.result === 'restored-tower') this.showCompletion();
    }

    private findRecipe(first: CardKind, second: CardKind) {
        return RECIPES.find((recipe) => {
            const [left, right] = recipe.ingredients;
            return (first === left && second === right) || (first === right && second === left);
        });
    }

    private removeCard(card: CardView) {
        this.cards = this.cards.filter((candidate) => candidate !== card);
        card.container.destroy();
    }

    private refreshProgress() {
        this.progressText.setText(this.cards.some((card) => card.kind === 'restored-tower') ? 'OBJECTIVE  /  COMPLETE' : 'OBJECTIVE  /  RESTORE RADIO TOWER');
    }

    private setStatus(message: string, color = '#dfe8f2') {
        this.statusText.setColor(color);
        this.statusText.setText(message);
    }

    private showCompletion() {
        const shade = this.add.rectangle(640, 360, 1280, 720, 0x05110f, 0.76);
        const panel = this.add.rectangle(640, 360, 620, 300, 0x102b28, 0.98).setStrokeStyle(3, 0x5fffd0, 1);
        const title = this.add.text(640, 292, 'FIRST LIGHT RESTORED', { fontFamily: 'Arial, sans-serif', fontSize: '37px', fontStyle: 'bold', color: '#75ffd8', letterSpacing: 3 }).setOrigin(0.5);
        const body = this.add.text(640, 360, '通信塔が起動した。\nここから生活圏を再生していく。', { fontFamily: 'Arial, sans-serif', fontSize: '21px', color: '#edf7f3', align: 'center', lineSpacing: 12 }).setOrigin(0.5);
        const replay = this.add.text(640, 438, 'もう一度、復旧する', { fontFamily: 'Arial, sans-serif', fontSize: '17px', color: '#102522', backgroundColor: '#75ffd8', padding: { x: 22, y: 13 } }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        replay.on('pointerup', () => this.resetBoard());
        this.completionLayer = this.add.container(0, 0, [shade, panel, title, body, replay]).setScrollFactor(0);
    }
}
